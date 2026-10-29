import { create } from 'zustand'
import {
  byDrawOrder,
  centerOn,
  clampCamera,
  fitToViewport,
  IDENTITY_CAMERA,
  normalizeScale,
  panBy,
  snapToGrid,
  zoomAt,
  zoomByStep,
  type BoardMap,
  type BoardToken,
  type Camera,
  type GridSettings,
  type Point,
  type SessionScale,
  type Size
} from '@/lib/board'
import { mapFromRow, tokenFromRow, type MapRow, type TokenRow } from '@/lib/db/board-rows'
import { errorMessage } from '@/lib/db/errors'
import { listMaps } from '@/lib/db/maps'
import { listTokens, moveToken } from '@/lib/db/tokens'
import type { TableChange } from '@/lib/db/realtime'
import type { SessionRole } from '@/lib/db/sessions'

/**
 * O tabuleiro aberto (seções 6.1 a 6.3).
 *
 * A câmera é de cada um (zoom e deslocamento), mas as posições dos tokens são as mesmas
 * para todos: ficam em coordenadas do mapa, e é a câmera que traduz para a tela. É isso que
 * faz três janelas de tamanhos diferentes mostrarem o mesmo tabuleiro.
 *
 * O mestre pode abrir um mapa **sem ativar** (6.1): `openMapId` é a tela dele, e
 * `activeMapId` é o que a mesa está vendo.
 */

export type BoardTool = 'select' | 'pan'

interface BoardState {
  sessionId: string | null
  role: SessionRole
  maps: BoardMap[]
  activeMapId: string | null
  /** Mapa desenhado agora. Para o jogador é sempre o ativo. */
  openMapId: string | null
  tokens: BoardToken[]
  scale: SessionScale
  loading: boolean
  problem: string | null

  tool: BoardTool
  viewport: Size
  /** Uma câmera por mapa: voltar para o mapa anterior volta para onde se estava (6.1). */
  cameras: Record<string, Camera>
  selection: string[]
  /** Posições durante o arrasto (meu e dos outros, via broadcast). */
  dragging: Record<string, Point>

  open: (input: {
    sessionId: string
    role: SessionRole
    activeMapId: string | null
    scale: SessionScale
  }) => Promise<void>
  close: () => void
  /** A sessão mudou (mapa ativo, escala): acompanha sem recarregar tudo. */
  syncSession: (activeMapId: string | null, scale: SessionScale) => void
  reloadMaps: () => Promise<void>
  reloadTokens: () => Promise<void>
  /** Abre um mapa só para mim (o mestre preparando). */
  openMap: (mapId: string) => void

  setViewport: (viewport: Size) => void
  setTool: (tool: BoardTool) => void
  setCamera: (camera: Camera) => void
  zoomAtPoint: (screen: Point, factor: number) => void
  zoomStep: (factor: number) => void
  pan: (dx: number, dy: number) => void
  fit: () => void
  focusOn: (world: Point) => void

  select: (ids: readonly string[]) => void
  toggleSelected: (id: string) => void
  clearSelection: () => void

  /** Arrasto local: a posição na tela, antes de gravar. */
  dragTo: (id: string, point: Point) => void
  /** Fim do arrasto: encaixa na grade e grava. */
  dropToken: (id: string, point: Point, snap: boolean) => Promise<void>
  /** Posição que chegou pelo canal (arrasto de outra pessoa). */
  applyGhost: (id: string, point: Point) => void

  applyMapChange: (change: TableChange) => void
  applyTokenChange: (change: TableChange) => void
  /** Põe (ou atualiza) um token que já veio pronto do banco. */
  upsertToken: (token: BoardToken) => void
  removeTokenLocally: (id: string) => void
}

/** Quanto tempo uma posição vinda do canal vale, antes de o token voltar ao que o banco diz. */
const GHOST_TIMEOUT_MS = 2500

const ghostTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearGhostTimers(): void {
  for (const timer of ghostTimers.values()) clearTimeout(timer)
  ghostTimers.clear()
}

const emptyState = {
  sessionId: null,
  role: 'player' as SessionRole,
  maps: [],
  activeMapId: null,
  openMapId: null,
  tokens: [],
  scale: normalizeScale(null),
  loading: false,
  problem: null,
  tool: 'select' as BoardTool,
  viewport: { width: 0, height: 0 },
  cameras: {},
  selection: [],
  dragging: {}
}

export const useBoardStore = create<BoardState>()((set, get) => {
  /** O mapa desenhado agora. */
  function openMap(): BoardMap | null {
    const { maps, openMapId } = get()
    return maps.find((map) => map.id === openMapId) ?? null
  }

  function cameraOf(mapId: string | null): Camera {
    if (mapId === null) return IDENTITY_CAMERA
    return get().cameras[mapId] ?? IDENTITY_CAMERA
  }

  function writeCamera(camera: Camera): void {
    const map = openMap()
    const { viewport, openMapId } = get()
    if (openMapId === null) return

    const limited =
      map === null || viewport.width === 0
        ? camera
        : clampCamera(camera, { width: map.width, height: map.height }, viewport)

    set({ cameras: { ...get().cameras, [openMapId]: limited } })
  }

  async function loadTokens(mapId: string | null): Promise<void> {
    if (mapId === null) {
      set({ tokens: [] })
      return
    }
    try {
      const tokens = await listTokens(mapId)
      if (get().openMapId === mapId) set({ tokens: tokens.sort(byDrawOrder) })
    } catch (error) {
      console.warn('Não consegui carregar os tokens:', errorMessage(error))
    }
  }

  /** Troca de mapa: tokens novos, seleção limpa e a câmera daquele mapa. */
  function switchTo(mapId: string | null): void {
    if (get().openMapId === mapId) return
    set({ openMapId: mapId, selection: [], dragging: {}, tokens: [] })
    clearGhostTimers()
    void loadTokens(mapId)
  }

  return {
    ...emptyState,

    open: async ({ sessionId, role, activeMapId, scale }) => {
      clearGhostTimers()
      set({ ...emptyState, sessionId, role, activeMapId, scale, loading: true })

      try {
        const maps = await listMaps(sessionId)
        if (get().sessionId !== sessionId) return

        // O jogador só recebe o mapa ativo; o mestre começa vendo o ativo, se houver.
        const openId = activeMapId ?? (role === 'gm' ? (maps[0]?.id ?? null) : null)
        set({ maps, openMapId: openId, loading: false })
        await loadTokens(openId)
      } catch (error) {
        if (get().sessionId === sessionId) {
          set({ loading: false, problem: errorMessage(error) })
        }
      }
    },

    close: () => {
      clearGhostTimers()
      set({ ...emptyState })
    },

    syncSession: (activeMapId, scale) => {
      const { role, openMapId, activeMapId: previous } = get()
      set({ activeMapId, scale })

      // O jogador acompanha o mapa ativo. O mestre só é levado se estava vendo o antigo
      // — se ele estava preparando outro, continua onde estava (6.1).
      const shouldFollow = role === 'player' || openMapId === null || openMapId === previous
      if (shouldFollow && activeMapId !== openMapId) switchTo(activeMapId)
    },

    reloadMaps: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        const maps = await listMaps(sessionId)
        if (get().sessionId === sessionId) set({ maps })
      } catch (error) {
        console.warn('Não consegui recarregar os mapas:', errorMessage(error))
      }
    },

    reloadTokens: async () => {
      await loadTokens(get().openMapId)
    },

    openMap: (mapId) => switchTo(mapId),

    setViewport: (viewport) => {
      const had = get().viewport.width > 0
      set({ viewport })

      // Primeira medida da janela: já começa com o mapa inteiro à vista.
      const { openMapId } = get()
      if (!had && openMapId !== null && get().cameras[openMapId] === undefined) {
        const map = openMap()
        if (map !== null) {
          set({
            cameras: {
              ...get().cameras,
              [openMapId]: fitToViewport({ width: map.width, height: map.height }, viewport)
            }
          })
        }
      }
    },

    setTool: (tool) => set({ tool }),

    setCamera: (camera) => writeCamera(camera),

    zoomAtPoint: (screen, factor) => writeCamera(zoomAt(cameraOf(get().openMapId), screen, factor)),

    zoomStep: (factor) =>
      writeCamera(zoomByStep(cameraOf(get().openMapId), get().viewport, factor)),

    pan: (dx, dy) => writeCamera(panBy(cameraOf(get().openMapId), dx, dy)),

    fit: () => {
      const map = openMap()
      const { viewport } = get()
      if (map === null || viewport.width === 0) return
      writeCamera(fitToViewport({ width: map.width, height: map.height }, viewport))
    },

    focusOn: (world) => {
      const { viewport } = get()
      if (viewport.width === 0) return
      writeCamera(centerOn(world, viewport, cameraOf(get().openMapId).scale))
    },

    select: (ids) => set({ selection: [...ids] }),

    toggleSelected: (id) => {
      const { selection } = get()
      set({
        selection: selection.includes(id)
          ? selection.filter((item) => item !== id)
          : [...selection, id]
      })
    },

    clearSelection: () => set({ selection: [] }),

    dragTo: (id, point) => set({ dragging: { ...get().dragging, [id]: point } }),

    dropToken: async (id, point, snap) => {
      const token = get().tokens.find((item) => item.id === id)
      const map = openMap()
      if (token === undefined || map === null) return

      const grid: GridSettings = map.grid
      const target = snap ? snapToGrid(point, grid, token.size) : point

      // Otimista: o token já fica no lugar novo enquanto o banco confirma.
      set({
        tokens: get().tokens.map((item) =>
          item.id === id ? { ...item, x: target.x, y: target.y } : item
        ),
        dragging: withoutKey(get().dragging, id)
      })

      try {
        await moveToken(id, target.x, target.y)
      } catch (error) {
        // Recusado (token de outra pessoa): volta ao que o banco tem.
        set({
          tokens: get().tokens.map((item) =>
            item.id === id ? { ...item, x: token.x, y: token.y } : item
          ),
          problem: errorMessage(error)
        })
      }
    },

    applyGhost: (id, point) => {
      set({ dragging: { ...get().dragging, [id]: point } })

      // Se o último evento do arrasto se perder, o token não pode ficar parado no meio do
      // caminho: depois de um tempo sem notícia, vale o que está no banco.
      const previous = ghostTimers.get(id)
      if (previous !== undefined) clearTimeout(previous)
      ghostTimers.set(
        id,
        setTimeout(() => {
          ghostTimers.delete(id)
          set({ dragging: withoutKey(get().dragging, id) })
        }, GHOST_TIMEOUT_MS)
      )
    },

    applyMapChange: (change) => {
      if (change.event === 'DELETE') {
        const id = String(change.old.id ?? '')
        set({ maps: get().maps.filter((map) => map.id !== id) })
        if (get().openMapId === id) switchTo(get().activeMapId)
        return
      }

      const row = change.row as unknown as MapRow
      if (typeof row.id !== 'string') return
      const map = mapFromRow(row)
      const maps = get().maps
      const index = maps.findIndex((item) => item.id === map.id)

      set({
        maps:
          index === -1
            ? [...maps, map].sort((a, b) => a.sortOrder - b.sortOrder)
            : maps.map((item) => (item.id === map.id ? map : item))
      })
    },

    applyTokenChange: (change) => {
      if (change.event === 'DELETE') {
        // O DELETE chega só com o id (10.3).
        get().removeTokenLocally(String(change.old.id ?? ''))
        return
      }

      const row = change.row as unknown as TokenRow
      if (typeof row.id !== 'string') return

      const token = tokenFromRow(row)
      // Token de outro mapa não interessa para esta tela (o mestre recebe os de todos).
      if (token.mapId !== get().openMapId) {
        get().removeTokenLocally(token.id)
        return
      }

      const tokens = get().tokens
      const index = tokens.findIndex((item) => item.id === token.id)
      const next =
        index === -1
          ? [...tokens, token]
          : tokens.map((item) => (item.id === token.id ? token : item))

      set({ tokens: next.sort(byDrawOrder) })
    },

    upsertToken: (token) => {
      if (token.mapId !== get().openMapId) return
      const tokens = get().tokens
      const index = tokens.findIndex((item) => item.id === token.id)
      const next =
        index === -1
          ? [...tokens, token]
          : tokens.map((item) => (item.id === token.id ? token : item))
      set({ tokens: next.sort(byDrawOrder) })
    },

    removeTokenLocally: (id) => {
      if (id === '') return
      const timer = ghostTimers.get(id)
      if (timer !== undefined) {
        clearTimeout(timer)
        ghostTimers.delete(id)
      }
      set({
        tokens: get().tokens.filter((token) => token.id !== id),
        selection: get().selection.filter((item) => item !== id),
        dragging: withoutKey(get().dragging, id)
      })
    }
  }
})

function withoutKey(record: Record<string, Point>, key: string): Record<string, Point> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

/** Posição onde o token deve ser desenhado: a do arrasto, se houver, senão a do banco. */
export function drawPosition(token: BoardToken, dragging: Record<string, Point>): Point {
  return dragging[token.id] ?? { x: token.x, y: token.y }
}

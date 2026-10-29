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
  type Drawing,
  type DrawingsCleared,
  type DrawingTool,
  type GridSettings,
  type Point,
  type SessionScale,
  type Size,
  type StrokeLevel
} from '@/lib/board'
import {
  drawingFromRow,
  mapFromRow,
  tokenFromRow,
  type MapRow,
  type TokenRow
} from '@/lib/db/board-rows'
import { listDrawings } from '@/lib/db/drawings'
import { errorMessage } from '@/lib/db/errors'
import { listMaps } from '@/lib/db/maps'
import { listTokens, moveToken } from '@/lib/db/tokens'
import type { TableChange } from '@/lib/db/realtime'
import type { SessionRole } from '@/lib/db/sessions'
import { useLiveStore } from './live-store'

/**
 * O tabuleiro aberto (seções 6.1 a 6.3).
 *
 * A câmera é de cada um (zoom e deslocamento), mas as posições dos tokens são as mesmas
 * para todos: ficam em coordenadas do mapa, e é a câmera que traduz para a tela. É isso que
 * faz três janelas de tamanhos diferentes mostrarem o mesmo tabuleiro.
 *
 * O mestre pode abrir um mapa **sem ativar** (6.1): `openMapId` é a tela dele, e
 * `activeMapId` é o que a mesa está vendo.
 *
 * Os desenhos (6.5) são do mapa, como os tokens: trocar de mapa troca os dois.
 */

export type BoardTool = 'select' | 'pan' | 'ruler' | 'draw' | 'erase'

/** Cor inicial do traço: vermelho, que aparece bem em quase todo mapa. */
export const DEFAULT_DRAW_COLOR = '#ef4444'

interface BoardState {
  sessionId: string | null
  role: SessionRole
  maps: BoardMap[]
  activeMapId: string | null
  /** Mapa desenhado agora. Para o jogador é sempre o ativo. */
  openMapId: string | null
  tokens: BoardToken[]
  /** Desenhos do mapa aberto, na ordem em que foram feitos. */
  drawings: Drawing[]
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

  /** Preferências do traço. Ficam entre uma mesa e outra (não voltam ao padrão ao abrir). */
  drawTool: DrawingTool
  drawColor: string
  strokeLevel: StrokeLevel

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
  reloadDrawings: () => Promise<void>
  /** Abre um mapa só para mim (o mestre preparando). */
  openMap: (mapId: string) => void

  setViewport: (viewport: Size) => void
  setTool: (tool: BoardTool) => void
  setDrawTool: (tool: DrawingTool) => void
  setDrawColor: (color: string) => void
  setStrokeLevel: (level: StrokeLevel) => void
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

  applyDrawingChange: (change: TableChange) => void
  /** Põe (ou troca, pelo id) um desenho: o otimista e o que voltou do banco. */
  upsertDrawing: (drawing: Drawing) => void
  removeDrawingsLocally: (ids: readonly string[]) => void
  /** "Apagar meus desenhos" ou "limpar todos" de alguém, pelo canal. */
  applyDrawingsCleared: (cleared: DrawingsCleared) => void
}

/** Quanto tempo uma posição vinda do canal vale, antes de o token voltar ao que o banco diz. */
const GHOST_TIMEOUT_MS = 2500

const ghostTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearGhostTimers(): void {
  for (const timer of ghostTimers.values()) clearTimeout(timer)
  ghostTimers.clear()
}

/**
 * Desenhos já apagados nesta tela. O INSERT de um traço desfeito enquanto gravava (ou um
 * INSERT atrasado que chega depois do DELETE) não pode ressuscitá-lo. O id é um UUID que
 * nunca volta, então lembrar dele até fechar a mesa não tem efeito colateral.
 */
const erasedDrawings = new Set<string>()

const emptyState = {
  sessionId: null,
  role: 'player' as SessionRole,
  maps: [],
  activeMapId: null,
  openMapId: null,
  tokens: [],
  drawings: [],
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

  async function loadDrawings(mapId: string | null): Promise<void> {
    if (mapId === null) {
      set({ drawings: [] })
      return
    }
    try {
      const drawings = await listDrawings(mapId)
      if (get().openMapId === mapId) set({ drawings })
    } catch (error) {
      console.warn('Não consegui carregar os desenhos:', errorMessage(error))
    }
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
    set({ openMapId: mapId, selection: [], dragging: {}, tokens: [], drawings: [] })
    clearGhostTimers()
    void loadTokens(mapId)
    void loadDrawings(mapId)
  }

  return {
    ...emptyState,
    drawTool: 'pencil',
    drawColor: DEFAULT_DRAW_COLOR,
    strokeLevel: 1,

    open: async ({ sessionId, role, activeMapId, scale }) => {
      clearGhostTimers()
      erasedDrawings.clear()
      useLiveStore.getState().reset()
      set({ ...emptyState, sessionId, role, activeMapId, scale, loading: true })

      try {
        const maps = await listMaps(sessionId)
        if (get().sessionId !== sessionId) return

        // O jogador só recebe o mapa ativo; o mestre começa vendo o ativo, se houver.
        const openId = activeMapId ?? (role === 'gm' ? (maps[0]?.id ?? null) : null)
        set({ maps, openMapId: openId, loading: false })
        await Promise.all([loadTokens(openId), loadDrawings(openId)])
      } catch (error) {
        if (get().sessionId === sessionId) {
          set({ loading: false, problem: errorMessage(error) })
        }
      }
    },

    close: () => {
      clearGhostTimers()
      erasedDrawings.clear()
      useLiveStore.getState().reset()
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

    reloadDrawings: async () => {
      await loadDrawings(get().openMapId)
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
    setDrawTool: (drawTool) => set({ drawTool, tool: 'draw' }),
    setDrawColor: (drawColor) => set({ drawColor }),
    setStrokeLevel: (strokeLevel) => set({ strokeLevel }),

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
    },

    applyDrawingChange: (change) => {
      if (change.event === 'DELETE') {
        // O DELETE chega só com o id (10.3).
        get().removeDrawingsLocally([String(change.old.id ?? '')])
        return
      }
      const drawing = drawingFromRow(change.row)
      if (drawing === null) return
      // O salvo toma o lugar do traço ao vivo que tinha o mesmo id.
      useLiveStore.getState().dropStroke(drawing.id)
      get().upsertDrawing(drawing)
    },

    upsertDrawing: (drawing) => {
      if (drawing.mapId !== get().openMapId || erasedDrawings.has(drawing.id)) return
      const drawings = get().drawings
      const index = drawings.findIndex((item) => item.id === drawing.id)
      set({
        drawings:
          index === -1
            ? [...drawings, drawing]
            : drawings.map((item) => (item.id === drawing.id ? drawing : item))
      })
    },

    removeDrawingsLocally: (ids) => {
      if (ids.length === 0) return
      for (const id of ids) erasedDrawings.add(id)
      const gone = new Set(ids)
      const drawings = get().drawings
      if (!drawings.some((drawing) => gone.has(drawing.id))) return
      set({ drawings: drawings.filter((drawing) => !gone.has(drawing.id)) })
    },

    applyDrawingsCleared: ({ mapId, authorId }) => {
      if (mapId !== get().openMapId) return
      set({
        drawings: get().drawings.filter(
          (drawing) => authorId !== null && drawing.authorId !== authorId
        )
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

import {
  lastDrawingBy,
  type BoardToken,
  type LiveStroke,
  type Point,
  type Reaction
} from '@/lib/board'
import {
  createDrawing,
  deleteAllDrawings,
  deleteDrawings,
  deleteMyDrawings
} from '@/lib/db/drawings'
import { useSessionStore } from '@/features/session/session-store'
import { useBoardStore } from './board-store'
import { useLiveStore } from './live-store'

/**
 * Desenho, régua, ping e reações (6.3 e 6.5): o que junta o banco, o canal e os stores.
 *
 * O traço é otimista: entra na tela ao soltar o botão e o banco confirma depois. Por isso
 * desfazer e apagar esperam a gravação em voo daquele traço — apagar antes de ele existir
 * no banco não apagaria nada.
 */

/** ~20 avisos por segundo, como o arrasto de token (10.3). */
const LIVE_INTERVAL_MS = 50

let lastStrokeAt = 0
let lastRulerAt = 0

const pendingSaves = new Map<string, Promise<unknown>>()

/** O id do traço nasce no app: é o mesmo no canal (ao vivo) e no banco (salvo). */
export function newDrawingId(): string {
  return crypto.randomUUID()
}

/**
 * O traço em andamento, para os outros verem enquanto ele é desenhado. `prepare` ajusta os
 * pontos antes de mandar (o lápis longo vai simplificado) e só roda quando o aviso sai de
 * fato — o mouse dispara bem mais eventos do que os ~20 por segundo que vão pelo canal.
 */
export function broadcastStroke(
  stroke: LiveStroke,
  prepare?: (points: number[]) => number[]
): void {
  const now = Date.now()
  if (now - lastStrokeAt < LIVE_INTERVAL_MS) return
  lastStrokeAt = now
  const points = prepare === undefined ? stroke.points : prepare(stroke.points)
  useSessionStore.getState().broadcast('draw-live', { ...stroke, points: [...points] })
}

/** O traço ao vivo não vai virar desenho (um clique sem arrastar, Esc). */
export function cancelStroke(id: string): void {
  useSessionStore.getState().broadcast('draw-end', { id })
}

/** Grava o traço terminado. Se o banco recusar, ele sai da tela de todos. */
export async function saveDrawing(stroke: LiveStroke): Promise<void> {
  const sessionId = useBoardStore.getState().sessionId
  if (sessionId === null) return

  useBoardStore.getState().upsertDrawing({ ...stroke, sessionId, createdAt: '' })
  const saving = createDrawing({
    id: stroke.id,
    sessionId,
    mapId: stroke.mapId,
    tool: stroke.tool,
    points: stroke.points,
    color: stroke.color,
    width: stroke.width
  })
  pendingSaves.set(stroke.id, saving)

  try {
    useBoardStore.getState().upsertDrawing(await saving)
  } catch (error) {
    useBoardStore.getState().removeDrawingsLocally([stroke.id])
    useSessionStore.getState().broadcast('draw-end', { id: stroke.id })
    throw error
  } finally {
    pendingSaves.delete(stroke.id)
  }
}

/** Espera a gravação em voo do traço, se houver. Diz se ele chegou ao banco. */
async function settled(id: string): Promise<boolean> {
  const pending = pendingSaves.get(id)
  if (pending === undefined) return true
  try {
    await pending
    return true
  } catch {
    return false
  }
}

/** Some com os traços da tela e do banco. Se o banco recusar, a tela volta ao que ele tem. */
async function removeDrawings(ids: readonly string[], remove: () => Promise<void>): Promise<void> {
  useBoardStore.getState().removeDrawingsLocally(ids)
  try {
    await Promise.all(ids.map(settled))
    await remove()
  } catch (error) {
    await useBoardStore.getState().reloadDrawings()
    throw error
  }
}

/** A borracha (6.5): apaga traços inteiros. A permissão já foi conferida em `erasableAt`. */
export async function eraseDrawings(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  // Um traço cuja gravação falhou não existe no banco; apagar o id dele não faz nada.
  await removeDrawings(ids, () => deleteDrawings(ids))
}

/** Ctrl+Z (6.5): apaga o meu traço mais recente deste mapa. Diz se havia algum. */
export async function undoLastDrawing(userId: string | null): Promise<boolean> {
  const last = lastDrawingBy(useBoardStore.getState().drawings, userId)
  if (last === null) return false
  await eraseDrawings([last.id])
  return true
}

/** "Apagar meus desenhos" do mapa aberto. */
export async function clearMyDrawings(userId: string): Promise<void> {
  const { openMapId, drawings } = useBoardStore.getState()
  if (openMapId === null) return
  const mine = drawings.filter((drawing) => drawing.authorId === userId).map((drawing) => drawing.id)

  await removeDrawings(mine, () => deleteMyDrawings(openMapId, userId))
  // Os DELETE chegam um a um; o aviso limpa a tela dos outros de uma vez.
  useSessionStore.getState().broadcast('drawings-cleared', { mapId: openMapId, authorId: userId })
}

/** "Limpar todos os desenhos" do mapa aberto (mestre). */
export async function clearAllDrawings(): Promise<void> {
  const { openMapId, drawings } = useBoardStore.getState()
  if (openMapId === null) return

  await removeDrawings(
    drawings.map((drawing) => drawing.id),
    () => deleteAllDrawings(openMapId)
  )
  useSessionStore.getState().broadcast('drawings-cleared', { mapId: openMapId, authorId: null })
}

/**
 * A régua para os outros (6.5). `to: null` é "soltei": sai sempre, sem esperar o intervalo,
 * senão a régua ficaria na tela dos outros até expirar.
 */
export function shareRuler(mapId: string, userId: string, from: Point, to: Point | null): void {
  const now = Date.now()
  if (to !== null && now - lastRulerAt < LIVE_INTERVAL_MS) return
  lastRulerAt = now
  useSessionStore.getState().broadcast('ruler', {
    userId,
    mapId,
    from: { x: from.x, y: from.y },
    to: to === null ? null : { x: to.x, y: to.y }
  })
}

/** Alt+clique (6.5): um pulso no ponto, para todos — inclusive para quem clicou. */
export function sendPing(mapId: string, userId: string, point: Point): void {
  useLiveStore.getState().addPing({ userId, mapId, point })
  useSessionStore.getState().broadcast('ping', { userId, mapId, x: point.x, y: point.y })
}

/** Reação com emoji sobre um token (6.3): animação curta, não fica salva. */
export function sendReaction(token: BoardToken, userId: string, emoji: Reaction): void {
  useLiveStore.getState().addReaction({ userId, mapId: token.mapId, tokenId: token.id, emoji })
  // Token oculto: a reação fica só nesta tela. Mandar pelo canal contaria aos jogadores
  // que existe alguma coisa ali (6.3).
  if (token.hidden) return
  useSessionStore
    .getState()
    .broadcast('reaction', { userId, mapId: token.mapId, tokenId: token.id, emoji })
}

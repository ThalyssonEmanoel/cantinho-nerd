import {
  findFreeSpot,
  nextZ,
  numberedName,
  snapToGrid,
  type BoardMap,
  type BoardToken,
  type Point,
  type TokenKind
} from '@/lib/board'
import type { TokenPatch } from '@/lib/db/board-rows'
import { copyAsset, mapImagePath, tokenImagePath, uploadAsset } from '@/lib/db/assets'
import { createMap } from '@/lib/db/maps'
import { createToken, deleteTokens, patchToken } from '@/lib/db/tokens'
import type { GalleryImage } from '@/lib/db/gallery'
import { MAX_MAP_SIDE, MAX_TOKEN_SIDE, prepareImageForUpload, validateImageFile } from '@/lib/image/upload'
import { useSessionStore } from '@/features/session/session-store'
import { useBoardStore } from './board-store'

/**
 * As ações do tabuleiro que juntam banco, Storage e canal (6.1 a 6.3).
 *
 * Fica fora dos componentes porque a mesma ação é disparada de lugares diferentes — o
 * menu do token, o atalho de teclado e o painel lateral — e porque o que acontece aqui tem
 * ordem: gravar, copiar arquivo, avisar pelo canal.
 */

/** ~20 avisos por segundo durante o arrasto (10.3). */
const DRAG_INTERVAL_MS = 50

const lastDragAt = new Map<string, number>()

/**
 * Posição ao vivo durante o arrasto. O token **oculto** não é transmitido: o jogador não
 * pode nem suspeitar que existe algo ali (6.3).
 */
export function broadcastDrag(token: BoardToken, point: Point): void {
  if (token.hidden) return

  const now = Date.now()
  if (now - (lastDragAt.get(token.id) ?? 0) < DRAG_INTERVAL_MS) return
  lastDragAt.set(token.id, now)

  useSessionStore.getState().broadcast('token-drag', { id: token.id, x: point.x, y: point.y })
}

/** O mestre leva a câmera de todos para um ponto do mapa (6.1). */
export function focusEveryone(point: Point): void {
  useSessionStore.getState().broadcast('camera-focus', { x: point.x, y: point.y })
}

/**
 * Altera um token.
 *
 * Quando ele **passa a oculto**, o aviso vai pelo canal: o UPDATE do banco não chega a
 * quem o RLS acabou de impedir de vê-lo, e sem isso o token ficaria parado na tela do
 * jogador para sempre.
 */
export async function applyTokenPatch(token: BoardToken, patch: TokenPatch): Promise<void> {
  const updated = await patchToken(token.id, patch)
  // Já aplica o que o banco devolveu: a tela não espera o evento do tempo real dar a volta.
  if (updated !== null) useBoardStore.getState().upsertToken(updated)

  if (patch.hidden === true && !token.hidden) {
    useSessionStore.getState().broadcast('token-gone', { id: token.id })
  }
}

/** Exclui tokens (seleção múltipla). Avisa pelo canal os que estavam ocultos. */
export async function removeTokens(tokens: readonly BoardToken[]): Promise<number> {
  const removed = await deleteTokens(tokens.map((token) => token.id))
  for (const token of tokens) useBoardStore.getState().removeTokenLocally(token.id)
  return removed
}

interface PlaceOptions {
  map: BoardMap
  /** Onde a pessoa quer o token (centro da visão, ou onde clicou). */
  desired: Point
  tokens: readonly BoardToken[]
}

function spotFor(options: PlaceOptions, size: number): Point {
  const { map, desired, tokens } = options
  const free = findFreeSpot(desired, {
    grid: map.grid,
    size,
    occupied: tokens.map((token) => ({ x: token.x, y: token.y, size: token.size })),
    map: { width: map.width, height: map.height }
  })
  return snapToGrid(free, map.grid, size)
}

/** O jogador coloca o próprio token, ligado à ficha dele (6.3). */
export async function placeMyToken(
  options: PlaceOptions & { sheetId: string | null; name: string }
): Promise<BoardToken> {
  const point = spotFor(options, 1)
  return createToken({
    sessionId: options.map.sessionId,
    mapId: options.map.id,
    kind: 'player',
    name: options.name,
    sheetId: options.sheetId,
    x: point.x,
    y: point.y,
    z: nextZ(options.tokens)
  })
}

/**
 * O mestre coloca um token a partir da galeria (seção 8).
 *
 * A imagem é **copiada** para a pasta da sessão: os jogadores leem os arquivos da mesa, mas
 * não a galeria do mestre — se o token apontasse para a galeria, a imagem não carregaria
 * para eles (e a galeria inteira ficaria exposta).
 */
export async function placeGalleryToken(
  options: PlaceOptions & { image: GalleryImage; hidden: boolean }
): Promise<BoardToken> {
  const { image, map } = options
  const hash = (image.imagePath.split('/').pop() ?? '').replace(/\.webp$/i, '')
  const destination = tokenImagePath(map.sessionId, hash)
  await copyAsset(image.imagePath, destination)

  const point = spotFor(options, image.tokenSize)
  const kind: TokenKind = image.kind

  return createToken({
    sessionId: map.sessionId,
    mapId: map.id,
    kind,
    // "Goblin 1", "Goblin 2"… continuando de onde parou.
    name: numberedName(image.name, options.tokens.map((token) => token.name)),
    imagePath: destination,
    size: image.tokenSize,
    hidden: options.hidden,
    x: point.x,
    y: point.y,
    z: nextZ(options.tokens)
  })
}

/** Token sem imagem nem ficha: um objeto, um marcador. */
export async function placeBlankToken(
  options: PlaceOptions & { kind: TokenKind; name: string; hidden: boolean }
): Promise<BoardToken> {
  const point = spotFor(options, 1)
  return createToken({
    sessionId: options.map.sessionId,
    mapId: options.map.id,
    kind: options.kind,
    name: options.name,
    hidden: options.hidden,
    x: point.x,
    y: point.y,
    z: nextZ(options.tokens)
  })
}

/** Envia a imagem e cria o mapa (6.1): WebP, maior lado de 4096 px. */
export async function addMapFromFile(
  sessionId: string,
  file: File,
  name: string
): Promise<BoardMap> {
  const problem = validateImageFile(file)
  if (problem !== null) throw new Error(problem)

  const prepared = await prepareImageForUpload(file, MAX_MAP_SIDE)
  const path = mapImagePath(sessionId, prepared.hash)
  await uploadAsset(path, prepared.blob)

  return createMap({
    sessionId,
    name,
    imagePath: path,
    width: prepared.width,
    height: prepared.height
  })
}

/** Envia a imagem de um token (6.3) e devolve o caminho no Storage. */
export async function uploadTokenImage(sessionId: string, file: File): Promise<string> {
  const problem = validateImageFile(file)
  if (problem !== null) throw new Error(problem)

  const prepared = await prepareImageForUpload(file, MAX_TOKEN_SIDE)
  const path = tokenImagePath(sessionId, prepared.hash)
  await uploadAsset(path, prepared.blob)
  return path
}

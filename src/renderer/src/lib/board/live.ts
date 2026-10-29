import {
  clampStrokeWidth,
  isDrawingTool,
  isHexColor,
  parsePointList,
  type DrawingTool
} from './drawing'
import type { Point } from './types'

/**
 * O que passa pelo canal da mesa sem ir para o banco (10.3): o traço em andamento, a régua,
 * o ping e as reações. Tudo isso vem do app de outra pessoa, então cada campo é conferido
 * antes de chegar à tela — um payload torto é ignorado, nunca derruba o tabuleiro.
 */

/** As reações da 6.3, nesta ordem na tela. */
export const REACTIONS = ['👍', '😮', '😱', '⚔️', '🎉', '💀', '✨', '❤️'] as const
export type Reaction = (typeof REACTIONS)[number]

export function isReaction(value: unknown): value is Reaction {
  return typeof value === 'string' && (REACTIONS as readonly string[]).includes(value)
}

/** Traço sendo desenhado agora por outra pessoa. O id é o mesmo que ele terá no banco. */
export interface LiveStroke {
  id: string
  mapId: string
  authorId: string
  tool: DrawingTool
  points: number[]
  color: string
  width: number
}

/** Régua de alguém; `to: null` é "soltou o botão, a régua sumiu". */
export interface RulerShare {
  userId: string
  mapId: string
  from: Point
  to: Point | null
}

export interface PingShare {
  userId: string
  mapId: string
  point: Point
}

export interface ReactionShare {
  userId: string
  mapId: string
  tokenId: string
  emoji: Reaction
}

/** "Apagar meus desenhos" (`authorId`) ou "limpar todos" (`authorId: null`). */
export interface DrawingsCleared {
  mapId: string
  authorId: string | null
}

type Payload = Record<string, unknown>

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' && value.length <= 64 ? value : null

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function point(value: unknown): Point | null {
  if (typeof value !== 'object' || value === null) return null
  const x = finite((value as Payload).x)
  const y = finite((value as Payload).y)
  return x === null || y === null ? null : { x, y }
}

export function parseLiveStroke(payload: Payload): LiveStroke | null {
  const id = text(payload.id)
  const mapId = text(payload.mapId)
  const authorId = text(payload.authorId)
  const width = finite(payload.width)
  // Ao vivo, o lápis pode ter um ponto só: o primeiro evento sai assim que o botão desce.
  const points = parsePointList(payload.points, 2)
  if (id === null || mapId === null || authorId === null || width === null || points === null) {
    return null
  }
  if (!isDrawingTool(payload.tool) || !isHexColor(payload.color)) return null
  return {
    id,
    mapId,
    authorId,
    tool: payload.tool,
    points,
    color: payload.color,
    width: clampStrokeWidth(width)
  }
}

export function parseRuler(payload: Payload): RulerShare | null {
  const userId = text(payload.userId)
  const mapId = text(payload.mapId)
  const from = point(payload.from)
  if (userId === null || mapId === null || from === null) return null
  const to = payload.to === null ? null : point(payload.to)
  if (to === null && payload.to !== null) return null
  return { userId, mapId, from, to }
}

export function parsePing(payload: Payload): PingShare | null {
  const userId = text(payload.userId)
  const mapId = text(payload.mapId)
  const at = point(payload)
  if (userId === null || mapId === null || at === null) return null
  return { userId, mapId, point: at }
}

export function parseReaction(payload: Payload): ReactionShare | null {
  const userId = text(payload.userId)
  const mapId = text(payload.mapId)
  const tokenId = text(payload.tokenId)
  if (userId === null || mapId === null || tokenId === null || !isReaction(payload.emoji)) {
    return null
  }
  return { userId, mapId, tokenId, emoji: payload.emoji }
}

export function parseDrawingsCleared(payload: Payload): DrawingsCleared | null {
  const mapId = text(payload.mapId)
  if (mapId === null) return null
  if (payload.authorId === null) return { mapId, authorId: null }
  const authorId = text(payload.authorId)
  return authorId === null ? null : { mapId, authorId }
}

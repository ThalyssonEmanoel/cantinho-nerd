import { metersToPixels } from './distance'
import { distanceToSegment, parsePointList, simplifyStroke } from './drawing'
import type { GridSettings, Point, SessionScale, Size } from './types'

/**
 * Névoa de guerra (6.4): o que cada mapa esconde dos jogadores.
 *
 * O mapa começa coberto. As áreas do mestre (retângulo e pincel, "revelar" ou "cobrir") são
 * aplicadas na ordem em que foram feitas — cobrir depois de revelar cobre de novo —, e por
 * cima de tudo os círculos de visão dos tokens dos jogadores revelam onde eles estão.
 *
 * A névoa é desenhada no app: para esconder de verdade, o mestre usa "ocultar" no token.
 */

export type FogMode = 'reveal' | 'cover'
export type FogShapeKind = 'rect' | 'brush'

export interface FogShape {
  mode: FogMode
  kind: FogShapeKind
  /** Retângulo: dois cantos. Pincel: o traço `[x1, y1, x2, y2, …]`. */
  points: number[]
  /** Raio do pincel, em pixels do mapa (0 no retângulo). */
  radius: number
}

export interface FogState {
  enabled: boolean
  shapes: FogShape[]
}

export const EMPTY_FOG: FogState = { enabled: false, shapes: [] }

/** Visão padrão da mesa, quando nem a ficha nem o token dizem (6.4). */
export const DEFAULT_VISION_M = 9

/** Teto de áreas num mapa: a coluna do banco aceita 256 KB. */
export const MAX_FOG_SHAPES = 400
export const MAX_FOG_BYTES = 250_000

/** Tamanhos do pincel, em quadrados da grade (raio). */
export const FOG_BRUSH_LEVELS = [0.5, 1, 2, 4] as const
export type FogBrushLevel = (typeof FOG_BRUSH_LEVELS)[number]

export interface VisionCircle {
  x: number
  y: number
  radius: number
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** A névoa do mapa, vinda do banco (jsonb) ou do tempo real. Forma estranha é descartada. */
export function parseFog(value: unknown): FogState {
  const raw = asObject(value)
  if (raw === null) return { ...EMPTY_FOG, shapes: [] }
  const shapes = Array.isArray(raw.shapes)
    ? raw.shapes.flatMap((item): FogShape[] => {
        const shape = asObject(item)
        if (shape === null) return []
        const mode = shape.mode === 'cover' ? 'cover' : shape.mode === 'reveal' ? 'reveal' : null
        const kind = shape.kind === 'brush' ? 'brush' : shape.kind === 'rect' ? 'rect' : null
        const points = parsePointList(shape.points, kind === 'brush' ? 2 : 4)
        if (mode === null || kind === null || points === null) return []
        const radius = typeof shape.radius === 'number' && Number.isFinite(shape.radius)
          ? Math.max(0, shape.radius)
          : 0
        if (kind === 'brush' && radius <= 0) return []
        return [{ mode, kind, points, radius }]
      })
    : []
  return { enabled: raw.enabled === true, shapes: shapes.slice(-MAX_FOG_SHAPES) }
}

export function fogToJson(fog: FogState): Record<string, unknown> {
  return {
    enabled: fog.enabled,
    shapes: fog.shapes.map((shape) => ({
      mode: shape.mode,
      kind: shape.kind,
      points: [...shape.points],
      radius: shape.radius
    }))
  }
}

/** Quanto a névoa ocupa no banco, para avisar antes de o banco recusar. */
export function fogBytes(fog: FogState): number {
  return JSON.stringify(fogToJson(fog)).length
}

/** A visão padrão de `sessions.settings.fog`. */
export function defaultVisionFromSettings(settings: unknown): number {
  const fog = asObject(asObject(settings)?.fog)
  const value = fog?.defaultVisionM
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VISION_M
  return Math.min(1000, Math.max(0, value))
}

function rectOf(points: readonly number[]): { x: number; y: number; width: number; height: number } {
  const [x1 = 0, y1 = 0, x2 = x1, y2 = y1] = points
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  }
}

export function pointInFogShape(point: Point, shape: FogShape): boolean {
  if (shape.kind === 'rect') {
    const rect = rectOf(shape.points)
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    )
  }
  const { points } = shape
  const count = points.length / 2
  if (count === 1) {
    return Math.hypot(point.x - (points[0] as number), point.y - (points[1] as number)) <= shape.radius
  }
  for (let index = 0; index < count - 1; index += 1) {
    const a = { x: points[index * 2] as number, y: points[index * 2 + 1] as number }
    const b = { x: points[index * 2 + 2] as number, y: points[index * 2 + 3] as number }
    if (distanceToSegment(point, a, b) <= shape.radius) return true
  }
  return false
}

/** O ponto está sob a névoa, para quem não é o mestre? */
export function isFogged(point: Point, fog: FogState, visions: readonly VisionCircle[]): boolean {
  if (!fog.enabled) return false
  if (visions.some((circle) => Math.hypot(point.x - circle.x, point.y - circle.y) <= circle.radius)) {
    return false
  }
  let covered = true
  for (const shape of fog.shapes) {
    if (pointInFogShape(point, shape)) covered = shape.mode === 'cover'
  }
  return covered
}

export interface VisionSource {
  kind: string
  x: number
  y: number
  size: number
  visionM: number | null
}

/**
 * Círculos de visão (6.4): um por token de jogador, centrado nele. O raio é a visão do
 * token (que vem do papel `vision` da ficha, ou do mestre) ou o padrão da mesa, em metros
 * convertidos pela escala — contado a partir da borda do token, então ele sempre enxerga o
 * próprio quadrado. Visão 0 não revela nada.
 */
export function visionCircles(
  tokens: readonly VisionSource[],
  grid: GridSettings,
  scale: SessionScale,
  defaultVisionM: number
): VisionCircle[] {
  return tokens.flatMap((token) => {
    if (token.kind !== 'player') return []
    const meters = token.visionM ?? defaultVisionM
    if (meters <= 0) return []
    const side = token.size * grid.size
    return [
      {
        x: token.x + side / 2,
        y: token.y + side / 2,
        radius: metersToPixels(meters, grid, scale) + side / 2
      }
    ]
  })
}

/**
 * O jogador vê este token? Token de jogador sempre (cada um revela a própria visão); os
 * outros — monstros, NPCs, objetos — só fora da névoa, pelo centro do token (6.4).
 */
export function tokenVisibleThroughFog(
  token: VisionSource,
  grid: GridSettings,
  fog: FogState,
  visions: readonly VisionCircle[]
): boolean {
  if (!fog.enabled || token.kind === 'player') return true
  const side = token.size * grid.size
  return !isFogged({ x: token.x + side / 2, y: token.y + side / 2 }, fog, visions)
}

/** A área cobre o mapa inteiro? Aí as anteriores não fazem mais diferença nenhuma. */
function coversWholeMap(shape: FogShape, map: Size): boolean {
  if (shape.kind !== 'rect') return false
  const rect = rectOf(shape.points)
  return rect.x <= 0 && rect.y <= 0 && rect.x + rect.width >= map.width && rect.y + rect.height >= map.height
}

/** Acrescenta uma área. Uma que cobre o mapa todo descarta as anteriores (o banco agradece). */
export function addFogShape(fog: FogState, shape: FogShape, map: Size): FogState {
  const shapes = coversWholeMap(shape, map) ? [shape] : [...fog.shapes, shape].slice(-MAX_FOG_SHAPES)
  return { ...fog, shapes }
}

export function undoFogShape(fog: FogState): FogState {
  return { ...fog, shapes: fog.shapes.slice(0, -1) }
}

/** "Revelar tudo": o mapa inteiro à vista (a névoa continua ligada, para cobrir de novo). */
export function revealAll(fog: FogState, map: Size): FogState {
  return {
    ...fog,
    shapes: [{ mode: 'reveal', kind: 'rect', points: [0, 0, map.width, map.height], radius: 0 }]
  }
}

/** "Cobrir tudo": volta ao começo, só a visão dos jogadores revela. */
export function coverAll(fog: FogState): FogState {
  return { ...fog, shapes: [] }
}

/** Uma casa decimal basta, e deixa o jsonb bem menor. */
function round(points: readonly number[]): number[] {
  return points.map((value) => Math.round(value * 10) / 10)
}

/**
 * A área terminada, ou null se não há o que gravar (um clique sem arrastar no retângulo).
 * O pincel é simplificado: o traço do mouse tem centenas de pontos que não mudam nada.
 */
export function finishFogShape(
  mode: FogMode,
  kind: FogShapeKind,
  points: readonly number[],
  radius: number,
  minSize: number
): FogShape | null {
  if (kind === 'rect') {
    if (points.length < 4) return null
    const rect = rectOf(points)
    if (rect.width < minSize || rect.height < minSize) return null
    return {
      mode,
      kind,
      points: round([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]),
      radius: 0
    }
  }
  if (points.length < 2 || radius <= 0) return null
  const simplified = points.length > 4 ? simplifyStroke(points, Math.max(minSize, radius * 0.15)) : [...points]
  return { mode, kind, points: round(simplified.slice(0, 4000)), radius: Math.round(radius * 10) / 10 }
}

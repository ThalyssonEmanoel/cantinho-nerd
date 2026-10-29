import type { GridSettings, Point } from './types'

/**
 * Desenhos no mapa (6.5): formato dos traços, simplificação do lápis e o teste da borracha.
 *
 * Tudo em coordenadas do mapa, como os tokens: o traço aparece no mesmo lugar e com a mesma
 * espessura (em relação ao mapa) em qualquer janela.
 */

export type DrawingTool = 'pencil' | 'line' | 'circle' | 'rect'

export const DRAWING_TOOLS: readonly DrawingTool[] = ['pencil', 'line', 'circle', 'rect']

export interface Drawing {
  id: string
  sessionId: string
  mapId: string
  authorId: string
  tool: DrawingTool
  /**
   * Lista plana `[x1, y1, x2, y2, …]`. Linha, círculo e retângulo têm dois pontos: início e
   * fim (no círculo, o centro e um ponto da borda).
   */
  points: number[]
  color: string
  /** Espessura em pixels do mapa. */
  width: number
  createdAt: string
}

/** Os limites do banco (`drawings_points`, `drawings_width`). */
export const MAX_POINT_VALUES = 4000
export const MIN_STROKE_WIDTH = 1
export const MAX_STROKE_WIDTH = 64

/** Espessuras oferecidas, da mais fina à mais grossa. */
export const STROKE_LEVELS = [0, 1, 2, 3] as const
export type StrokeLevel = (typeof STROKE_LEVELS)[number]

/** Fração do quadrado da grade que cada espessura ocupa. */
const STROKE_FRACTIONS: Record<StrokeLevel, number> = { 0: 0.03, 1: 0.06, 2: 0.12, 3: 0.24 }

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isDrawingTool(value: unknown): value is DrawingTool {
  return typeof value === 'string' && (DRAWING_TOOLS as readonly string[]).includes(value)
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function clampStrokeWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_STROKE_WIDTH
  return Math.min(MAX_STROKE_WIDTH, Math.max(MIN_STROKE_WIDTH, width))
}

/**
 * Espessura em pixels do mapa. Proporcional ao quadrado da grade, e não um número fixo de
 * pixels: num mapa grande (grade de 200 px) um traço de 4 px some, e num pequeno fica
 * grosso demais.
 */
export function strokeWidthFor(level: StrokeLevel, grid: GridSettings): number {
  const size = grid.size > 0 ? grid.size : 70
  return clampStrokeWidth(Math.round(size * STROKE_FRACTIONS[level]))
}

/**
 * Confere uma lista de pontos vinda de fora (banco ou canal). `min` é quantos números, no
 * mínimo: o traço salvo tem pelo menos dois pontos; o ao vivo pode ter um só.
 */
export function parsePointList(value: unknown, min = 4): number[] | null {
  if (!Array.isArray(value)) return null
  if (value.length < min || value.length > MAX_POINT_VALUES || value.length % 2 !== 0) return null
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null
  }
  return value as number[]
}

/** Pontos de uma forma de dois pontos (linha, círculo, retângulo). */
export function shapePoints(start: Point, end: Point): number[] {
  return [start.x, start.y, end.x, end.y]
}

/**
 * Acrescenta um ponto ao lápis, ignorando os que caem quase em cima do anterior — o mouse
 * manda dezenas de eventos por segundo, e a maioria não muda nada no traço.
 */
export function appendPoint(points: readonly number[], point: Point, minDistance: number): number[] {
  const length = points.length
  if (length >= 2) {
    const dx = point.x - (points[length - 2] as number)
    const dy = point.y - (points[length - 1] as number)
    if (Math.hypot(dx, dy) < minDistance) return points as number[]
  }
  return [...points, point.x, point.y]
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function pointAt(points: readonly number[], index: number): Point {
  return { x: points[index * 2] as number, y: points[index * 2 + 1] as number }
}

/**
 * Ramer–Douglas–Peucker: tira os pontos que não mudam o desenho em mais de `tolerance`.
 * Um traço de lápis de alguns segundos cai de centenas de pontos para algumas dezenas.
 * Iterativo, para um traço enorme não estourar a pilha.
 */
export function simplifyStroke(points: readonly number[], tolerance: number): number[] {
  const count = points.length / 2
  if (count <= 2) return [...points]

  const keep = new Array<boolean>(count).fill(false)
  keep[0] = true
  keep[count - 1] = true
  const stack: Array<[number, number]> = [[0, count - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    const a = pointAt(points, first)
    const b = pointAt(points, last)
    let farthest = -1
    let farthestDistance = tolerance

    for (let index = first + 1; index < last; index += 1) {
      const distance = distanceToSegment(pointAt(points, index), a, b)
      if (distance > farthestDistance) {
        farthest = index
        farthestDistance = distance
      }
    }

    if (farthest !== -1) {
      keep[farthest] = true
      stack.push([first, farthest], [farthest, last])
    }
  }

  const result: number[] = []
  keep.forEach((kept, index) => {
    if (kept) result.push(points[index * 2] as number, points[index * 2 + 1] as number)
  })
  return result
}

/** Uma casa decimal basta para coordenadas do mapa e deixa o jsonb bem menor. */
function roundPoints(points: readonly number[]): number[] {
  return points.map((value) => Math.round(value * 10) / 10)
}

/**
 * O que gravar ao terminar o traço, ou `null` se não há o que gravar (um clique sem
 * arrastar na linha, no círculo ou no retângulo).
 *
 * `minSize` vem do zoom de quem desenha: dois pixels de tela, convertidos para o mapa.
 */
export function finishStroke(
  tool: DrawingTool,
  points: readonly number[],
  minSize: number
): number[] | null {
  if (points.length < 2 || points.length % 2 !== 0) return null

  if (tool === 'pencil') {
    // Um clique sem arrastar vira um ponto: o traço de comprimento zero com ponta redonda.
    if (points.length === 2) {
      const [x, y] = points as [number, number]
      return roundPoints([x, y, x + 0.1, y])
    }

    let tolerance = minSize * 0.3
    let simplified = simplifyStroke(points, tolerance)
    // Traço longo demais para o banco: simplifica mais, até caber.
    while (simplified.length > MAX_POINT_VALUES) {
      tolerance *= 2
      simplified = simplifyStroke(points, tolerance)
    }
    return roundPoints(simplified)
  }

  if (points.length < 4) return null
  const start = pointAt(points, 0)
  const end = pointAt(points, points.length / 2 - 1)
  if (Math.hypot(end.x - start.x, end.y - start.y) < minSize) return null
  return roundPoints(shapePoints(start, end))
}

/** Raio do círculo: do centro (primeiro ponto) até a borda (segundo). */
export function circleRadius(points: readonly number[]): number {
  const [cx = 0, cy = 0, ex = cx, ey = cy] = points
  return Math.hypot(ex - cx, ey - cy)
}

/** Retângulo normalizado (largura e altura positivas) a partir dos dois cantos. */
export function rectFromPoints(points: readonly number[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const [x1 = 0, y1 = 0, x2 = x1, y2 = y1] = points
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  }
}

function polylineDistance(points: readonly number[], point: Point): number {
  const count = points.length / 2
  if (count === 1) return Math.hypot(point.x - (points[0] as number), point.y - (points[1] as number))
  let best = Infinity
  for (let index = 0; index < count - 1; index += 1) {
    best = Math.min(best, distanceToSegment(point, pointAt(points, index), pointAt(points, index + 1)))
  }
  return best
}

/**
 * A borracha (raio `radius`, centro `point`) toca este traço? Retângulo e círculo são só o
 * contorno: clicar no meio de um círculo vazio não apaga, como numa folha de papel.
 */
export function drawingHit(drawing: Pick<Drawing, 'tool' | 'points' | 'width'>, point: Point, radius: number): boolean {
  const reach = radius + drawing.width / 2
  const { points } = drawing

  switch (drawing.tool) {
    case 'pencil':
    case 'line':
      return polylineDistance(points, point) <= reach
    case 'circle': {
      const center = pointAt(points, 0)
      const distance = Math.hypot(point.x - center.x, point.y - center.y)
      return Math.abs(distance - circleRadius(points)) <= reach
    }
    case 'rect': {
      const rect = rectFromPoints(points)
      const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height }
      ] as const
      return corners.some(
        (corner, index) =>
          distanceToSegment(point, corner, corners[(index + 1) % 4] as Point) <= reach
      )
    }
  }
}

/**
 * Pontos de teste entre duas posições do mouse. Um movimento rápido salta dezenas de
 * pixels de um evento para o outro, e a borracha passaria por cima de um traço sem tocá-lo.
 */
export function samplesAlong(from: Point, to: Point, step: number): Point[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const count = step > 0 ? Math.min(200, Math.ceil(distance / step)) : 0
  const samples: Point[] = []
  for (let index = 1; index <= count; index += 1) {
    const t = index / count
    samples.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return samples.length === 0 ? [to] : samples
}

/** O jogador apaga só os seus; o mestre, qualquer um (6.5). */
export function canEraseDrawing(
  drawing: Pick<Drawing, 'authorId'>,
  role: 'gm' | 'player',
  userId: string | null
): boolean {
  return role === 'gm' || (userId !== null && drawing.authorId === userId)
}

/** Ids dos traços que a borracha tocou e que esta pessoa pode apagar. */
export function erasableAt(
  drawings: readonly Drawing[],
  points: readonly Point[],
  radius: number,
  role: 'gm' | 'player',
  userId: string | null
): string[] {
  return drawings
    .filter(
      (drawing) =>
        canEraseDrawing(drawing, role, userId) &&
        points.some((point) => drawingHit(drawing, point, radius))
    )
    .map((drawing) => drawing.id)
}

/**
 * O meu traço mais recente (Ctrl+Z, 6.5). Pela ordem da lista, que é a de criação: o
 * otimista entra no fim antes de o banco devolver o `created_at`.
 */
export function lastDrawingBy(drawings: readonly Drawing[], userId: string | null): Drawing | null {
  if (userId === null) return null
  for (let index = drawings.length - 1; index >= 0; index -= 1) {
    const drawing = drawings[index] as Drawing
    if (drawing.authorId === userId) return drawing
  }
  return null
}

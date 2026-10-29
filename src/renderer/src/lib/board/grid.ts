import {
  DEFAULT_GRID,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  type GridSettings,
  type Point,
  type Rect,
  type Size
} from './types'

/**
 * Grade do mapa (6.2): só o mestre configura, e todos veem igual.
 *
 * O deslocamento existe para alinhar a grade com a que já está desenhada na imagem do
 * mapa — sem ele, nenhum mapa comprado na internet encaixaria.
 */

export function normalizeGrid(grid: Partial<GridSettings> | null | undefined): GridSettings {
  const base = grid ?? {}
  const size = clampGridSize(base.size ?? DEFAULT_GRID.size)
  return {
    enabled: base.enabled ?? DEFAULT_GRID.enabled,
    size,
    // O deslocamento só faz sentido dentro de um quadrado: 71 com quadrado de 70 é 1.
    offsetX: wrapOffset(base.offsetX ?? 0, size),
    offsetY: wrapOffset(base.offsetY ?? 0, size),
    color: typeof base.color === 'string' && base.color !== '' ? base.color : DEFAULT_GRID.color,
    opacity: Math.min(1, Math.max(0, base.opacity ?? DEFAULT_GRID.opacity))
  }
}

export function clampGridSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_GRID.size
  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, size))
}

function wrapOffset(offset: number, size: number): number {
  if (!Number.isFinite(offset)) return 0
  const wrapped = offset % size
  return wrapped < 0 ? wrapped + size : wrapped
}

/**
 * Encaixa o canto do token na grade (6.3). Um token de tamanho inteiro cai no canto do
 * quadrado; um de meio quadrado cai no meio dele, que é onde ele fica bonito.
 */
export function snapToGrid(point: Point, grid: GridSettings, tokenSize = 1): Point {
  if (!grid.enabled) return point

  const step = grid.size * Math.min(1, tokenSize)
  return {
    x: snapAxis(point.x, grid.offsetX, step),
    y: snapAxis(point.y, grid.offsetY, step)
  }
}

function snapAxis(value: number, offset: number, step: number): number {
  if (step <= 0) return value
  return offset + Math.round((value - offset) / step) * step
}

/** Centro do token, em coordenadas do mapa. */
export function tokenCenter(
  token: { x: number; y: number; size: number },
  grid: GridSettings
): Point {
  const side = token.size * grid.size
  return { x: token.x + side / 2, y: token.y + side / 2 }
}

export function tokenRect(token: { x: number; y: number; size: number }, grid: GridSettings): Rect {
  const side = token.size * grid.size
  return { x: token.x, y: token.y, width: side, height: side }
}

/** Quadrado da grade onde o ponto caiu. */
export function cellAt(point: Point, grid: GridSettings): { col: number; row: number } {
  return {
    col: Math.floor((point.x - grid.offsetX) / grid.size),
    row: Math.floor((point.y - grid.offsetY) / grid.size)
  }
}

export function cellOrigin(cell: { col: number; row: number }, grid: GridSettings): Point {
  return { x: grid.offsetX + cell.col * grid.size, y: grid.offsetY + cell.row * grid.size }
}

/**
 * As linhas da grade dentro do pedaço visível do mapa.
 *
 * Só o visível: num mapa de 4096 px com quadrado de 20, desenhar tudo seriam 400 linhas a
 * cada quadro, e o tabuleiro tem que aguentar 60 fps (Fase 13).
 */
export function gridLines(
  grid: GridSettings,
  map: Size,
  view: Rect
): { vertical: number[]; horizontal: number[] } {
  if (!grid.enabled || grid.size < MIN_GRID_SIZE) return { vertical: [], horizontal: [] }

  return {
    vertical: linesOnAxis(grid.offsetX, grid.size, view.x, view.x + view.width, map.width),
    horizontal: linesOnAxis(grid.offsetY, grid.size, view.y, view.y + view.height, map.height)
  }
}

function linesOnAxis(
  offset: number,
  step: number,
  from: number,
  to: number,
  limit: number
): number[] {
  const start = Math.max(0, Math.min(from, limit))
  const end = Math.max(0, Math.min(to, limit))
  if (end <= start) return []

  const first = Math.ceil((start - offset) / step)
  const last = Math.floor((end - offset) / step)
  const lines: number[] = []

  // Teto de segurança: zoom muito afastado com quadrado minúsculo não pode travar a tela.
  for (let index = first; index <= last && lines.length < 2000; index += 1) {
    lines.push(offset + index * step)
  }
  return lines
}

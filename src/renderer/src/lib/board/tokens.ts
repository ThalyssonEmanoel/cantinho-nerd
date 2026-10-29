import { cellAt, cellOrigin, tokenRect } from './grid'
import {
  MAX_TOKEN_SIZE,
  MIN_TOKEN_SIZE,
  type BarValue,
  type BoardToken,
  type GridSettings,
  type Point,
  type Rect,
  type TokenBars
} from './types'

/** Regras dos tokens que não dependem de desenho nem de banco (6.3). */

export function clampTokenSize(size: number): number {
  if (!Number.isFinite(size)) return 1
  return Math.min(MAX_TOKEN_SIZE, Math.max(MIN_TOKEN_SIZE, size))
}

/** Próxima camada livre: é o "trazer para frente". */
export function nextZ(tokens: readonly BoardToken[]): number {
  return tokens.reduce((highest, token) => Math.max(highest, token.z), 0) + 1
}

/** Ordem de desenho: camada, e o id como desempate para ficar estável entre as janelas. */
export function byDrawOrder(a: BoardToken, b: BoardToken): number {
  return a.z === b.z ? a.id.localeCompare(b.id) : a.z - b.z
}

export function barPercent(bar: BarValue | undefined): number {
  if (bar === undefined || bar.max <= 0) return 0
  return Math.min(1, Math.max(0, bar.current / bar.max))
}

/** Verde acima de 50%, amarela acima de 25%, vermelha embaixo (6.3). */
export function hpColor(bar: BarValue | undefined): string {
  const percent = barPercent(bar)
  if (percent > 0.5) return '#4ade80'
  if (percent > 0.25) return '#facc15'
  return '#f87171'
}

/** Barras que o token mostra, na ordem: vida primeiro. */
export function visibleBars(bars: TokenBars): { key: 'hp' | 'bar2' | 'bar3'; bar: BarValue }[] {
  const order: ('hp' | 'bar2' | 'bar3')[] = ['hp', 'bar2', 'bar3']
  return order.flatMap((key) => {
    const bar = bars[key]
    return bar === undefined || bar.max <= 0 ? [] : [{ key, bar }]
  })
}

function overlaps(a: Rect, b: Rect): boolean {
  // Toque na borda não conta como sobreposição: dois tokens vizinhos encostam.
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  )
}

export interface FreeSpotOptions {
  grid: GridSettings
  size: number
  /** Tokens que já estão no mapa. */
  occupied: readonly { x: number; y: number; size: number }[]
  /** Limite do mapa, para não colocar token fora da imagem. */
  map?: { width: number; height: number }
}

/**
 * Quadrado livre mais perto de um ponto (seção 8: "em grade, sem sobreposição").
 *
 * Procura em anéis ao redor do ponto, então o token cai o mais perto possível de onde se
 * pediu. Serve para colocar um token da galeria, e na Fase 10 para puxar os jogadores e
 * spawnar encontros.
 */
export function findFreeSpot(desired: Point, options: FreeSpotOptions): Point {
  const { grid, occupied, map } = options
  const size = clampTokenSize(options.size)
  const start = cellAt(desired, grid)
  const span = Math.max(1, Math.ceil(size))

  for (let radius = 0; radius <= 40; radius += 1) {
    for (const cell of ring(start, radius)) {
      const origin = cellOrigin(cell, grid)
      const rect = tokenRect({ ...origin, size }, grid)

      if (map !== undefined) {
        const outside =
          rect.x < 0 ||
          rect.y < 0 ||
          rect.x + rect.width > map.width + grid.size * (span - size) ||
          rect.y + rect.height > map.height + grid.size * (span - size)
        if (outside) continue
      }

      const taken = occupied.some((other) => overlaps(rect, tokenRect(other, grid)))
      if (!taken) return origin
    }
  }

  return cellOrigin(start, grid)
}

/** Os quadrados a uma distância exata do centro, em espiral quadrada. */
function ring(center: { col: number; row: number }, radius: number): { col: number; row: number }[] {
  if (radius === 0) return [center]

  const cells: { col: number; row: number }[] = []
  for (let offset = -radius; offset <= radius; offset += 1) {
    cells.push({ col: center.col + offset, row: center.row - radius })
    cells.push({ col: center.col + offset, row: center.row + radius })
  }
  for (let offset = -radius + 1; offset <= radius - 1; offset += 1) {
    cells.push({ col: center.col - radius, row: center.row + offset })
    cells.push({ col: center.col + radius, row: center.row + offset })
  }
  return cells
}

/**
 * Nome com numeração automática: "Goblin 1", "Goblin 2"… continuando de onde parou
 * (seção 8). O construtor de encontros da Fase 10 usa isto.
 */
export function numberedName(base: string, existing: readonly string[]): string {
  const clean = base.trim()
  if (clean === '') return ''

  const pattern = new RegExp(`^${escapeForRegExp(clean)} (\\d+)$`)
  const highest = existing.reduce((top, name) => {
    const match = pattern.exec(name.trim())
    return match === null ? top : Math.max(top, Number(match[1]))
  }, 0)

  return `${clean} ${highest + 1}`
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

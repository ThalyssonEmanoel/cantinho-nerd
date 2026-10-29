import { formatMeters, squaresBetween } from './distance'
import { cellAt, cellOrigin } from './grid'
import type { GridSettings, Point, SessionScale } from './types'

/**
 * Régua (6.5): mede em metros pela escala e pela regra de diagonal da mesa.
 */

/**
 * Ponta da régua. Com a grade ligada, vai para o centro do quadrado — é assim que se conta
 * distância entre dois tokens no tabuleiro. `free` (Shift) mede de ponto a ponto.
 */
export function rulerPoint(point: Point, grid: GridSettings, free: boolean): Point {
  if (free || !grid.enabled || grid.size <= 0) return point
  const origin = cellOrigin(cellAt(point, grid), grid)
  return { x: origin.x + grid.size / 2, y: origin.y + grid.size / 2 }
}

export interface Measurement {
  squares: number
  meters: number
}

export function measure(
  from: Point,
  to: Point,
  grid: GridSettings,
  scale: SessionScale
): Measurement {
  const squares = squaresBetween(from, to, grid, scale.diagonal)
  return { squares, meters: squares * scale.metersPerSquare }
}

/** "3 quadrados", "1 quadrado", "2,4 quadrados". */
export function formatSquares(squares: number): string {
  const rounded = Math.round(squares * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
  return `${text} ${rounded === 1 ? 'quadrado' : 'quadrados'}`
}

/** O texto da régua: "4,5 m · 3 quadrados". */
export function rulerLabel(measurement: Measurement): string {
  return `${formatMeters(measurement.meters)} · ${formatSquares(measurement.squares)}`
}

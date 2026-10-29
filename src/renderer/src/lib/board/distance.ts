import { DEFAULT_SCALE, type DiagonalRule, type GridSettings, type Point, type SessionScale } from './types'

/**
 * Distância em quadrados e em metros (6.2).
 *
 * A régua da Fase 8 e o alcance da névoa da Fase 11 saem daqui; a conta em quadrados é a
 * mesma, muda só a regra de diagonal que a mesa escolheu.
 */

export function normalizeScale(scale: Partial<SessionScale> | null | undefined): SessionScale {
  const meters = scale?.metersPerSquare
  const diagonal = scale?.diagonal
  return {
    metersPerSquare:
      typeof meters === 'number' && Number.isFinite(meters) && meters > 0
        ? Math.min(100, meters)
        : DEFAULT_SCALE.metersPerSquare,
    diagonal: isDiagonalRule(diagonal) ? diagonal : DEFAULT_SCALE.diagonal
  }
}

function isDiagonalRule(value: unknown): value is DiagonalRule {
  return value === 'simple' || value === 'alternating' || value === 'real'
}

/** Distância em quadrados entre dois pontos do mapa, pela regra da mesa. */
export function squaresBetween(
  from: Point,
  to: Point,
  grid: GridSettings,
  rule: DiagonalRule
): number {
  const size = grid.size > 0 ? grid.size : 1
  const dx = Math.abs(to.x - from.x) / size
  const dy = Math.abs(to.y - from.y) / size
  const longer = Math.max(dx, dy)
  const shorter = Math.min(dx, dy)

  switch (rule) {
    case 'real':
      return Math.hypot(dx, dy)
    case 'alternating':
      // 1-2-1: a cada duas diagonais, uma custa dobrado.
      return longer + Math.floor(shorter / 2)
    case 'simple':
      return longer
  }
}

export function metersBetween(
  from: Point,
  to: Point,
  grid: GridSettings,
  scale: SessionScale
): number {
  return squaresBetween(from, to, grid, scale.diagonal) * scale.metersPerSquare
}

/** Raio em pixels do mapa, a partir de um alcance em metros (névoa, área). */
export function metersToPixels(meters: number, grid: GridSettings, scale: SessionScale): number {
  if (scale.metersPerSquare <= 0) return 0
  return (meters / scale.metersPerSquare) * grid.size
}

/** "4,5 m" — com uma casa só quando precisa. */
export function formatMeters(meters: number): string {
  const rounded = Math.round(meters * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
  return `${text} m`
}

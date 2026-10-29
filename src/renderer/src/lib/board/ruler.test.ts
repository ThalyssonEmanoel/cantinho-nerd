import { describe, expect, it } from 'vitest'
import { formatSquares, measure, rulerLabel, rulerPoint } from './ruler'
import { DEFAULT_GRID, type GridSettings, type SessionScale } from './types'

const grid: GridSettings = { ...DEFAULT_GRID, enabled: true, size: 50, offsetX: 0, offsetY: 0 }

describe('rulerPoint', () => {
  it('vai para o centro do quadrado com a grade ligada', () => {
    expect(rulerPoint({ x: 12, y: 80 }, grid, false)).toEqual({ x: 25, y: 75 })
  })

  it('respeita o deslocamento da grade', () => {
    expect(rulerPoint({ x: 12, y: 12 }, { ...grid, offsetX: 10, offsetY: 10 }, false)).toEqual({
      x: 35,
      y: 35
    })
  })

  it('mede livre com Shift ou com a grade desligada', () => {
    expect(rulerPoint({ x: 12, y: 80 }, grid, true)).toEqual({ x: 12, y: 80 })
    expect(rulerPoint({ x: 12, y: 80 }, { ...grid, enabled: false }, false)).toEqual({
      x: 12,
      y: 80
    })
  })
})

describe('measure', () => {
  const from = { x: 25, y: 25 }
  // 4 quadrados para a direita e 2 para baixo.
  const to = { x: 225, y: 125 }

  it('usa a escala e a regra de diagonal da mesa', () => {
    const simple: SessionScale = { metersPerSquare: 1.5, diagonal: 'simple' }
    expect(measure(from, to, grid, simple)).toEqual({ squares: 4, meters: 6 })

    const alternating: SessionScale = { metersPerSquare: 1.5, diagonal: 'alternating' }
    expect(measure(from, to, grid, alternating)).toEqual({ squares: 5, meters: 7.5 })

    const real: SessionScale = { metersPerSquare: 1.5, diagonal: 'real' }
    expect(measure(from, to, grid, real).squares).toBeCloseTo(Math.hypot(4, 2))
  })
})

describe('texto da régua', () => {
  it('metros e quadrados, no singular quando é um', () => {
    expect(formatSquares(1)).toBe('1 quadrado')
    expect(formatSquares(2.44)).toBe('2,4 quadrados')
    expect(rulerLabel({ squares: 3, meters: 4.5 })).toBe('4,5 m · 3 quadrados')
  })
})

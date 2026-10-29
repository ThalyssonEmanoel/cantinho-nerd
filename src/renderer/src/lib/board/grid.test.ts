import { describe, expect, it } from 'vitest'
import { formatMeters, metersBetween, metersToPixels, normalizeScale, squaresBetween } from './distance'
import { cellAt, cellOrigin, gridLines, normalizeGrid, snapToGrid, tokenCenter } from './grid'
import { DEFAULT_GRID, type GridSettings } from './types'

const grid: GridSettings = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }

describe('normalizeGrid', () => {
  it('completa o que falta e limita o tamanho do quadrado', () => {
    expect(normalizeGrid({ size: 2 }).size).toBe(8)
    expect(normalizeGrid({ size: 9999 }).size).toBe(600)
    expect(normalizeGrid(null)).toEqual(DEFAULT_GRID)
  })

  it('o deslocamento vive dentro de um quadrado', () => {
    // Deslocar 71 numa grade de 70 é o mesmo que deslocar 1.
    expect(normalizeGrid({ size: 70, offsetX: 71 }).offsetX).toBe(1)
    expect(normalizeGrid({ size: 70, offsetX: -1 }).offsetX).toBe(69)
  })

  it('opacidade fica entre 0 e 1', () => {
    expect(normalizeGrid({ opacity: 5 }).opacity).toBe(1)
    expect(normalizeGrid({ opacity: -5 }).opacity).toBe(0)
  })
})

describe('encaixe na grade', () => {
  it('leva o token para o canto do quadrado mais perto', () => {
    expect(snapToGrid({ x: 124, y: 76 }, grid)).toEqual({ x: 100, y: 100 })
  })

  it('respeita o deslocamento da grade do mapa', () => {
    const shifted = { ...grid, offsetX: 10, offsetY: 20 }
    expect(snapToGrid({ x: 58, y: 64 }, shifted)).toEqual({ x: 60, y: 70 })
  })

  it('token de meio quadrado encaixa no meio', () => {
    expect(snapToGrid({ x: 20, y: 20 }, grid, 0.5)).toEqual({ x: 25, y: 25 })
  })

  it('com a grade desligada, o token fica onde foi solto', () => {
    const off = { ...grid, enabled: false }
    expect(snapToGrid({ x: 124, y: 76 }, off)).toEqual({ x: 124, y: 76 })
  })
})

describe('quadrados', () => {
  it('encontra o quadrado de um ponto e a origem dele', () => {
    expect(cellAt({ x: 149, y: 51 }, grid)).toEqual({ col: 2, row: 1 })
    expect(cellOrigin({ col: 2, row: 1 }, grid)).toEqual({ x: 100, y: 50 })
  })

  it('o centro do token depende do tamanho dele', () => {
    expect(tokenCenter({ x: 100, y: 100, size: 2 }, grid)).toEqual({ x: 150, y: 150 })
  })
})

describe('linhas da grade', () => {
  it('desenha só o que está visível', () => {
    const lines = gridLines(grid, { width: 1000, height: 1000 }, {
      x: 100,
      y: 100,
      width: 200,
      height: 100
    })
    expect(lines.vertical).toEqual([100, 150, 200, 250, 300])
    expect(lines.horizontal).toEqual([100, 150, 200])
  })

  it('não passa da borda do mapa', () => {
    const lines = gridLines(grid, { width: 120, height: 120 }, {
      x: -500,
      y: -500,
      width: 2000,
      height: 2000
    })
    expect(lines.vertical).toEqual([0, 50, 100])
    expect(lines.horizontal).toEqual([0, 50, 100])
  })

  it('grade desligada não desenha nada', () => {
    const lines = gridLines({ ...grid, enabled: false }, { width: 100, height: 100 }, {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    expect(lines.vertical).toEqual([])
  })
})

describe('distância (6.2)', () => {
  const from = { x: 0, y: 0 }

  it('simples: a diagonal custa um quadrado', () => {
    expect(squaresBetween(from, { x: 200, y: 200 }, grid, 'simple')).toBe(4)
    expect(squaresBetween(from, { x: 200, y: 50 }, grid, 'simple')).toBe(4)
  })

  it('alternada: a segunda diagonal custa dobrado', () => {
    expect(squaresBetween(from, { x: 50, y: 50 }, grid, 'alternating')).toBe(1)
    expect(squaresBetween(from, { x: 100, y: 100 }, grid, 'alternating')).toBe(3)
    expect(squaresBetween(from, { x: 200, y: 200 }, grid, 'alternating')).toBe(6)
  })

  it('real: distância em linha reta', () => {
    expect(squaresBetween(from, { x: 150, y: 200 }, grid, 'real')).toBeCloseTo(5, 6)
  })

  it('converte para metros pela escala da mesa', () => {
    const scale = normalizeScale({ metersPerSquare: 1.5, diagonal: 'simple' })
    expect(metersBetween(from, { x: 200, y: 0 }, grid, scale)).toBeCloseTo(6, 6)
    expect(metersToPixels(3, grid, scale)).toBeCloseTo(100, 6)
  })

  it('escala estragada volta para o padrão', () => {
    expect(normalizeScale({ metersPerSquare: 0 })).toEqual({
      metersPerSquare: 1.5,
      diagonal: 'simple'
    })
    expect(normalizeScale({ diagonal: 'esquisito' } as never).diagonal).toBe('simple')
  })

  it('metros saem legíveis', () => {
    expect(formatMeters(6)).toBe('6 m')
    expect(formatMeters(4.5)).toBe('4,5 m')
    expect(formatMeters(4.54)).toBe('4,5 m')
  })
})

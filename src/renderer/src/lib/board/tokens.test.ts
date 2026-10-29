import { describe, expect, it } from 'vitest'
import { parseTokenCrop, tokenSourceRect } from './token-image'
import {
  barPercent,
  byDrawOrder,
  clampTokenSize,
  findFreeSpot,
  hpColor,
  nextZ,
  numberedName,
  visibleBars
} from './tokens'
import { DEFAULT_GRID, DEFAULT_TOKEN_CROP, type BoardToken, type GridSettings } from './types'

const grid: GridSettings = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }

function token(partial: Partial<BoardToken> & { id: string }): BoardToken {
  return {
    sessionId: 's',
    mapId: 'm',
    sheetId: null,
    kind: 'monster',
    ownerId: 'u',
    name: '',
    imagePath: null,
    crop: DEFAULT_TOKEN_CROP,
    x: 0,
    y: 0,
    size: 1,
    z: 0,
    hidden: false,
    showName: true,
    showBars: true,
    visionM: null,
    bars: {},
    conditions: [],
    ...partial
  }
}

describe('tamanho e camada', () => {
  it('limita o tamanho a valores que cabem no mapa', () => {
    expect(clampTokenSize(0.1)).toBe(0.5)
    expect(clampTokenSize(99)).toBe(10)
    expect(clampTokenSize(Number.NaN)).toBe(1)
  })

  it('trazer para frente vai para cima de todos', () => {
    expect(nextZ([token({ id: 'a', z: 3 }), token({ id: 'b', z: 7 })])).toBe(8)
    expect(nextZ([])).toBe(1)
  })

  it('a ordem de desenho é igual em todas as janelas', () => {
    const list = [token({ id: 'b', z: 1 }), token({ id: 'a', z: 1 }), token({ id: 'c', z: 0 })]
    expect([...list].sort(byDrawOrder).map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('barras (6.3)', () => {
  it('a cor da vida segue a porcentagem', () => {
    expect(hpColor({ current: 10, max: 10 })).toBe('#4ade80')
    expect(hpColor({ current: 4, max: 10 })).toBe('#facc15')
    expect(hpColor({ current: 2, max: 10 })).toBe('#f87171')
    expect(hpColor(undefined)).toBe('#f87171')
  })

  it('porcentagem não passa dos limites', () => {
    expect(barPercent({ current: 99, max: 10 })).toBe(1)
    expect(barPercent({ current: -5, max: 10 })).toBe(0)
    expect(barPercent({ current: 1, max: 0 })).toBe(0)
  })

  it('mostra só as barras que o modelo tem, vida primeiro', () => {
    const bars = visibleBars({ bar2: { current: 1, max: 2 }, hp: { current: 3, max: 4 } })
    expect(bars.map((item) => item.key)).toEqual(['hp', 'bar2'])
  })

  it('barra sem máximo não aparece', () => {
    expect(visibleBars({ hp: { current: 0, max: 0 } })).toEqual([])
  })
})

describe('lugar livre no mapa', () => {
  it('usa o quadrado pedido quando está vazio', () => {
    expect(findFreeSpot({ x: 120, y: 80 }, { grid, size: 1, occupied: [] })).toEqual({
      x: 100,
      y: 50
    })
  })

  it('desvia para o vizinho quando o quadrado está ocupado', () => {
    const spot = findFreeSpot(
      { x: 120, y: 80 },
      { grid, size: 1, occupied: [{ x: 100, y: 50, size: 1 }] }
    )
    expect(spot).not.toEqual({ x: 100, y: 50 })
    // Fica num quadrado vizinho, não longe.
    expect(Math.abs(spot.x - 100)).toBeLessThanOrEqual(50)
    expect(Math.abs(spot.y - 50)).toBeLessThanOrEqual(50)
  })

  it('token grande não cai em cima de outro', () => {
    const occupied = [
      { x: 0, y: 0, size: 1 },
      { x: 50, y: 0, size: 1 },
      { x: 0, y: 50, size: 1 }
    ]
    const spot = findFreeSpot({ x: 10, y: 10 }, { grid, size: 2, occupied })
    const overlapping = occupied.some(
      (other) =>
        spot.x < other.x + other.size * grid.size &&
        other.x < spot.x + 2 * grid.size &&
        spot.y < other.y + other.size * grid.size &&
        other.y < spot.y + 2 * grid.size
    )
    expect(overlapping).toBe(false)
  })

  it('não passa da borda do mapa', () => {
    const spot = findFreeSpot(
      { x: 480, y: 480 },
      { grid, size: 1, occupied: [], map: { width: 500, height: 500 } }
    )
    expect(spot.x + grid.size).toBeLessThanOrEqual(500)
    expect(spot.y + grid.size).toBeLessThanOrEqual(500)
  })
})

describe('numeração automática (seção 8)', () => {
  it('continua de onde parou', () => {
    expect(numberedName('Goblin', [])).toBe('Goblin 1')
    expect(numberedName('Goblin', ['Goblin 1', 'Goblin 2'])).toBe('Goblin 3')
    expect(numberedName('Goblin', ['Goblin 2', 'Lobo 9'])).toBe('Goblin 3')
  })

  it('nome com caractere especial não vira expressão regular', () => {
    expect(numberedName('Lobo (alfa)', ['Lobo (alfa) 1'])).toBe('Lobo (alfa) 2')
  })
})

describe('recorte da imagem do token', () => {
  it('o padrão pega a imagem inteira no lado menor', () => {
    const rect = tokenSourceRect(DEFAULT_TOKEN_CROP, { width: 400, height: 200 })
    expect(rect.sw).toBeCloseTo(200, 6)
    expect(rect.sh).toBeCloseTo(200, 6)
    expect(rect.sx).toBeCloseTo(100, 6)
    expect(rect.sy).toBeCloseTo(0, 6)
  })

  it('o recorte é proporcional: não depende do tamanho desenhado', () => {
    const crop = { zoom: 2, offsetX: 0.1, offsetY: -0.05 }
    const small = tokenSourceRect(crop, { width: 400, height: 400 })
    const same = tokenSourceRect(crop, { width: 400, height: 400 })
    expect(small).toEqual(same)
    expect(small.sw).toBeCloseTo(200, 6)
  })

  it('jsonb estragado não quebra o tabuleiro', () => {
    expect(parseTokenCrop(null)).toEqual(DEFAULT_TOKEN_CROP)
    expect(parseTokenCrop('{}')).toEqual(DEFAULT_TOKEN_CROP)
    expect(parseTokenCrop({ zoom: 'muito' })).toEqual(DEFAULT_TOKEN_CROP)
    // Zoom e deslocamento fora do permitido voltam para dentro.
    expect(parseTokenCrop({ zoom: 99, offsetX: 99 }).zoom).toBe(4)
    expect(parseTokenCrop({ zoom: 99, offsetX: 99 }).offsetX).toBeLessThanOrEqual(1.5)
  })
})

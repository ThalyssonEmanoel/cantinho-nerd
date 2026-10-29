import { describe, expect, it } from 'vitest'
import {
  addFogShape,
  coverAll,
  defaultVisionFromSettings,
  DEFAULT_VISION_M,
  finishFogShape,
  fogBytes,
  isFogged,
  parseFog,
  pointInFogShape,
  revealAll,
  tokenVisibleThroughFog,
  undoFogShape,
  visionCircles,
  type FogShape,
  type FogState
} from './fog'
import { DEFAULT_GRID, type GridSettings, type SessionScale } from './types'

const grid: GridSettings = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }
const scale: SessionScale = { metersPerSquare: 1.5, diagonal: 'simple' }
const map = { width: 1000, height: 1000 }

const reveal = (x1: number, y1: number, x2: number, y2: number): FogShape => ({
  mode: 'reveal',
  kind: 'rect',
  points: [x1, y1, x2, y2],
  radius: 0
})

describe('o que está sob a névoa', () => {
  it('desligada, nada; ligada, tudo começa coberto', () => {
    expect(isFogged({ x: 10, y: 10 }, { enabled: false, shapes: [] }, [])).toBe(false)
    expect(isFogged({ x: 10, y: 10 }, { enabled: true, shapes: [] }, [])).toBe(true)
  })

  it('as áreas valem na ordem: cobrir depois de revelar cobre de novo', () => {
    const fog: FogState = {
      enabled: true,
      shapes: [reveal(0, 0, 500, 500), { ...reveal(100, 100, 200, 200), mode: 'cover' }]
    }
    expect(isFogged({ x: 50, y: 50 }, fog, [])).toBe(false)
    expect(isFogged({ x: 150, y: 150 }, fog, [])).toBe(true)
    expect(isFogged({ x: 600, y: 600 }, fog, [])).toBe(true)
  })

  it('o pincel revela em volta do traço', () => {
    const brush: FogShape = { mode: 'reveal', kind: 'brush', points: [0, 0, 100, 0], radius: 20 }
    expect(pointInFogShape({ x: 50, y: 15 }, brush)).toBe(true)
    expect(pointInFogShape({ x: 50, y: 25 }, brush)).toBe(false)
  })

  it('a visão dos jogadores revela por cima de tudo, até de área coberta', () => {
    const fog: FogState = { enabled: true, shapes: [{ ...reveal(0, 0, 1000, 1000), mode: 'cover' }] }
    const visions = [{ x: 500, y: 500, radius: 100 }]
    expect(isFogged({ x: 550, y: 500 }, fog, visions)).toBe(false)
    expect(isFogged({ x: 700, y: 500 }, fog, visions)).toBe(true)
  })
})

describe('círculos de visão', () => {
  const player = { kind: 'player', x: 100, y: 100, size: 1, visionM: 3 }

  it('do token do jogador, em metros pela escala, a partir da borda', () => {
    // 3 m = 2 quadrados de 50 px = 100 px, mais meio token (25).
    expect(visionCircles([player], grid, scale, 9)).toEqual([{ x: 125, y: 125, radius: 125 }])
  })

  it('sem valor no token vale o padrão da mesa; visão 0 não revela; monstro não revela', () => {
    expect(visionCircles([{ ...player, visionM: null }], grid, scale, 1.5)[0]?.radius).toBe(75)
    expect(visionCircles([{ ...player, visionM: 0 }], grid, scale, 9)).toEqual([])
    expect(visionCircles([{ ...player, kind: 'monster' }], grid, scale, 9)).toEqual([])
  })

  it('monstro no escuro não aparece para o jogador; token de jogador sempre', () => {
    const fog: FogState = { enabled: true, shapes: [] }
    const visions = visionCircles([player], grid, scale, 9)
    const near = { kind: 'monster', x: 150, y: 100, size: 1, visionM: null }
    const far = { ...near, x: 800 }
    expect(tokenVisibleThroughFog(near, grid, fog, visions)).toBe(true)
    expect(tokenVisibleThroughFog(far, grid, fog, visions)).toBe(false)
    expect(tokenVisibleThroughFog({ ...far, kind: 'player' }, grid, fog, visions)).toBe(true)
    expect(tokenVisibleThroughFog(far, grid, { ...fog, enabled: false }, visions)).toBe(true)
  })
})

describe('editar a névoa', () => {
  it('área que cobre o mapa todo descarta as anteriores', () => {
    let fog: FogState = { enabled: true, shapes: [] }
    fog = addFogShape(fog, reveal(0, 0, 10, 10), map)
    fog = addFogShape(fog, reveal(20, 20, 30, 30), map)
    expect(fog.shapes).toHaveLength(2)
    fog = addFogShape(fog, { ...reveal(-5, -5, 1200, 1200), mode: 'cover' }, map)
    expect(fog.shapes).toHaveLength(1)
    expect(undoFogShape(fog).shapes).toEqual([])
  })

  it('revelar tudo e cobrir tudo', () => {
    const fog: FogState = { enabled: true, shapes: [reveal(0, 0, 10, 10)] }
    expect(isFogged({ x: 900, y: 900 }, revealAll(fog, map), [])).toBe(false)
    expect(coverAll(fog).shapes).toEqual([])
    expect(coverAll(fog).enabled).toBe(true)
  })

  it('retângulo de clique sem arrastar não grava; pincel é simplificado e arredondado', () => {
    expect(finishFogShape('reveal', 'rect', [10, 10, 11, 11], 0, 4)).toBeNull()
    expect(finishFogShape('reveal', 'rect', [100, 80, 20, 10], 0, 4)?.points).toEqual([20, 10, 100, 80])

    const points: number[] = []
    for (let x = 0; x <= 300; x += 1) points.push(x + 0.123, 50)
    const brush = finishFogShape('cover', 'brush', points, 25, 2)
    expect(brush?.points).toEqual([0.1, 50, 300.1, 50])
    expect(finishFogShape('cover', 'brush', [5, 5], 0, 2)).toBeNull()
  })
})

describe('do banco', () => {
  it('lê a névoa sem confiar nela', () => {
    const fog = parseFog({
      enabled: true,
      shapes: [
        reveal(0, 0, 10, 10),
        { mode: 'reveal', kind: 'brush', points: [1, 2], radius: 0 },
        { mode: 'spray', kind: 'rect', points: [0, 0, 1, 1] },
        'lixo'
      ]
    })
    expect(fog).toEqual({ enabled: true, shapes: [reveal(0, 0, 10, 10)] })
    expect(parseFog(null)).toEqual({ enabled: false, shapes: [] })
    expect(fogBytes(fog)).toBeGreaterThan(10)
  })

  it('visão padrão da mesa', () => {
    expect(defaultVisionFromSettings({ fog: { defaultVisionM: 18 } })).toBe(18)
    expect(defaultVisionFromSettings({})).toBe(DEFAULT_VISION_M)
    expect(defaultVisionFromSettings({ fog: { defaultVisionM: -4 } })).toBe(0)
  })
})

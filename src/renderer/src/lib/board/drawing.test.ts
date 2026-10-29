import { describe, expect, it } from 'vitest'
import {
  appendPoint,
  canEraseDrawing,
  circleRadius,
  distanceToSegment,
  drawingHit,
  erasableAt,
  finishStroke,
  lastDrawingBy,
  MAX_POINT_VALUES,
  parsePointList,
  rectFromPoints,
  samplesAlong,
  simplifyStroke,
  strokeWidthFor,
  type Drawing
} from './drawing'
import { DEFAULT_GRID, type GridSettings } from './types'

function drawing(partial: Partial<Drawing> & { id: string }): Drawing {
  return {
    sessionId: 's',
    mapId: 'm',
    authorId: 'bruno',
    tool: 'line',
    points: [0, 0, 100, 0],
    color: '#ef4444',
    width: 4,
    createdAt: '',
    ...partial
  }
}

describe('parsePointList', () => {
  it('aceita a lista plana de números', () => {
    expect(parsePointList([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
  })

  it('recusa o que o banco também recusaria', () => {
    expect(parsePointList([1, 2, 3])).toBeNull()
    expect(parsePointList([1, 2])).toBeNull()
    expect(parsePointList([1, 2, 'a', 4])).toBeNull()
    expect(parsePointList([1, 2, Number.NaN, 4])).toBeNull()
    expect(parsePointList({ x: 1 })).toBeNull()
    expect(parsePointList(new Array(MAX_POINT_VALUES + 2).fill(0))).toBeNull()
  })

  it('ao vivo, um ponto só já vale', () => {
    expect(parsePointList([5, 6], 2)).toEqual([5, 6])
  })
})

describe('strokeWidthFor', () => {
  it('acompanha o tamanho do quadrado', () => {
    const small: GridSettings = { ...DEFAULT_GRID, size: 70 }
    const big: GridSettings = { ...DEFAULT_GRID, size: 200 }
    expect(strokeWidthFor(1, small)).toBe(4)
    expect(strokeWidthFor(1, big)).toBe(12)
    expect(strokeWidthFor(0, small)).toBeLessThan(strokeWidthFor(3, small))
  })

  it('fica dentro dos limites do banco', () => {
    expect(strokeWidthFor(0, { ...DEFAULT_GRID, size: 10 })).toBe(1)
    expect(strokeWidthFor(3, { ...DEFAULT_GRID, size: 1000 })).toBe(64)
  })
})

describe('lápis', () => {
  it('ignora o ponto que cai em cima do anterior', () => {
    const points = appendPoint([0, 0], { x: 0.5, y: 0.5 }, 2)
    expect(points).toEqual([0, 0])
    expect(appendPoint(points, { x: 3, y: 0 }, 2)).toEqual([0, 0, 3, 0])
  })

  it('a simplificação tira os pontos de uma reta e mantém a curva', () => {
    const straight = [0, 0, 10, 0, 20, 0, 30, 0, 40, 0]
    expect(simplifyStroke(straight, 0.5)).toEqual([0, 0, 40, 0])

    const corner = [0, 0, 10, 0, 20, 0, 20, 10, 20, 20]
    expect(simplifyStroke(corner, 0.5)).toEqual([0, 0, 20, 0, 20, 20])
  })

  it('um clique sem arrastar vira um ponto', () => {
    expect(finishStroke('pencil', [10, 20], 2)).toEqual([10, 20, 10.1, 20])
  })

  it('arredonda para uma casa decimal', () => {
    expect(finishStroke('pencil', [0.123, 0.456, 50.987, 0.444], 2)).toEqual([0.1, 0.5, 51, 0.4])
  })

  it('um traço enorme é simplificado até caber no banco', () => {
    const points: number[] = []
    for (let index = 0; index < 5000; index += 1) {
      points.push(index, Math.sin(index / 3) * 40)
    }
    const saved = finishStroke('pencil', points, 0.1)
    expect(saved).not.toBeNull()
    expect((saved as number[]).length).toBeLessThanOrEqual(MAX_POINT_VALUES)
  })
})

describe('formas de dois pontos', () => {
  it('guardam o início e o fim', () => {
    expect(finishStroke('line', [0, 0, 5, 5, 30, 40], 2)).toEqual([0, 0, 30, 40])
    expect(finishStroke('rect', [10, 10, 50, 30], 2)).toEqual([10, 10, 50, 30])
  })

  it('um clique sem arrastar não grava nada', () => {
    expect(finishStroke('line', [10, 10, 10.5, 10], 2)).toBeNull()
    expect(finishStroke('circle', [10, 10], 2)).toBeNull()
  })

  it('círculo: centro e borda; retângulo: cantos em qualquer ordem', () => {
    expect(circleRadius([0, 0, 30, 40])).toBe(50)
    expect(rectFromPoints([50, 40, 10, 0])).toEqual({ x: 10, y: 0, width: 40, height: 40 })
  })
})

describe('borracha', () => {
  it('distância até um segmento', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
  })

  it('toca a linha perto dela, contando a espessura', () => {
    const line = drawing({ id: 'a', points: [0, 0, 100, 0], width: 10 })
    expect(drawingHit(line, { x: 50, y: 8 }, 4)).toBe(true)
    expect(drawingHit(line, { x: 50, y: 12 }, 4)).toBe(false)
  })

  it('círculo e retângulo só pelo contorno', () => {
    const circle = drawing({ id: 'c', tool: 'circle', points: [0, 0, 50, 0], width: 2 })
    expect(drawingHit(circle, { x: 0, y: 49 }, 2)).toBe(true)
    expect(drawingHit(circle, { x: 0, y: 0 }, 2)).toBe(false)

    const rect = drawing({ id: 'r', tool: 'rect', points: [0, 0, 100, 60], width: 2 })
    expect(drawingHit(rect, { x: 100, y: 30 }, 2)).toBe(true)
    expect(drawingHit(rect, { x: 50, y: 30 }, 2)).toBe(false)
  })

  it('um movimento rápido é testado no caminho todo', () => {
    const samples = samplesAlong({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(samples).toHaveLength(10)
    expect(samples.at(-1)).toEqual({ x: 100, y: 0 })
    expect(samplesAlong({ x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toEqual([{ x: 0, y: 0 }])
  })

  it('o jogador apaga só os seus; o mestre, qualquer um', () => {
    const mine = drawing({ id: 'meu', authorId: 'bruno' })
    const hers = drawing({ id: 'dela', authorId: 'carla' })
    expect(canEraseDrawing(hers, 'player', 'bruno')).toBe(false)
    expect(canEraseDrawing(hers, 'gm', 'ana')).toBe(true)
    expect(erasableAt([mine, hers], [{ x: 50, y: 0 }], 4, 'player', 'bruno')).toEqual(['meu'])
    expect(erasableAt([mine, hers], [{ x: 50, y: 0 }], 4, 'gm', 'ana')).toEqual(['meu', 'dela'])
  })
})

describe('Ctrl+Z', () => {
  it('pega o meu traço mais recente, pulando os dos outros', () => {
    const list = [
      drawing({ id: '1', authorId: 'bruno' }),
      drawing({ id: '2', authorId: 'bruno' }),
      drawing({ id: '3', authorId: 'carla' })
    ]
    expect(lastDrawingBy(list, 'bruno')?.id).toBe('2')
    expect(lastDrawingBy(list, 'davi')).toBeNull()
    expect(lastDrawingBy(list, null)).toBeNull()
  })
})

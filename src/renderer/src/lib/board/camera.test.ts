import { describe, expect, it } from 'vitest'
import {
  centerOn,
  clampCamera,
  fitToViewport,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  toScreen,
  toWorld,
  visibleRect,
  zoomAt,
  zoomByStep,
  type Camera
} from './camera'

const viewport = { width: 1000, height: 600 }
const map = { width: 2000, height: 1500 }

describe('conversão entre tela e mapa', () => {
  const camera: Camera = { x: 120, y: -40, scale: 1.5 }

  it('ida e volta devolve o mesmo ponto', () => {
    const world = { x: 317, y: 92 }
    const back = toWorld(camera, toScreen(camera, world))
    expect(back.x).toBeCloseTo(world.x, 10)
    expect(back.y).toBeCloseTo(world.y, 10)
  })

  it('o canto do mapa cai onde a câmera diz', () => {
    expect(toScreen(camera, { x: 0, y: 0 })).toEqual({ x: 120, y: -40 })
  })
})

describe('zoom', () => {
  it('mantém parado o ponto sob o cursor', () => {
    const camera: Camera = { x: 0, y: 0, scale: 1 }
    const cursor = { x: 300, y: 200 }
    const before = toWorld(camera, cursor)

    const zoomed = zoomAt(camera, cursor, 2)
    const after = toWorld(zoomed, cursor)

    expect(zoomed.scale).toBe(2)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('pelos botões, o ponto parado é o centro da janela', () => {
    const camera: Camera = { x: 0, y: 0, scale: 1 }
    const center = { x: viewport.width / 2, y: viewport.height / 2 }
    const before = toWorld(camera, center)

    const after = toWorld(zoomByStep(camera, viewport, 1.25), center)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('respeita os limites de aproximação', () => {
    const camera: Camera = { x: 0, y: 0, scale: 1 }
    expect(zoomAt(camera, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE)
    expect(zoomAt(camera, { x: 0, y: 0 }, 0.00001).scale).toBe(MIN_SCALE)
  })
})

describe('caber na tela', () => {
  it('mostra o mapa inteiro e centralizado', () => {
    const camera = fitToViewport(map, viewport, 20)
    const topLeft = toScreen(camera, { x: 0, y: 0 })
    const bottomRight = toScreen(camera, { x: map.width, y: map.height })

    expect(topLeft.x).toBeGreaterThanOrEqual(0)
    expect(topLeft.y).toBeGreaterThanOrEqual(0)
    expect(bottomRight.x).toBeLessThanOrEqual(viewport.width)
    expect(bottomRight.y).toBeLessThanOrEqual(viewport.height)

    // Sobra igual dos dois lados.
    expect(topLeft.x).toBeCloseTo(viewport.width - bottomRight.x, 6)
    expect(topLeft.y).toBeCloseTo(viewport.height - bottomRight.y, 6)
  })

  it('mapa sem tamanho não quebra a câmera', () => {
    expect(fitToViewport({ width: 0, height: 0 }, viewport)).toEqual({ x: 0, y: 0, scale: 1 })
  })
})

describe('focar num ponto', () => {
  it('deixa o ponto no centro da janela', () => {
    const camera = centerOn({ x: 800, y: 400 }, viewport, 2)
    const screen = toScreen(camera, { x: 800, y: 400 })
    expect(screen.x).toBeCloseTo(viewport.width / 2, 6)
    expect(screen.y).toBeCloseTo(viewport.height / 2, 6)
  })
})

describe('limites do arrasto', () => {
  it('centraliza o mapa menor que a janela', () => {
    const small = { width: 200, height: 100 }
    const camera = clampCamera({ x: 5000, y: -5000, scale: 1 }, small, viewport)
    expect(camera.x).toBe((viewport.width - small.width) / 2)
    expect(camera.y).toBe((viewport.height - small.height) / 2)
  })

  it('não deixa o mapa grande sumir da janela', () => {
    const camera = clampCamera({ x: 99999, y: 99999, scale: 1 }, map, viewport)
    const topLeft = toScreen(camera, { x: 0, y: 0 })
    // O canto do mapa não passa de uma margem para dentro da janela.
    expect(topLeft.x).toBeLessThanOrEqual(viewport.width * 0.3 + 0.001)
    expect(topLeft.y).toBeLessThanOrEqual(viewport.height * 0.3 + 0.001)
  })

  it('arrastar um pouco continua valendo', () => {
    const camera = clampCamera(panBy({ x: 0, y: 0, scale: 1 }, -100, -50), map, viewport)
    expect(camera.x).toBe(-100)
    expect(camera.y).toBe(-50)
  })
})

describe('pedaço visível', () => {
  it('é a janela convertida para coordenadas do mapa', () => {
    const camera: Camera = { x: -100, y: -200, scale: 2 }
    const rect = visibleRect(camera, viewport)

    expect(rect.x).toBe(50)
    expect(rect.y).toBe(100)
    expect(rect.width).toBe(viewport.width / 2)
    expect(rect.height).toBe(viewport.height / 2)
  })
})

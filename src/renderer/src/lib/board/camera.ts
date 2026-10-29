import type { Point, Size } from './types'

/**
 * Câmera de cada pessoa (6.1): zoom e deslocamento.
 *
 * É individual — cada um olha onde quiser —, mas as **posições** no mapa são sempre as
 * mesmas para todos, porque a câmera só traduz entre a tela e as coordenadas do mapa.
 *
 * `tela = mundo * scale + (x, y)`.
 */

export interface Camera {
  x: number
  y: number
  scale: number
}

export const MIN_SCALE = 0.05
export const MAX_SCALE = 8

/** Um passo dos botões +/−. A roda do mouse usa passos menores, proporcionais. */
export const ZOOM_STEP = 1.25

/** Quanto se pode arrastar o mapa para fora da janela, em fração da janela. */
const MARGIN_FRACTION = 0.3

export const IDENTITY_CAMERA: Camera = { x: 0, y: 0, scale: 1 }

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function toWorld(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }
}

export function toScreen(camera: Camera, world: Point): Point {
  return { x: world.x * camera.scale + camera.x, y: world.y * camera.scale + camera.y }
}

/**
 * Zoom mantendo parado o ponto que está sob o cursor (6.1). É o que faz a roda do mouse
 * parecer natural: a pessoa aproxima daquilo que está olhando, não do centro da tela.
 */
export function zoomAt(camera: Camera, screen: Point, factor: number): Camera {
  const scale = clampScale(camera.scale * factor)
  const world = toWorld(camera, screen)
  return { scale, x: screen.x - world.x * scale, y: screen.y - world.y * scale }
}

/** Zoom pelos botões: o ponto parado é o centro da janela. */
export function zoomByStep(camera: Camera, viewport: Size, factor: number): Camera {
  return zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, factor)
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/** "Caber na tela" (6.1): o mapa inteiro visível, centralizado. */
export function fitToViewport(map: Size, viewport: Size, padding = 24): Camera {
  if (map.width <= 0 || map.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return IDENTITY_CAMERA
  }

  const usable = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2)
  }
  const scale = clampScale(Math.min(usable.width / map.width, usable.height / map.height))

  return {
    scale,
    x: (viewport.width - map.width * scale) / 2,
    y: (viewport.height - map.height * scale) / 2
  }
}

/** Deixa um ponto do mapa no centro da janela (o "focar a câmera de todos", 6.1). */
export function centerOn(world: Point, viewport: Size, scale: number): Camera {
  const clamped = clampScale(scale)
  return {
    scale: clamped,
    x: viewport.width / 2 - world.x * clamped,
    y: viewport.height / 2 - world.y * clamped
  }
}

/**
 * Impede que o mapa seja arrastado para longe da janela. Quando o mapa é menor que a
 * janela num eixo, ele fica centralizado nesse eixo; quando é maior, dá para passar da
 * borda só um pedaço da janela, o bastante para mexer num token encostado no canto.
 */
export function clampCamera(camera: Camera, map: Size, viewport: Size): Camera {
  const scale = clampScale(camera.scale)
  const shown = { width: map.width * scale, height: map.height * scale }

  return {
    scale,
    x: clampAxis(camera.x, shown.width, viewport.width),
    y: clampAxis(camera.y, shown.height, viewport.height)
  }
}

function clampAxis(value: number, shown: number, viewport: number): number {
  if (shown <= viewport) return (viewport - shown) / 2

  const margin = viewport * MARGIN_FRACTION
  const min = viewport - shown - margin
  const max = margin
  return Math.min(max, Math.max(min, value))
}

/** Pedaço do mapa visível agora, em coordenadas do mapa (serve para só desenhar o visível). */
export function visibleRect(
  camera: Camera,
  viewport: Size
): { x: number; y: number; width: number; height: number } {
  const topLeft = toWorld(camera, { x: 0, y: 0 })
  const bottomRight = toWorld(camera, { x: viewport.width, y: viewport.height })
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  }
}

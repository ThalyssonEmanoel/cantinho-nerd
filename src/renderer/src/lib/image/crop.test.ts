import { describe, expect, it } from 'vitest'
import {
  clampCrop,
  coverScale,
  cropSourceRect,
  INITIAL_CROP,
  MAX_ZOOM,
  panBy,
  zoomTo
} from './crop'

const VIEWPORT = 256
const square = { width: 512, height: 512 }
const landscape = { width: 1000, height: 500 }

describe('cobertura', () => {
  it('a imagem cobre o quadro pelo lado menor', () => {
    expect(coverScale(square, VIEWPORT)).toBe(0.5)
    expect(coverScale(landscape, VIEWPORT)).toBeCloseTo(0.512)
  })

  it('sem zoom nem arrasto, o recorte de uma imagem quadrada é ela inteira', () => {
    expect(cropSourceRect(INITIAL_CROP, square, VIEWPORT)).toEqual({
      sx: 0,
      sy: 0,
      sw: 512,
      sh: 512
    })
  })

  it('numa imagem deitada, o recorte inicial é o quadrado do meio', () => {
    const rect = cropSourceRect(INITIAL_CROP, landscape, VIEWPORT)
    expect(rect.sx).toBeCloseTo(250)
    expect(rect.sy).toBeCloseTo(0)
    expect(rect.sw).toBeCloseTo(500)
  })
})

describe('arrastar', () => {
  it('para no limite: nunca aparece canto vazio', () => {
    const moved = panBy(INITIAL_CROP, 10_000, 0, landscape, VIEWPORT)
    expect(moved.offsetX).toBeCloseTo(128)
    // Arrastar a imagem para a direita mostra o lado esquerdo dela.
    expect(cropSourceRect(moved, landscape, VIEWPORT).sx).toBeCloseTo(0)
  })

  it('não anda na direção em que a imagem já cabe justa', () => {
    expect(panBy(INITIAL_CROP, 0, 50, landscape, VIEWPORT).offsetY).toBe(0)
  })
})

describe('zoom', () => {
  it('aproximar pega um pedaço menor da imagem', () => {
    const zoomed = zoomTo(INITIAL_CROP, 2, square, VIEWPORT)
    expect(cropSourceRect(zoomed, square, VIEWPORT)).toEqual({ sx: 128, sy: 128, sw: 256, sh: 256 })
  })

  it('fica entre 1 e o máximo', () => {
    expect(zoomTo(INITIAL_CROP, 0.2, square, VIEWPORT).zoom).toBe(1)
    expect(zoomTo(INITIAL_CROP, 99, square, VIEWPORT).zoom).toBe(MAX_ZOOM)
  })

  it('mantém parado o ponto do centro do quadro', () => {
    const panned = panBy(zoomTo(INITIAL_CROP, 2, square, VIEWPORT), 60, 0, square, VIEWPORT)
    const before = cropSourceRect(panned, square, VIEWPORT)
    const after = cropSourceRect(zoomTo(panned, 3, square, VIEWPORT), square, VIEWPORT)
    expect(after.sx + after.sw / 2).toBeCloseTo(before.sx + before.sw / 2)
  })

  it('afastar puxa o deslocamento de volta para dentro do limite', () => {
    const panned = panBy(zoomTo(INITIAL_CROP, 4, square, VIEWPORT), 1000, 1000, square, VIEWPORT)
    const back = clampCrop({ ...panned, zoom: 1 }, square, VIEWPORT)
    expect(back).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
  })
})

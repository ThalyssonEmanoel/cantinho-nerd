import { clampCrop, cropSourceRect, type CropState, type SourceRect } from '@/lib/image/crop'
import { DEFAULT_TOKEN_CROP, type Size, type TokenCrop } from './types'

/**
 * Reenquadrar a imagem dentro do token, sem reenviar o arquivo (6.3).
 *
 * O recorte é guardado **em frações** do lado do token, e não em pixels: o mesmo token é
 * desenhado com 40 px numa janela afastada e com 300 px no zoom, e o enquadramento
 * precisa ser o mesmo nos dois. A conta em si é a mesma do recorte do avatar (Fase 4).
 */

/** Do que está guardado no banco para o que o editor usa (pixels do quadro). */
export function toCropState(crop: TokenCrop, viewport: number): CropState {
  return {
    zoom: crop.zoom,
    offsetX: crop.offsetX * viewport,
    offsetY: crop.offsetY * viewport
  }
}

export function fromCropState(state: CropState, viewport: number): TokenCrop {
  if (viewport <= 0) return DEFAULT_TOKEN_CROP
  return {
    zoom: round(state.zoom),
    offsetX: round(state.offsetX / viewport),
    offsetY: round(state.offsetY / viewport)
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

/** Pedaço da imagem que aparece no token, em pixels da imagem original. */
export function tokenSourceRect(crop: TokenCrop, image: Size): SourceRect {
  // O lado do quadro é arbitrário: o recorte é proporcional, e 1000 dá precisão de sobra.
  const viewport = 1000
  return cropSourceRect(toCropState(crop, viewport), image, viewport)
}

/** Lê o `image_crop` do banco com tolerância: jsonb livre não pode quebrar o tabuleiro. */
export function parseTokenCrop(value: unknown): TokenCrop {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_TOKEN_CROP
  }

  const raw = value as Partial<Record<keyof TokenCrop, unknown>>
  const viewport = 1000
  const state = clampCrop(
    {
      zoom: numberOr(raw.zoom, 1),
      offsetX: numberOr(raw.offsetX, 0) * viewport,
      offsetY: numberOr(raw.offsetY, 0) * viewport
    },
    { width: viewport, height: viewport },
    viewport
  )

  return fromCropState(state, viewport)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function isDefaultCrop(crop: TokenCrop): boolean {
  return crop.zoom === 1 && crop.offsetX === 0 && crop.offsetY === 0
}

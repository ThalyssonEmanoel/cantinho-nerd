/**
 * Recorte de imagem num quadro (o avatar recortado em círculo, seção 9; depois, os tokens).
 *
 * O quadro tem lado `viewport` (pixels de tela). A imagem começa cobrindo o quadro inteiro
 * e pode ser aproximada (`zoom`) e arrastada (`offsetX/Y`, deslocamento do centro da
 * imagem em relação ao centro do quadro). A imagem sempre cobre o quadro: nunca sobra
 * canto vazio no recorte.
 */

export interface Size {
  width: number
  height: number
}

export interface CropState {
  /** 1 = a imagem só cobre o quadro; 4 = quatro vezes mais perto. */
  zoom: number
  offsetX: number
  offsetY: number
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export const INITIAL_CROP: CropState = { zoom: 1, offsetX: 0, offsetY: 0 }

/** Escala em que a imagem cobre o quadro inteiro, sem sobrar borda. */
export function coverScale(image: Size, viewport: number): number {
  if (image.width <= 0 || image.height <= 0) return 1
  return Math.max(viewport / image.width, viewport / image.height)
}

/** Tamanho da imagem na tela com o zoom atual. */
export function displayedSize(state: CropState, image: Size, viewport: number): Size {
  const scale = coverScale(image, viewport) * state.zoom
  return { width: image.width * scale, height: image.height * scale }
}

/** Limita zoom e deslocamento para a imagem continuar cobrindo o quadro. */
export function clampCrop(state: CropState, image: Size, viewport: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(state.zoom) ? state.zoom : 1))
  const shown = displayedSize({ ...state, zoom }, image, viewport)
  const maxX = Math.max(0, (shown.width - viewport) / 2)
  const maxY = Math.max(0, (shown.height - viewport) / 2)

  return {
    zoom,
    offsetX: Math.min(maxX, Math.max(-maxX, state.offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, state.offsetY))
  }
}

export function panBy(
  state: CropState,
  dx: number,
  dy: number,
  image: Size,
  viewport: number
): CropState {
  return clampCrop(
    { ...state, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy },
    image,
    viewport
  )
}

/**
 * Muda o zoom mantendo parado o ponto que está no centro do quadro — é o que a pessoa
 * espera ao mexer no controle: aproximar "para dentro" do que está vendo.
 */
export function zoomTo(state: CropState, zoom: number, image: Size, viewport: number): CropState {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const ratio = next / state.zoom
  return clampCrop(
    { zoom: next, offsetX: state.offsetX * ratio, offsetY: state.offsetY * ratio },
    image,
    viewport
  )
}

/** Pedaço da imagem original (em pixels dela) que está dentro do quadro. */
export function cropSourceRect(state: CropState, image: Size, viewport: number): SourceRect {
  const clamped = clampCrop(state, image, viewport)
  const scale = coverScale(image, viewport) * clamped.zoom
  const side = viewport / scale

  return {
    sx: image.width / 2 - (clamped.offsetX + viewport / 2) / scale,
    sy: image.height / 2 - (clamped.offsetY + viewport / 2) / scale,
    sw: side,
    sh: side
  }
}

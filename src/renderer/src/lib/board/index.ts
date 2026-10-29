/**
 * Tabuleiro (seções 6.1 a 6.3). Ponto único de entrada: o resto do app importa daqui.
 */
export * from './types'

export type { Camera } from './camera'
export {
  centerOn,
  clampCamera,
  clampScale,
  fitToViewport,
  IDENTITY_CAMERA,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  toScreen,
  toWorld,
  visibleRect,
  ZOOM_STEP,
  zoomAt,
  zoomByStep
} from './camera'

export {
  cellAt,
  cellOrigin,
  clampGridSize,
  gridLines,
  normalizeGrid,
  snapToGrid,
  tokenCenter,
  tokenRect
} from './grid'

export {
  formatMeters,
  metersBetween,
  metersToPixels,
  normalizeScale,
  squaresBetween
} from './distance'

export type { FreeSpotOptions } from './tokens'
export {
  barPercent,
  byDrawOrder,
  clampTokenSize,
  findFreeSpot,
  hpColor,
  nextZ,
  numberedName,
  visibleBars
} from './tokens'

export {
  fromCropState,
  isDefaultCrop,
  parseTokenCrop,
  toCropState,
  tokenSourceRect
} from './token-image'

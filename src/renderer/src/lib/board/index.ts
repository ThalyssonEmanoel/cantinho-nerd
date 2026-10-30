/**
 * Tabuleiro (seções 6.1 a 6.5). Ponto único de entrada: o resto do app importa daqui.
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

export type { ConditionDef, TokenCondition } from './conditions'
export {
  conditionKey,
  conditionListProblem,
  conditionsFromSettings,
  conditionsToSettings,
  DEFAULT_CONDITIONS,
  MAX_CONDITION_ICON,
  MAX_CONDITION_NAME,
  MAX_CONDITION_ROUNDS,
  MAX_CONDITIONS,
  normalizeRounds,
  parseTokenConditions,
  setConditionRounds,
  tickConditions,
  toggleCondition
} from './conditions'

export type { Drawing, DrawingTool, StrokeLevel } from './drawing'
export {
  appendPoint,
  canEraseDrawing,
  circleRadius,
  clampStrokeWidth,
  distanceToSegment,
  DRAWING_TOOLS,
  drawingHit,
  erasableAt,
  finishStroke,
  isDrawingTool,
  isHexColor,
  lastDrawingBy,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  parsePointList,
  rectFromPoints,
  samplesAlong,
  shapePoints,
  simplifyStroke,
  STROKE_LEVELS,
  strokeWidthFor
} from './drawing'

export type { ShortcutAction, ShortcutContext, ShortcutHelp } from './shortcuts'
export { isTypingTarget, SHORTCUTS, shortcutFor } from './shortcuts'

export type { Measurement } from './ruler'
export { formatSquares, measure, rulerLabel, rulerPoint } from './ruler'

export type {
  DrawingsCleared,
  LiveStroke,
  PingShare,
  Reaction,
  ReactionShare,
  RulerShare
} from './live'
export {
  isReaction,
  parseDrawingsCleared,
  parseLiveStroke,
  parsePing,
  parseReaction,
  parseRuler,
  REACTIONS
} from './live'

export type {
  FogBrushLevel,
  FogMode,
  FogShape,
  FogShapeKind,
  FogState,
  VisionCircle,
  VisionSource
} from './fog'
export {
  addFogShape,
  coverAll,
  DEFAULT_VISION_M,
  defaultVisionFromSettings,
  EMPTY_FOG,
  finishFogShape,
  FOG_BRUSH_LEVELS,
  fogBytes,
  fogToJson,
  isFogged,
  MAX_FOG_BYTES,
  parseFog,
  pointInFogShape,
  revealAll,
  tokenVisibleThroughFog,
  undoFogShape,
  visionCircles
} from './fog'

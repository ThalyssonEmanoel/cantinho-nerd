import {
  clampStrokeWidth,
  isDrawingTool,
  isHexColor,
  normalizeGrid,
  parseFog,
  parsePointList,
  parseTokenConditions,
  parseTokenCrop,
  type BarValue,
  type BoardMap,
  type BoardToken,
  type Drawing,
  type GridSettings,
  type TokenBars,
  type TokenCondition,
  type TokenKind
} from '@/lib/board'
import type { Json, TablesUpdate } from './database.types'

/**
 * Conversão entre as linhas de `maps`/`tokens`/`drawings` e os objetos do tabuleiro (6.1 a 6.5).
 * Separado do acesso ao banco para ser testado sem rede.
 *
 * Tudo que vem de `jsonb` passa por normalização: a grade e o recorte são livres no banco,
 * e um valor estranho não pode derrubar o tabuleiro.
 */

export interface MapRow {
  id: string
  session_id: string
  name: string
  image_path: string
  width: number
  height: number
  grid: Json
  /** Opcional: linhas lidas antes da Fase 11 não traziam a coluna. */
  fog?: Json
  sort_order: number
}

export interface TokenRow {
  id: string
  session_id: string
  map_id: string
  sheet_id: string | null
  kind: string
  owner_id: string
  name: string
  image_path: string | null
  image_crop: Json
  x: number
  y: number
  size: number
  z: number
  hidden: boolean
  show_name: boolean
  show_bars: boolean
  vision_m: number | null
  bars: Json
  /** Opcional: linhas lidas antes da Fase 9 não traziam a coluna. */
  conditions?: Json
}

function asObject(value: Json | undefined | null): Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {}
}

export function gridToJson(grid: GridSettings): Json {
  return { ...grid }
}

export function barsToJson(bars: TokenBars): Json {
  const json: Record<string, Json> = {}
  for (const [key, bar] of Object.entries(bars)) {
    if (bar !== undefined) json[key] = { current: bar.current, max: bar.max }
  }
  return json
}

export function gridFromJson(value: Json | null | undefined): GridSettings {
  const raw = asObject(value)
  return normalizeGrid({
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
    size: typeof raw.size === 'number' ? raw.size : undefined,
    offsetX: typeof raw.offsetX === 'number' ? raw.offsetX : undefined,
    offsetY: typeof raw.offsetY === 'number' ? raw.offsetY : undefined,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    opacity: typeof raw.opacity === 'number' ? raw.opacity : undefined
  })
}

export function mapFromRow(row: MapRow): BoardMap {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    imagePath: row.image_path,
    width: row.width,
    height: row.height,
    grid: gridFromJson(row.grid),
    fog: parseFog(row.fog),
    sortOrder: row.sort_order
  }
}

const TOKEN_KINDS: readonly TokenKind[] = ['player', 'monster', 'npc', 'object']

function asKind(value: string): TokenKind {
  return TOKEN_KINDS.includes(value as TokenKind) ? (value as TokenKind) : 'object'
}

/** Barras vindas da ficha (5.6). Barra sem número nenhum é descartada. */
export function barsFromJson(value: Json | null | undefined): TokenBars {
  const raw = asObject(value)
  const bars: TokenBars = {}

  for (const key of ['hp', 'bar2', 'bar3'] as const) {
    const bar = asObject(raw[key])
    const current = bar.current
    const max = bar.max
    if (typeof current !== 'number' || typeof max !== 'number') continue
    if (!Number.isFinite(current) || !Number.isFinite(max)) continue
    bars[key] = { current, max } satisfies BarValue
  }

  return bars
}

export function tokenFromRow(row: TokenRow): BoardToken {
  return {
    id: row.id,
    sessionId: row.session_id,
    mapId: row.map_id,
    sheetId: row.sheet_id,
    kind: asKind(row.kind),
    ownerId: row.owner_id,
    name: row.name,
    imagePath: row.image_path,
    crop: parseTokenCrop(row.image_crop),
    x: Number(row.x),
    y: Number(row.y),
    size: Number(row.size),
    z: Number(row.z),
    hidden: row.hidden,
    showName: row.show_name,
    showBars: row.show_bars,
    visionM: row.vision_m === null ? null : Number(row.vision_m),
    bars: barsFromJson(row.bars),
    conditions: parseTokenConditions(row.conditions)
  }
}

/** Campos do token que a tela altera, com os nomes do banco. */
export interface TokenPatch {
  name?: string
  imagePath?: string | null
  crop?: BoardToken['crop']
  x?: number
  y?: number
  size?: number
  z?: number
  hidden?: boolean
  showName?: boolean
  showBars?: boolean
  visionM?: number | null
  sheetId?: string | null
  mapId?: string
  /** Só o mestre: vida de um token **sem ficha** (6.3). Com ficha, quem manda é o gatilho. */
  bars?: TokenBars
  /** Condições (6.3): o mestre em qualquer token, o jogador nos próprios. */
  conditions?: TokenCondition[]
}

export function tokenPatchToRow(patch: TokenPatch): TablesUpdate<'tokens'> {
  const row: TablesUpdate<'tokens'> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.imagePath !== undefined) row.image_path = patch.imagePath
  if (patch.crop !== undefined) row.image_crop = { ...patch.crop }
  if (patch.x !== undefined) row.x = patch.x
  if (patch.y !== undefined) row.y = patch.y
  if (patch.size !== undefined) row.size = patch.size
  if (patch.z !== undefined) row.z = patch.z
  if (patch.hidden !== undefined) row.hidden = patch.hidden
  if (patch.showName !== undefined) row.show_name = patch.showName
  if (patch.showBars !== undefined) row.show_bars = patch.showBars
  if (patch.visionM !== undefined) row.vision_m = patch.visionM
  if (patch.sheetId !== undefined) row.sheet_id = patch.sheetId
  if (patch.mapId !== undefined) row.map_id = patch.mapId
  if (patch.bars !== undefined) row.bars = barsToJson(patch.bars)
  if (patch.conditions !== undefined) {
    row.conditions = patch.conditions.map((item) => ({
      key: item.key,
      name: item.name,
      icon: item.icon,
      rounds: item.rounds
    }))
  }
  return row
}

/**
 * Desenho (6.5). O banco já confere o formato, mas a linha também chega pelo tempo real e
 * vem do app de outra pessoa: o que não fecha é descartado em vez de quebrar o tabuleiro.
 */
export function drawingFromRow(row: Record<string, unknown>): Drawing | null {
  const points = parsePointList(row.points)
  if (
    typeof row.id !== 'string' ||
    typeof row.session_id !== 'string' ||
    typeof row.map_id !== 'string' ||
    typeof row.author_id !== 'string' ||
    !isDrawingTool(row.tool) ||
    !isHexColor(row.color) ||
    points === null
  ) {
    return null
  }

  // `real` pode chegar como texto, conforme o caminho (REST ou tempo real).
  const width = Number(row.width)
  return {
    id: row.id,
    sessionId: row.session_id,
    mapId: row.map_id,
    authorId: row.author_id,
    tool: row.tool,
    points,
    color: row.color,
    width: clampStrokeWidth(width),
    createdAt: typeof row.created_at === 'string' ? row.created_at : ''
  }
}

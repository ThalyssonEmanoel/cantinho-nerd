import {
  parseSheetRecord,
  type SheetRecord,
  type SheetSummaryRow,
  type SheetValues
} from '@/lib/sheet'
import type { Json } from './database.types'

/**
 * Conversão entre as linhas de `sheets`/`sheet_gm_data` e a ficha do app (5.7). Separado
 * do acesso ao banco para ser testado sem rede.
 *
 * A parte do mestre chega `null` para o jogador (o RLS nem devolve a linha): aí a ficha
 * fica sem `gmValues` e sem `orphaned`, exatamente como `projectSheetFor` montaria.
 */

export interface GmDataRow {
  values: Json
  computed: Json
  orphaned: Json
}

export interface SheetRow {
  id: string
  session_id: string
  owner_id: string
  template_id: string
  template_version: number
  template_name: string
  kind: string
  values: Json
  computed: Json
  summary: Json
  created_at: string
  updated_at: string
  owner: { display_name: string } | null
  sheet_gm_data: GmDataRow | null
}

function asObject(value: Json | undefined): Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {}
}

/** Ficha completa; linha corrompida vira `null` em vez de quebrar a tela. */
export function sheetFromRow(row: SheetRow): SheetRecord | null {
  const gm = row.sheet_gm_data
  return parseSheetRecord({
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    templateVersion: row.template_version,
    kind: row.kind,
    ownerName: row.owner?.display_name ?? '',
    ownerId: row.owner_id,
    sessionId: row.session_id,
    values: asObject(row.values),
    gmValues: asObject(gm?.values),
    computed: { ...asObject(row.computed), ...asObject(gm?.computed) },
    summary: { bars: {}, ...asObject(row.summary) },
    orphaned: asObject(gm?.orphaned),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export interface SheetListRow {
  id: string
  session_id: string
  owner_id: string
  template_id: string
  template_name: string
  template_version: number
  summary: Json
  updated_at: string
  owner: { display_name: string } | null
  session: { name: string } | null
}

export function summaryRowFromRow(row: SheetListRow): SheetSummaryRow {
  const summary = asObject(row.summary)
  const bars = asObject(summary.bars)
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    templateVersion: row.template_version,
    ownerName: row.owner?.display_name ?? '',
    name: typeof summary.name === 'string' ? summary.name : '',
    bars: bars as SheetSummaryRow['bars'],
    portrait: typeof summary.portrait === 'string' ? summary.portrait : null,
    updatedAt: row.updated_at,
    sessionId: row.session_id,
    sessionName: row.session?.name ?? '',
    ownerId: row.owner_id
  }
}

/** O que muda numa ficha aberta quando alguém grava (evento do tempo real). */
export interface RemoteSheetChange {
  sheetId: string
  values?: SheetValues
  gmValues?: SheetValues
  orphaned?: SheetValues
  templateVersion?: number
  updatedAt?: string
}

/** Linha nova de `sheets` vinda do tempo real → mudança para a ficha aberta. */
export function remoteChangeFromSheetRow(row: Record<string, unknown>): RemoteSheetChange | null {
  if (typeof row.id !== 'string') return null
  return {
    sheetId: row.id,
    values: asObject(row.values as Json) as SheetValues,
    ...(typeof row.template_version === 'number' ? { templateVersion: row.template_version } : {}),
    ...(typeof row.updated_at === 'string' ? { updatedAt: row.updated_at } : {})
  }
}

/** Linha nova de `sheet_gm_data` (só o mestre recebe) → mudança para a ficha aberta. */
export function remoteChangeFromGmRow(row: Record<string, unknown>): RemoteSheetChange | null {
  if (typeof row.sheet_id !== 'string') return null
  return {
    sheetId: row.sheet_id,
    gmValues: asObject(row.values as Json) as SheetValues,
    orphaned: asObject(row.orphaned as Json) as SheetValues
  }
}

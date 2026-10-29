import { clampTokenSize } from '@/lib/board'
import { parseGroups, type Creature, type Encounter } from '@/lib/bestiary'
import type { SheetValues } from '@/lib/sheet'

/**
 * Conversão entre as linhas de `creatures`/`encounters` e os objetos da tela (seção 8).
 * Separado do acesso ao banco para ser testado sem rede.
 */

type Row = Record<string, unknown>

function asValues(value: unknown): SheetValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SheetValues)
    : {}
}

export function creatureFromRow(row: Row): Creature | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.template_id !== 'string' ||
    typeof row.template_version !== 'number'
  ) {
    return null
  }
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    kind: row.kind === 'npc' ? 'npc' : 'monster',
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    templateId: row.template_id,
    templateVersion: row.template_version,
    values: asValues(row.values),
    imagePath: typeof row.image_path === 'string' && row.image_path !== '' ? row.image_path : null,
    tokenSize: clampTokenSize(Number(row.token_size ?? 1)),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : ''
  }
}

export function encounterFromRow(row: Row): Encounter | null {
  if (typeof row.id !== 'string') return null
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    groups: parseGroups(row.groups),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : ''
  }
}

/** O que `spawn_creatures` devolveu: [{ token_id, sheet_id }]. */
export function spawnResultsFromJson(value: unknown): Array<{ tokenId: string; sheetId: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as Row
    return typeof row.token_id === 'string' && typeof row.sheet_id === 'string'
      ? [{ tokenId: row.token_id, sheetId: row.sheet_id }]
      : []
  })
}

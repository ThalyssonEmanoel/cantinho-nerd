import type { Clue } from '@/lib/session/clues'

/**
 * Conversão entre a linha de `clues` e a pista do app (Fase 13). Separado do acesso ao
 * banco para ser testado sem rede — e porque a linha também chega pelo tempo real, de
 * onde vem `Record<string, unknown>` sem tipo nenhum.
 */

export interface ClueRow {
  id: string
  session_id: string
  title: string
  body: string
  image_path: string | null
  reveal_all: boolean
  revealed_to: string[] | null
  sort_order: number
  updated_at: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && UUID.test(item))
}

export function clueFromRow(row: ClueRow): Clue {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: typeof row.title === 'string' ? row.title : '',
    body: typeof row.body === 'string' ? row.body : '',
    imagePath: row.image_path,
    revealAll: row.reveal_all === true,
    revealedTo: asIdList(row.revealed_to),
    sortOrder: Number(row.sort_order) || 0,
    updatedAt: row.updated_at
  }
}

/** A mesma linha vinda do tempo real, onde nada tem tipo. `null` se não dá para usar. */
export function clueFromUnknown(row: Record<string, unknown>): Clue | null {
  if (typeof row.id !== 'string' || typeof row.session_id !== 'string') return null
  return clueFromRow(row as unknown as ClueRow)
}

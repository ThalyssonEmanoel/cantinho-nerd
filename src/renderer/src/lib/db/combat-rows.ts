import type { TokenKind } from '@/lib/board'
import type {
  CombatEntry,
  CombatLogEntry,
  CombatState,
  HpChangeKind,
  HpChangeResult
} from '@/lib/combat'
import { IDLE_COMBAT } from '@/lib/combat'

/**
 * Conversão entre as linhas do combate e os objetos da tela (7.3). Separado do acesso ao
 * banco para ser testado sem rede. As linhas chegam também pelo tempo real, onde `numeric`
 * pode vir como texto — por isso os números passam por `toNumber`.
 */

type Row = Record<string, unknown>

const TOKEN_KINDS: readonly TokenKind[] = ['player', 'monster', 'npc', 'object']

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export function combatStateFromRow(row: Row | null | undefined): CombatState {
  if (row === null || row === undefined || row.active !== true) return IDLE_COMBAT
  return {
    active: true,
    round: toNumber(row.round) ?? 1,
    turnEntryId: typeof row.turn_entry_id === 'string' ? row.turn_entry_id : null
  }
}

export function combatEntryFromRow(row: Row): CombatEntry | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.session_id !== 'string' ||
    typeof row.token_id !== 'string' ||
    typeof row.owner_id !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    tokenId: row.token_id,
    name: text(row.name),
    imagePath: typeof row.image_path === 'string' ? row.image_path : null,
    ownerId: row.owner_id,
    kind: TOKEN_KINDS.includes(row.kind as TokenKind) ? (row.kind as TokenKind) : 'object',
    hidden: row.hidden === true,
    showName: row.show_name !== false,
    initiative: toNumber(row.initiative),
    sortOrder: toNumber(row.sort_order) ?? 0
  }
}

export function combatLogFromRow(row: Row): CombatLogEntry | null {
  const amount = toNumber(row.amount)
  const before = toNumber(row.hp_before)
  const after = toNumber(row.hp_after)
  if (
    typeof row.id !== 'string' ||
    typeof row.actor_id !== 'string' ||
    (row.kind !== 'damage' && row.kind !== 'heal') ||
    amount === null ||
    before === null ||
    after === null
  ) {
    return null
  }
  return {
    id: row.id,
    actorId: row.actor_id,
    tokenId: typeof row.token_id === 'string' ? row.token_id : null,
    tokenName: text(row.token_name),
    tokenOwnerId: typeof row.token_owner_id === 'string' ? row.token_owner_id : null,
    kind: row.kind as HpChangeKind,
    amount,
    before,
    after,
    tokenHidden: row.token_hidden === true,
    barsHidden: row.bars_hidden === true,
    nameHidden: row.name_hidden === true,
    createdAt: text(row.created_at)
  }
}

/** O que `apply_hp_change` devolveu: [{ token_id, before, after }] ou [{ token_id, skipped }]. */
export function hpResultsFromJson(value: unknown): HpChangeResult[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): HpChangeResult[] => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as Row
    if (typeof row.token_id !== 'string') return []
    if (row.skipped === true) return [{ tokenId: row.token_id, skipped: true }]
    const before = toNumber(row.before)
    const after = toNumber(row.after)
    if (before === null || after === null) return []
    return [{ tokenId: row.token_id, skipped: false, before, after }]
  })
}

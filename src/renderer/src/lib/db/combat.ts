import {
  byTurnOrder,
  type CombatEntry,
  type CombatLogEntry,
  type CombatState,
  type HpChangeKind,
  type HpChangeResult
} from '@/lib/combat'
import {
  combatEntryFromRow,
  combatLogFromRow,
  combatStateFromRow,
  hpResultsFromJson
} from './combat-rows'
import { getSupabase } from './client'
import type { Json } from './database.types'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Combate da mesa (7.3). Quem pode o quê é o banco que decide: as RPCs conferem se é o
 * mestre (ou o jogador da vez), e o RLS esconde do jogador o participante oculto e as
 * entradas do log que ele não pode ver.
 */

/** Quanto do log vem ao abrir a mesa. */
const LOG_SIZE = 100

const ENTRY_COLUMNS =
  'id, session_id, token_id, name, image_path, owner_id, kind, hidden, show_name, initiative, sort_order'
const LOG_COLUMNS =
  'id, actor_id, token_id, token_name, token_owner_id, kind, amount, hp_before, hp_after, token_hidden, bars_hidden, name_hidden, created_at'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

export interface CombatSnapshot {
  state: CombatState
  entries: CombatEntry[]
}

/** Estado e participantes, de uma vez (ao abrir a mesa e ao reconectar). */
export async function fetchCombat(sessionId: string): Promise<CombatSnapshot> {
  const supabase = getSupabase()
  const [state, entries] = await Promise.all([
    supabase
      .from('combat_state')
      .select('session_id, active, round, turn_entry_id')
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase.from('combat_entries').select(ENTRY_COLUMNS).eq('session_id', sessionId)
  ])
  if (state.error !== null) throw fail(state.error)
  if (entries.error !== null) throw fail(entries.error)

  return {
    state: combatStateFromRow(state.data),
    entries: entries.data
      .flatMap((row) => {
        const entry = combatEntryFromRow(row)
        return entry === null ? [] : [entry]
      })
      .sort(byTurnOrder)
  }
}

/** Últimas entradas do log, da mais nova para a mais antiga. */
export async function fetchCombatLog(sessionId: string): Promise<CombatLogEntry[]> {
  const { data, error } = await getSupabase()
    .from('combat_log')
    .select(LOG_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(LOG_SIZE)
  if (error !== null) throw fail(error)
  return data.flatMap((row) => {
    const entry = combatLogFromRow(row)
    return entry === null ? [] : [entry]
  })
}

/** Resposta de uma RPC: o dado, ou o erro já em português. */
function unwrap<T>(result: { data: T; error: DbErrorLike | null }): T {
  if (result.error !== null) throw fail(result.error)
  return result.data
}

export async function startCombat(sessionId: string): Promise<void> {
  unwrap(await getSupabase().rpc('combat_start', { p_session_id: sessionId }))
}

/** Encerrar limpa o tracker (7.3). O log fica. */
export async function endCombat(sessionId: string): Promise<void> {
  unwrap(await getSupabase().rpc('combat_end', { p_session_id: sessionId }))
}

/** Põe tokens no combate (liga o combate, se precisar). Devolve quantos entraram. */
export async function addToCombat(sessionId: string, tokenIds: readonly string[]): Promise<number> {
  const added = unwrap(
    await getSupabase().rpc('combat_add', { p_session_id: sessionId, p_token_ids: [...tokenIds] })
  )
  return typeof added === 'number' ? added : 0
}

export async function removeFromCombat(entryId: string): Promise<void> {
  const { error } = await getSupabase().from('combat_entries').delete().eq('id', entryId)
  if (error !== null) throw fail(error)
}

/** Grava iniciativas (null = apagar) e o banco reordena a fila. */
export async function setInitiatives(
  sessionId: string,
  values: Readonly<Record<string, number | null>>
): Promise<void> {
  unwrap(
    await getSupabase().rpc('combat_set_initiatives', {
      p_session_id: sessionId,
      p_values: { ...values } as Json
    })
  )
}

export async function reorderCombat(sessionId: string, ids: readonly string[]): Promise<void> {
  unwrap(await getSupabase().rpc('combat_reorder', { p_session_id: sessionId, p_ids: [...ids] }))
}

export async function nextTurn(sessionId: string): Promise<void> {
  unwrap(await getSupabase().rpc('combat_next_turn', { p_session_id: sessionId }))
}

export async function endMyTurn(sessionId: string): Promise<void> {
  unwrap(await getSupabase().rpc('combat_end_my_turn', { p_session_id: sessionId }))
}

/** Dano ou cura nos tokens (7.3). A vida fica entre 0 e o máximo; o banco escreve o log. */
export async function applyHpChange(
  sessionId: string,
  tokenIds: readonly string[],
  kind: HpChangeKind,
  amount: number
): Promise<HpChangeResult[]> {
  const data = unwrap(
    await getSupabase().rpc('apply_hp_change', {
      p_session_id: sessionId,
      p_token_ids: [...tokenIds],
      p_kind: kind,
      p_amount: amount
    })
  )
  return hpResultsFromJson(data)
}

/** O mestre limpa o log de combate (7.3). */
export async function clearCombatLog(sessionId: string): Promise<void> {
  const { error } = await getSupabase().from('combat_log').delete().eq('session_id', sessionId)
  if (error !== null) throw fail(error)
}

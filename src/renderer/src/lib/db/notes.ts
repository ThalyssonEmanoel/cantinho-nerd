import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Notas privadas do mestre, uma por mesa (Fase 13).
 *
 * A linha nasce na primeira gravação (`upsert`): a mesa não precisa de nota, e criar uma
 * vazia junto com a sessão só sujaria o banco. Só o mestre lê — o RLS garante.
 */

export const MAX_NOTES_LENGTH = 20000

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

/** As notas da mesa. `''` quando ainda não existe nota (ou quem pede não é o mestre). */
export async function fetchNotes(sessionId: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from('session_notes')
    .select('body')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error !== null) throw fail(error)
  return data?.body ?? ''
}

export async function saveNotes(sessionId: string, body: string): Promise<void> {
  const { error } = await getSupabase()
    .from('session_notes')
    .upsert({ session_id: sessionId, body: body.slice(0, MAX_NOTES_LENGTH) })
  if (error !== null) throw fail(error)
}

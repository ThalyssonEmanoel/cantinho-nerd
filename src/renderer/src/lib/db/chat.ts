import { mergeFeed, type FeedItem, type FeedMessage, type FeedRoll } from '@/lib/chat/feed'
import type { RollSummary } from '@/lib/dice'
import { messageFromRow, rollFromRow, rollResultJson } from './chat-rows'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Chat, rolagens e favoritas da mesa (seções 7.1 e 7.2). Quem vê o quê é o RLS que decide:
 * a rolagem secreta e o sussurro simplesmente não chegam a quem não pode vê-los.
 */

/** Quanto do histórico vem ao abrir a mesa, de cada tipo. */
const HISTORY_SIZE = 150

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

/** Últimas mensagens e rolagens, numa linha do tempo só. */
export async function fetchFeed(sessionId: string): Promise<FeedItem[]> {
  const supabase = getSupabase()
  const [messages, rolls] = await Promise.all([
    supabase
      .from('messages')
      .select('id, author_id, recipient_id, body, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_SIZE),
    supabase
      .from('rolls')
      .select('id, author_id, label, formula, result, total, outcome, secret, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_SIZE)
  ])
  if (messages.error !== null) throw fail(messages.error)
  if (rolls.error !== null) throw fail(rolls.error)

  return mergeFeed(
    messages.data.flatMap((row) => {
      const item = messageFromRow(row)
      return item === null ? [] : [item]
    }),
    rolls.data.flatMap((row) => {
      const item = rollFromRow(row)
      return item === null ? [] : [item]
    })
  )
}

/** Mensagem pública ou, com `recipientId`, sussurro (7.2). Devolve o item já gravado. */
export async function sendMessage(
  sessionId: string,
  body: string,
  recipientId: string | null = null
): Promise<FeedMessage> {
  const { data, error } = await getSupabase()
    .from('messages')
    .insert({ session_id: sessionId, body: body.trim(), recipient_id: recipientId })
    .select('id, author_id, recipient_id, body, created_at')
    .single()
  if (error !== null) throw fail(error)
  const item = messageFromRow(data)
  if (item === null) throw new FriendlyError('A mensagem foi, mas voltou ilegível.')
  return item
}

/** Grava uma rolagem feita no app. `secret`: só o autor e o mestre veem (7.1). */
export async function postRoll(
  sessionId: string,
  roll: RollSummary,
  { secret }: { secret: boolean }
): Promise<FeedRoll> {
  const { data, error } = await getSupabase()
    .from('rolls')
    .insert({
      session_id: sessionId,
      label: (roll.label ?? '').slice(0, 120),
      formula: roll.source.slice(0, 500),
      result: rollResultJson(roll),
      total: roll.total,
      outcome: roll.outcome,
      secret
    })
    .select('id, author_id, label, formula, result, total, outcome, secret, created_at')
    .single()
  if (error !== null) throw fail(error)
  const item = rollFromRow(data)
  if (item === null) throw new FriendlyError('A rolagem foi, mas voltou ilegível.')
  return item
}

/** O mestre limpa o chat (7.2). */
export async function clearChat(sessionId: string): Promise<void> {
  const { error } = await getSupabase().from('messages').delete().eq('session_id', sessionId)
  if (error !== null) throw fail(error)
}

/** O mestre exclui o histórico de rolagens (7.1). */
export async function clearRolls(sessionId: string): Promise<void> {
  const { error } = await getSupabase().from('rolls').delete().eq('session_id', sessionId)
  if (error !== null) throw fail(error)
}

export interface DiceMacro {
  id: string
  label: string
  formula: string
}

/** Fórmulas favoritas desta pessoa nesta mesa (7.1). */
export async function listMacros(sessionId: string): Promise<DiceMacro[]> {
  const { data, error } = await getSupabase()
    .from('dice_macros')
    .select('id, label, formula')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error !== null) throw fail(error)
  return data
}

export async function addMacro(
  sessionId: string,
  label: string,
  formula: string
): Promise<DiceMacro> {
  const { data, error } = await getSupabase()
    .from('dice_macros')
    .insert({ session_id: sessionId, label: label.trim().slice(0, 60), formula: formula.trim() })
    .select('id, label, formula')
    .single()
  if (error !== null) throw fail(error)
  return data
}

export async function removeMacro(id: string): Promise<void> {
  const { error } = await getSupabase().from('dice_macros').delete().eq('id', id)
  if (error !== null) throw fail(error)
}

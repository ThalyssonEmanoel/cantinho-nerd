import type { Clue, ClueDraft } from '@/lib/session/clues'
import { removeAssets } from './assets'
import { clueFromRow, type ClueRow } from './clue-rows'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Pistas da mesa (Fase 13).
 *
 * Quem vê o quê é decidido no banco: o mestre vê todas, o jogador só o que foi revelado
 * para ele. Aqui só se pede e se traduz o erro.
 */

const COLUMNS = 'id, session_id, title, body, image_path, reveal_all, revealed_to, sort_order, updated_at'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

export async function listClues(sessionId: string): Promise<Clue[]> {
  const { data, error } = await getSupabase()
    .from('clues')
    .select(COLUMNS)
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
  if (error !== null) throw fail(error)
  return (data as ClueRow[]).map(clueFromRow)
}

export interface CreateClueInput extends ClueDraft {
  sessionId: string
  sortOrder: number
}

export async function createClue(input: CreateClueInput): Promise<Clue> {
  const { data, error } = await getSupabase()
    .from('clues')
    .insert({
      session_id: input.sessionId,
      title: input.title.trim(),
      body: input.body,
      image_path: input.imagePath,
      sort_order: input.sortOrder
    })
    .select(COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  return clueFromRow(data as ClueRow)
}

export interface CluePatch {
  title?: string
  body?: string
  imagePath?: string | null
  revealAll?: boolean
  revealedTo?: readonly string[]
}

export async function updateClue(clueId: string, patch: CluePatch): Promise<Clue> {
  const { data, error } = await getSupabase()
    .from('clues')
    .update({
      ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
      ...(patch.body === undefined ? {} : { body: patch.body }),
      ...(patch.imagePath === undefined ? {} : { image_path: patch.imagePath }),
      ...(patch.revealAll === undefined ? {} : { reveal_all: patch.revealAll }),
      ...(patch.revealedTo === undefined ? {} : { revealed_to: [...patch.revealedTo] })
    })
    .eq('id', clueId)
    .select(COLUMNS)
  if (error !== null) throw fail(error)

  const [row] = data as ClueRow[]
  if (row === undefined) throw new FriendlyError('Só o mestre mexe nas pistas desta mesa.')
  return clueFromRow(row)
}

/**
 * Exclui a pista. A imagem não tem cascata no Storage (10.2): sai aqui, se mais nenhuma
 * pista aponta para ela (o nome é o hash do conteúdo).
 */
export async function deleteClue(clue: Clue): Promise<void> {
  const { data, error } = await getSupabase().from('clues').delete().eq('id', clue.id).select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Só o mestre exclui as pistas desta mesa.')

  if (clue.imagePath === null) return
  const { count } = await getSupabase()
    .from('clues')
    .select('id', { count: 'exact', head: true })
    .eq('image_path', clue.imagePath)
  if ((count ?? 0) === 0) await removeAssets([clue.imagePath])
}

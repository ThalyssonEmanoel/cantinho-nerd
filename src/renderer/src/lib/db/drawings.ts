import type { Drawing, DrawingTool } from '@/lib/board'
import { drawingFromRow } from './board-rows'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Desenhos do mapa (6.5). Quem vê e quem apaga é o RLS: o jogador vê os do mapa ativo e
 * apaga só os seus; o mestre vê e apaga todos.
 */

const DRAWING_COLUMNS = 'id, session_id, map_id, author_id, tool, points, color, width, created_at'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

/** Desenhos de um mapa, na ordem em que foram feitos (o Ctrl+Z depende dela). */
export async function listDrawings(mapId: string): Promise<Drawing[]> {
  const { data, error } = await getSupabase()
    .from('drawings')
    .select(DRAWING_COLUMNS)
    .eq('map_id', mapId)
    .order('created_at', { ascending: true })
  if (error !== null) throw fail(error)
  return data.flatMap((row) => {
    const drawing = drawingFromRow(row)
    return drawing === null ? [] : [drawing]
  })
}

export interface CreateDrawingInput {
  /** Gerado no app: é o mesmo id do traço ao vivo que os outros estão vendo. */
  id: string
  sessionId: string
  mapId: string
  tool: DrawingTool
  points: number[]
  color: string
  width: number
}

export async function createDrawing(input: CreateDrawingInput): Promise<Drawing> {
  const { data, error } = await getSupabase()
    .from('drawings')
    .insert({
      id: input.id,
      session_id: input.sessionId,
      map_id: input.mapId,
      tool: input.tool,
      points: input.points,
      color: input.color,
      width: input.width
    })
    .select(DRAWING_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  const drawing = drawingFromRow(data)
  if (drawing === null) throw new FriendlyError('O desenho foi salvo, mas voltou ilegível.')
  return drawing
}

/** Apaga traços pelo id. O que não é desta pessoa o RLS simplesmente não apaga. */
export async function deleteDrawings(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await getSupabase()
    .from('drawings')
    .delete()
    .in('id', [...ids])
  if (error !== null) throw fail(error)
}

/** "Apagar meus desenhos" (6.5): só os meus, só deste mapa. */
export async function deleteMyDrawings(mapId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('drawings')
    .delete()
    .eq('map_id', mapId)
    .eq('author_id', userId)
  if (error !== null) throw fail(error)
}

/** "Limpar todos os desenhos" do mapa: só o mestre (o RLS recusa os outros). */
export async function deleteAllDrawings(mapId: string): Promise<void> {
  const { error } = await getSupabase().from('drawings').delete().eq('map_id', mapId)
  if (error !== null) throw fail(error)
}

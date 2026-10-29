import { fogToJson, normalizeGrid, type BoardMap, type FogState, type GridSettings } from '@/lib/board'
import { removeAssets } from './assets'
import { getSupabase } from './client'
import type { Json } from './database.types'
import { gridToJson, mapFromRow, type MapRow } from './board-rows'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Biblioteca de mapas da sessão (6.1).
 *
 * Quem pode o quê é decidido no banco: o mestre vê e mexe em todos, o jogador lê só o mapa
 * ativo. Aqui só se pede e se traduz o erro.
 */

const MAP_COLUMNS = 'id, session_id, name, image_path, width, height, grid, fog, sort_order'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

export async function listMaps(sessionId: string): Promise<BoardMap[]> {
  const { data, error } = await getSupabase()
    .from('maps')
    .select(MAP_COLUMNS)
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error !== null) throw fail(error)
  return (data as MapRow[]).map(mapFromRow)
}

export interface CreateMapInput {
  sessionId: string
  name: string
  imagePath: string
  width: number
  height: number
  /** Tamanho do quadrado medido na imagem, quando o mestre informou. */
  grid?: Partial<GridSettings>
}

export async function createMap(input: CreateMapInput): Promise<BoardMap> {
  // Entra no fim da biblioteca.
  const { count, error: countError } = await getSupabase()
    .from('maps')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', input.sessionId)
  if (countError !== null) throw fail(countError)

  const { data, error } = await getSupabase()
    .from('maps')
    .insert({
      session_id: input.sessionId,
      name: input.name.trim(),
      image_path: input.imagePath,
      width: Math.round(input.width),
      height: Math.round(input.height),
      sort_order: count ?? 0,
      ...(input.grid === undefined ? {} : { grid: gridToJson(normalizeGrid(input.grid)) })
    })
    .select(MAP_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  return mapFromRow(data as MapRow)
}

export async function renameMap(mapId: string, name: string): Promise<void> {
  await updateMap(mapId, { name: name.trim() })
}

/** Grade do mapa (6.2). Só o mestre; todos passam a ver igual. */
export async function updateMapGrid(mapId: string, grid: GridSettings): Promise<void> {
  await updateMap(mapId, { grid: gridToJson(grid) })
}

/** Névoa de guerra do mapa (6.4). Só o mestre; os jogadores recebem pelo tempo real. */
export async function updateMapFog(mapId: string, fog: FogState): Promise<void> {
  await updateMap(mapId, { fog: fogToJson(fog) as Json })
}

async function updateMap(
  mapId: string,
  change: { name?: string; grid?: Json; fog?: Json }
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('maps')
    .update(change)
    .eq('id', mapId)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Só o mestre muda os mapas desta mesa.')
}

/**
 * Exclui o mapa. Os tokens dele vão pela cascata do banco; a imagem não tem cascata no
 * Storage (10.2), então sai aqui.
 */
export async function deleteMap(map: BoardMap): Promise<void> {
  const { data, error } = await getSupabase()
    .from('maps')
    .delete()
    .eq('id', map.id)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Só o mestre exclui os mapas desta mesa.')

  // A mesma imagem pode estar em outro mapa (o nome é o hash do conteúdo): só apaga o
  // arquivo se mais ninguém aponta para ele.
  const { count } = await getSupabase()
    .from('maps')
    .select('id', { count: 'exact', head: true })
    .eq('image_path', map.imagePath)
  if ((count ?? 0) === 0) await removeAssets([map.imagePath])
}

export async function reorderMaps(sessionId: string, ids: readonly string[]): Promise<void> {
  const { error } = await getSupabase().rpc('reorder_maps', {
    p_session_id: sessionId,
    p_ids: ids as string[]
  })
  if (error !== null) throw fail(error)
}

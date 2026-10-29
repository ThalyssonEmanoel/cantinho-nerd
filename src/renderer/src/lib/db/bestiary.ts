import {
  groupsToJson,
  type Creature,
  type CreatureKind,
  type Encounter,
  type EncounterGroup
} from '@/lib/bestiary'
import type { SheetValues } from '@/lib/sheet'
import { creatureFromRow, encounterFromRow, spawnResultsFromJson } from './bestiary-rows'
import { getSupabase } from './client'
import type { Json, TablesUpdate } from './database.types'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Bestiário e encontros do mestre (seção 8), e as RPCs que põem criaturas e jogadores no
 * mapa. Só o dono lê o bestiário: os jogadores nunca o recebem (evita spoiler).
 */

const CREATURE_COLUMNS =
  'id, name, kind, tags, template_id, template_version, values, image_path, token_size, updated_at'
const ENCOUNTER_COLUMNS = 'id, name, groups, updated_at'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

const asJson = (values: SheetValues): Json => values as unknown as Json

export async function listCreatures(): Promise<Creature[]> {
  const { data, error } = await getSupabase()
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .order('name', { ascending: true })
  if (error !== null) throw fail(error)
  return data.flatMap((row) => {
    const creature = creatureFromRow(row)
    return creature === null ? [] : [creature]
  })
}

export async function getCreature(id: string): Promise<Creature | null> {
  const { data, error } = await getSupabase()
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw fail(error)
  return data === null ? null : creatureFromRow(data)
}

export interface CreateCreatureInput {
  name: string
  kind: CreatureKind
  templateId: string
  templateVersion: number
  values: SheetValues
}

export async function createCreature(input: CreateCreatureInput): Promise<Creature> {
  const { data, error } = await getSupabase()
    .from('creatures')
    .insert({
      name: input.name.trim().slice(0, 80),
      kind: input.kind,
      template_id: input.templateId,
      template_version: input.templateVersion,
      values: asJson(input.values)
    })
    .select(CREATURE_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  const creature = creatureFromRow(data)
  if (creature === null) throw new FriendlyError('A criatura foi criada, mas voltou ilegível.')
  return creature
}

export type CreaturePatch = Partial<
  Pick<Creature, 'name' | 'kind' | 'tags' | 'templateVersion' | 'values' | 'imagePath' | 'tokenSize'>
>

export async function updateCreature(id: string, patch: CreaturePatch): Promise<Creature> {
  const row: TablesUpdate<'creatures'> = {}
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 80)
  if (patch.kind !== undefined) row.kind = patch.kind
  if (patch.tags !== undefined) row.tags = patch.tags
  if (patch.templateVersion !== undefined) row.template_version = patch.templateVersion
  if (patch.values !== undefined) row.values = asJson(patch.values)
  if (patch.imagePath !== undefined) row.image_path = patch.imagePath
  if (patch.tokenSize !== undefined) row.token_size = patch.tokenSize

  const { data, error } = await getSupabase()
    .from('creatures')
    .update(row)
    .eq('id', id)
    .select(CREATURE_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  const creature = creatureFromRow(data)
  if (creature === null) throw new FriendlyError('A criatura foi salva, mas voltou ilegível.')
  return creature
}

/** "Goblin" → "Goblin (cópia)", com tudo igual: stat block, imagem, tags. */
export async function duplicateCreature(creature: Creature): Promise<Creature> {
  const { data, error } = await getSupabase()
    .from('creatures')
    .insert({
      name: `${creature.name} (cópia)`.slice(0, 80),
      kind: creature.kind,
      tags: creature.tags,
      template_id: creature.templateId,
      template_version: creature.templateVersion,
      values: asJson(creature.values),
      image_path: creature.imagePath,
      token_size: creature.tokenSize
    })
    .select(CREATURE_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  const copy = creatureFromRow(data)
  if (copy === null) throw new FriendlyError('A cópia foi criada, mas voltou ilegível.')
  return copy
}

export async function deleteCreature(id: string): Promise<void> {
  const { error } = await getSupabase().from('creatures').delete().eq('id', id)
  if (error !== null) throw fail(error)
}

export async function listEncounters(): Promise<Encounter[]> {
  const { data, error } = await getSupabase()
    .from('encounters')
    .select(ENCOUNTER_COLUMNS)
    .order('name', { ascending: true })
  if (error !== null) throw fail(error)
  return data.flatMap((row) => {
    const encounter = encounterFromRow(row)
    return encounter === null ? [] : [encounter]
  })
}

export async function saveEncounter(
  id: string | null,
  name: string,
  groups: readonly EncounterGroup[]
): Promise<Encounter> {
  const row = { name: name.trim().slice(0, 80), groups: groupsToJson(groups) as Json }
  const supabase = getSupabase()
  const result =
    id === null
      ? await supabase.from('encounters').insert(row).select(ENCOUNTER_COLUMNS).single()
      : await supabase.from('encounters').update(row).eq('id', id).select(ENCOUNTER_COLUMNS).single()
  if (result.error !== null) throw fail(result.error)
  const encounter = encounterFromRow(result.data)
  if (encounter === null) throw new FriendlyError('O encontro foi salvo, mas voltou ilegível.')
  return encounter
}

export async function deleteEncounter(id: string): Promise<void> {
  const { error } = await getSupabase().from('encounters').delete().eq('id', id)
  if (error !== null) throw fail(error)
}

/** Uma criatura pronta para virar ficha-instância + token (o formato de `spawn_creatures`). */
export interface SpawnItem {
  templateId: string
  templateVersion: number
  values: Json
  gmValues: Json
  computed: Json
  gmComputed: Json
  summary: Json
  name: string
  kind: CreatureKind
  /** Já copiada para `sessions/<id>/tokens/`. */
  imagePath: string | null
  size: number
  hidden: boolean
  x: number
  y: number
}

/** Põe as criaturas no mapa, cada uma com a sua ficha-instância, de uma vez. */
export async function spawnCreatures(
  sessionId: string,
  mapId: string,
  items: readonly SpawnItem[]
): Promise<Array<{ tokenId: string; sheetId: string }>> {
  const { data, error } = await getSupabase().rpc('spawn_creatures', {
    p_session_id: sessionId,
    p_map_id: mapId,
    p_items: items.map((item) => ({
      template_id: item.templateId,
      template_version: item.templateVersion,
      values: item.values,
      gm_values: item.gmValues,
      computed: item.computed,
      gm_computed: item.gmComputed,
      summary: item.summary,
      name: item.name,
      kind: item.kind,
      image_path: item.imagePath,
      size: item.size,
      hidden: item.hidden,
      x: item.x,
      y: item.y
    }))
  })
  if (error !== null) throw fail(error)
  return spawnResultsFromJson(data)
}

/** Puxa (ou reagrupa) os jogadores para as posições dadas. Devolve quantos mudaram. */
export async function pullPlayers(
  sessionId: string,
  mapId: string,
  spots: ReadonlyArray<{ userId: string; x: number; y: number }>
): Promise<number> {
  const { data, error } = await getSupabase().rpc('pull_players', {
    p_session_id: sessionId,
    p_map_id: mapId,
    p_spots: spots.map((spot) => ({ user_id: spot.userId, x: spot.x, y: spot.y }))
  })
  if (error !== null) throw fail(error)
  return typeof data === 'number' ? data : 0
}

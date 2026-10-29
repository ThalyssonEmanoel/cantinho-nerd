import { toWorld, type BoardMap, type Point } from '@/lib/board'
import {
  expandEncounter,
  planPlayerSpots,
  planSpawn,
  type Creature,
  type Encounter,
  type SpawnRequest
} from '@/lib/bestiary'
import { copyAsset, tokenImagePath } from '@/lib/db/assets'
import {
  createCreature,
  pullPlayers,
  spawnCreatures,
  type SpawnItem
} from '@/lib/db/bestiary'
import type { Json } from '@/lib/db/database.types'
import { FriendlyError } from '@/lib/db/errors'
import { cachesOf } from '@/lib/db/sheets'
import {
  createInitialValues,
  splitValues,
  type SheetSchema,
  type SheetTemplate
} from '@/lib/sheet'
import { useBoardStore } from '@/features/board/board-store'
import { addTokensToCombat } from '@/features/combat/combat-actions'
import { useSessionStore } from '@/features/session/session-store'
import { templateRepository } from '@/features/sheet-templates/repository'

/**
 * As ações do mestre com o bestiário (seção 8): criar criatura, pôr criaturas e encontros
 * no mapa e puxar os jogadores. Juntam o banco, o Storage e o tabuleiro aberto.
 */

/** Versão publicada é imutável: depois de lida, vale para sempre. */
const schemas = new Map<string, SheetSchema>()

/** O esquema da versão em que o stat block da criatura foi preenchido. */
export async function creatureSchema(
  templateId: string,
  version: number
): Promise<SheetSchema | null> {
  const key = `${templateId}:${version}`
  const cached = schemas.get(key)
  if (cached !== undefined) return cached
  const template = await templateRepository.get(templateId)
  const found = template?.versions.find((item) => item.version === version)
  if (found === undefined) return null
  schemas.set(key, found.schema)
  return found.schema
}

/** Criatura nova a partir da última versão publicada de um modelo `creature`. */
export async function newCreature(template: SheetTemplate, name: string): Promise<Creature> {
  const latest = template.versions.at(-1)
  if (latest === undefined) {
    throw new FriendlyError('Publique uma versão do modelo antes de criar criaturas com ele.')
  }
  return createCreature({
    name,
    kind: 'monster',
    templateId: template.id,
    templateVersion: latest.version,
    // A vida máxima por fórmula já nasce cheia (createInitialValues).
    values: createInitialValues(latest.schema)
  })
}

/** Centro da visão do mestre, em coordenadas do mapa: é perto dali que as criaturas caem. */
export function boardViewCenter(): Point | null {
  const state = useBoardStore.getState()
  const map = state.maps.find((item) => item.id === state.openMapId)
  if (map === undefined) return null
  const camera = state.cameras[map.id]
  if (camera === undefined || state.viewport.width === 0) {
    return { x: map.width / 2, y: map.height / 2 }
  }
  return toWorld(camera, { x: state.viewport.width / 2, y: state.viewport.height / 2 })
}

function openBoard(): { sessionId: string; map: BoardMap; center: Point } {
  const sessionId = useBoardStore.getState().sessionId
  const map = findOpenMap()
  const center = boardViewCenter()
  if (sessionId === null || map === null || center === null) {
    throw new FriendlyError('Abra um mapa no tabuleiro primeiro.')
  }
  return { sessionId, map, center }
}

function findOpenMap(): BoardMap | null {
  const state = useBoardStore.getState()
  return state.maps.find((item) => item.id === state.openMapId) ?? null
}

export interface SpawnOutcome {
  placed: number
  /** Grupos cuja criatura não existe mais, ou cujo modelo não abriu. */
  skipped: number
}

/**
 * Põe criaturas no mapa aberto (seção 8). Cada uma ganha a sua ficha-instância, com o
 * stat block copiado — Goblin 1 e Goblin 2 com vida separada —, e a imagem é copiada da
 * galeria para a pasta da mesa (os jogadores não leem a galeria do mestre).
 */
export async function spawnRequests(
  requests: readonly SpawnRequest<Creature>[],
  options: { addToCombat: boolean }
): Promise<SpawnOutcome> {
  const { sessionId, map, center } = openBoard()
  if (requests.length === 0) return { placed: 0, skipped: 0 }

  // O que é igual para todas as cópias de uma criatura é preparado uma vez só.
  const prepared = new Map<
    string,
    Omit<SpawnItem, 'name' | 'size' | 'hidden' | 'x' | 'y'> | null
  >()
  for (const creature of new Map(requests.map((request) => [request.payload.id, request.payload])).values()) {
    const schema = await creatureSchema(creature.templateId, creature.templateVersion)
    if (schema === null) {
      prepared.set(creature.id, null)
      continue
    }
    const split = splitValues(schema, creature.values)
    const caches = cachesOf(schema, creature.values)
    let imagePath: string | null = null
    if (creature.imagePath !== null) {
      const hash = (creature.imagePath.split('/').pop() ?? '').replace(/\.webp$/i, '')
      imagePath = tokenImagePath(sessionId, hash)
      await copyAsset(creature.imagePath, imagePath)
    }
    prepared.set(creature.id, {
      templateId: creature.templateId,
      templateVersion: creature.templateVersion,
      values: split.values as unknown as Json,
      gmValues: split.gmValues as unknown as Json,
      computed: caches.computed,
      gmComputed: caches.gmComputed,
      summary: caches.summary,
      kind: creature.kind,
      imagePath
    })
  }

  const usable = requests.filter((request) => prepared.get(request.payload.id) != null)
  const skipped = new Set(
    requests.filter((request) => prepared.get(request.payload.id) == null).map((r) => r.payload.id)
  ).size

  const board = useBoardStore.getState()
  const placements = planSpawn(usable, {
    grid: map.grid,
    map: { width: map.width, height: map.height },
    center,
    tokens: board.tokens.map(({ x, y, size, name }) => ({ x, y, size, name }))
  })
  const items: SpawnItem[] = placements.flatMap((placement) => {
    const base = prepared.get(placement.payload.id)
    if (base == null) return []
    return [
      {
        ...base,
        name: placement.name,
        size: placement.size,
        hidden: placement.hidden,
        x: placement.x,
        y: placement.y
      }
    ]
  })
  if (items.length === 0) return { placed: 0, skipped }

  const created = await spawnCreatures(sessionId, map.id, items)
  await useBoardStore.getState().reloadTokens()
  if (options.addToCombat && created.length > 0) {
    await addTokensToCombat(created.map((item) => item.tokenId))
  }
  return { placed: created.length, skipped }
}

/** Uma criatura avulsa, direto do bestiário. */
export async function spawnCreature(
  creature: Creature,
  options: { hidden: boolean; addToCombat: boolean }
): Promise<SpawnOutcome> {
  return spawnRequests(
    [
      {
        payload: creature,
        baseName: creature.name.trim() || 'Criatura',
        size: creature.tokenSize,
        hidden: options.hidden
      }
    ],
    options
  )
}

/** O encontro inteiro, com um clique (seção 8). */
export async function spawnEncounter(
  encounter: Encounter,
  creatures: readonly Creature[],
  options: { addToCombat: boolean }
): Promise<SpawnOutcome> {
  const { requests, missing } = expandEncounter(encounter.groups, creatures)
  const outcome = await spawnRequests(requests, options)
  return { placed: outcome.placed, skipped: outcome.skipped + missing }
}

/**
 * Puxar jogadores (seção 8): o token de cada jogador da mesa no mapa aberto, perto do centro
 * da visão. Quem já está fica — a não ser que `regroup`. Devolve quantos mudaram.
 */
export async function pullPlayersToMap(regroup: boolean): Promise<number> {
  const { sessionId, map, center } = openBoard()
  const members = useSessionStore.getState().session?.members ?? []
  const tokens = useBoardStore.getState().tokens

  const players = members
    .filter((member) => member.role === 'player')
    .map((member) => {
      const token = tokens.find((item) => item.kind === 'player' && item.ownerId === member.userId)
      return {
        userId: member.userId,
        token: token === undefined ? null : { x: token.x, y: token.y, size: token.size }
      }
    })

  const spots = planPlayerSpots(
    players,
    {
      grid: map.grid,
      map: { width: map.width, height: map.height },
      center,
      tokens: tokens.map(({ x, y, size, ownerId, kind }) => ({ x, y, size, ownerId, kind }))
    },
    regroup
  )
  if (spots.length === 0) return 0

  const changed = await pullPlayers(sessionId, map.id, spots)
  await useBoardStore.getState().reloadTokens()
  return changed
}

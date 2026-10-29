import {
  findFreeSpot,
  numberedName,
  snapToGrid,
  type GridSettings,
  type Point,
  type Size
} from '@/lib/board'
import type { SheetValues } from '@/lib/sheet'

/**
 * Ferramentas do mestre (seção 8): bestiário, encontros e onde cada token cai no mapa.
 *
 * Lógica pura: o banco guarda e cria tudo de uma vez (`spawn_creatures`, `pull_players`),
 * mas é o app que decide posição sem sobreposição e a numeração "Goblin 3", porque é ele
 * que sabe o que está no mapa e onde o mestre está olhando.
 */

export type CreatureKind = 'monster' | 'npc'

export const CREATURE_KIND_LABELS: Record<CreatureKind, string> = {
  monster: 'Monstro',
  npc: 'NPC'
}

export interface Creature {
  id: string
  name: string
  kind: CreatureKind
  tags: string[]
  /** Modelo `creature` do mestre e a versão publicada em que o stat block foi preenchido. */
  templateId: string
  templateVersion: number
  values: SheetValues
  /** Caminho na galeria do mestre (`users/<id>/gallery/…`), ou null. */
  imagePath: string | null
  tokenSize: number
  updatedAt: string
}

export interface EncounterGroup {
  creatureId: string
  count: number
  hidden: boolean
}

export interface Encounter {
  id: string
  name: string
  groups: EncounterGroup[]
  updatedAt: string
}

export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 30
export const MAX_GROUP_COUNT = 50
/** O mesmo teto do banco (`spawn_creatures`). */
export const MAX_SPAWN = 100

/** "Floresta, fraco , floresta" → ["floresta", "fraco"]. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of text.split(',')) {
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH)
    if (tag === '' || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length === MAX_TAGS) break
  }
  return tags
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Todas as tags do bestiário, em ordem alfabética: são os filtros da tela. */
export function allTags(creatures: readonly Creature[]): string[] {
  return [...new Set(creatures.flatMap((creature) => creature.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )
}

/** Busca pelo nome (sem acento) e filtra pelas tags marcadas — todas elas. */
export function filterCreatures(
  creatures: readonly Creature[],
  query: string,
  tags: readonly string[],
  kind: CreatureKind | 'all' = 'all'
): Creature[] {
  const wanted = fold(query)
  return creatures
    .filter(
      (creature) =>
        (kind === 'all' || creature.kind === kind) &&
        (wanted === '' ||
          fold(creature.name).includes(wanted) ||
          creature.tags.some((tag) => fold(tag).includes(wanted))) &&
        tags.every((tag) => creature.tags.includes(tag))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function clampGroupCount(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_GROUP_COUNT, Math.max(1, Math.trunc(value)))
}

/** Grupos do encontro vindos do banco (jsonb), conferidos. */
export function parseGroups(value: unknown): EncounterGroup[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): EncounterGroup[] => {
    if (typeof item !== 'object' || item === null) return []
    const raw = item as Record<string, unknown>
    if (typeof raw.creature_id !== 'string') return []
    return [
      {
        creatureId: raw.creature_id,
        count: clampGroupCount(typeof raw.count === 'number' ? raw.count : 1),
        hidden: raw.hidden === true
      }
    ]
  })
}

export function groupsToJson(
  groups: readonly EncounterGroup[]
): Array<{ creature_id: string; count: number; hidden: boolean }> {
  return groups.map((group) => ({
    creature_id: group.creatureId,
    count: clampGroupCount(group.count),
    hidden: group.hidden
  }))
}

/** Quantas criaturas o encontro põe no mapa (só as que ainda existem no bestiário). */
export function encounterSize(
  encounter: Pick<Encounter, 'groups'>,
  creatures: readonly Pick<Creature, 'id'>[]
): number {
  return encounter.groups
    .filter((group) => creatures.some((creature) => creature.id === group.creatureId))
    .reduce((total, group) => total + group.count, 0)
}

/** Onde o mapa está e o que já está nele, para achar lugar livre. */
export interface BoardSpace {
  grid: GridSettings
  map: Size
  /** Tokens que já estão no mapa (posição, tamanho e nome). */
  tokens: readonly { x: number; y: number; size: number; name: string }[]
  /** Perto de onde colocar: o centro da visão do mestre. */
  center: Point
}

export interface SpawnRequest<T> {
  /** O que vai junto (a criatura, por exemplo) — devolvido igual, ao lado da posição. */
  payload: T
  baseName: string
  size: number
  hidden: boolean
}

export interface SpawnPlacement<T> {
  payload: T
  name: string
  x: number
  y: number
  size: number
  hidden: boolean
}

/**
 * Posição e nome de cada criatura (seção 8): em grade, sem sobreposição, perto do centro
 * da visão e com numeração que continua a do mapa ("Goblin 3" se já há Goblin 1 e 2). Cada
 * uma já colocada vira obstáculo para a seguinte.
 */
export function planSpawn<T>(
  requests: readonly SpawnRequest<T>[],
  space: BoardSpace
): SpawnPlacement<T>[] {
  const occupied = space.tokens.map(({ x, y, size }) => ({ x, y, size }))
  const names = space.tokens.map((token) => token.name)
  const placements: SpawnPlacement<T>[] = []

  for (const request of requests.slice(0, MAX_SPAWN)) {
    const free = findFreeSpot(space.center, {
      grid: space.grid,
      size: request.size,
      occupied,
      map: space.map
    })
    const point = snapToGrid(free, space.grid, request.size)
    const name = numberedName(request.baseName, names) || request.baseName
    occupied.push({ x: point.x, y: point.y, size: request.size })
    names.push(name)
    placements.push({
      payload: request.payload,
      name,
      x: point.x,
      y: point.y,
      size: request.size,
      hidden: request.hidden
    })
  }
  return placements
}

/** Um encontro vira uma lista de pedidos, um por criatura (Goblin × 3 = três pedidos). */
export function expandEncounter(
  groups: readonly EncounterGroup[],
  creatures: readonly Creature[]
): { requests: SpawnRequest<Creature>[]; missing: number } {
  const requests: SpawnRequest<Creature>[] = []
  let missing = 0
  for (const group of groups) {
    const creature = creatures.find((item) => item.id === group.creatureId)
    if (creature === undefined) {
      missing += 1
      continue
    }
    for (let index = 0; index < group.count; index += 1) {
      requests.push({
        payload: creature,
        baseName: creature.name.trim() || 'Criatura',
        size: creature.tokenSize,
        hidden: group.hidden
      })
    }
  }
  return { requests, missing }
}

export interface PlayerOnBoard {
  userId: string
  /** Token dele neste mapa, se já houver. */
  token: { x: number; y: number; size: number } | null
}

/**
 * Puxar jogadores (seção 8): quem não está no mapa ganha um lugar perto do centro; quem já
 * está fica onde está — a não ser que o mestre peça para reagrupar, aí todos vão para perto
 * do centro, sem sobreposição. Devolve só quem precisa mudar.
 */
export function planPlayerSpots(
  players: readonly PlayerOnBoard[],
  space: Omit<BoardSpace, 'tokens'> & {
    tokens: readonly { x: number; y: number; size: number; ownerId: string; kind: string }[]
  },
  regroup: boolean
): Array<{ userId: string; x: number; y: number }> {
  const moving = players.filter((player) => regroup || player.token === null)
  const movingIds = new Set(moving.map((player) => player.userId))
  // Quem vai ser reagrupado não ocupa o lugar antigo.
  const occupied = space.tokens
    .filter((token) => !(token.kind === 'player' && movingIds.has(token.ownerId)))
    .map(({ x, y, size }) => ({ x, y, size }))

  return moving.map((player) => {
    const size = player.token?.size ?? 1
    const free = findFreeSpot(space.center, { grid: space.grid, size, occupied, map: space.map })
    const point = snapToGrid(free, space.grid, size)
    occupied.push({ x: point.x, y: point.y, size })
    return { userId: player.userId, x: point.x, y: point.y }
  })
}

/** Resumo curto de um encontro: "3× Goblin (oculta), 1× Orc". */
export function describeEncounter(
  encounter: Pick<Encounter, 'groups'>,
  creatures: readonly Pick<Creature, 'id' | 'name'>[]
): string {
  const parts = encounter.groups.map((group) => {
    const creature = creatures.find((item) => item.id === group.creatureId)
    return `${group.count}× ${creature?.name ?? '(excluída)'}${group.hidden ? ' (oculta)' : ''}`
  })
  return parts.length === 0 ? 'Vazio' : parts.join(', ')
}

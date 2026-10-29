import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID, type GridSettings } from '@/lib/board'
import {
  allTags,
  clampGroupCount,
  describeEncounter,
  encounterSize,
  expandEncounter,
  filterCreatures,
  groupsToJson,
  parseGroups,
  parseTags,
  planPlayerSpots,
  planSpawn,
  type Creature
} from './index'

const grid: GridSettings = { ...DEFAULT_GRID, enabled: true, size: 50, offsetX: 0, offsetY: 0 }

function creature(partial: Partial<Creature> & { id: string; name: string }): Creature {
  return {
    kind: 'monster',
    tags: [],
    templateId: 'tpl',
    templateVersion: 1,
    values: {},
    imagePath: null,
    tokenSize: 1,
    updatedAt: '',
    ...partial
  }
}

describe('tags e busca', () => {
  it('separa por vírgula, sem repetir, em minúsculas', () => {
    expect(parseTags(' Floresta, fraco , floresta,, ')).toEqual(['floresta', 'fraco'])
  })

  const list = [
    creature({ id: 'g', name: 'Goblin', tags: ['floresta', 'fraco'] }),
    creature({ id: 'o', name: 'Orc Chefe', tags: ['floresta'] }),
    creature({ id: 'e', name: 'Estalajadeiro', kind: 'npc', tags: ['cidade'] })
  ]

  it('busca pelo nome sem acento e pelas tags', () => {
    expect(filterCreatures(list, 'orc', []).map((item) => item.id)).toEqual(['o'])
    expect(filterCreatures(list, 'CIDADE', []).map((item) => item.id)).toEqual(['e'])
  })

  it('filtra por todas as tags marcadas e pelo tipo', () => {
    expect(filterCreatures(list, '', ['floresta']).map((item) => item.id)).toEqual(['g', 'o'])
    expect(filterCreatures(list, '', ['floresta', 'fraco']).map((item) => item.id)).toEqual(['g'])
    expect(filterCreatures(list, '', [], 'npc').map((item) => item.id)).toEqual(['e'])
    expect(allTags(list)).toEqual(['cidade', 'floresta', 'fraco'])
  })
})

describe('encontros', () => {
  it('grupos do banco são conferidos e a quantidade limitada', () => {
    expect(
      parseGroups([
        { creature_id: 'g', count: 3, hidden: true },
        { creature_id: 'o', count: 900 },
        { count: 2 },
        'lixo'
      ])
    ).toEqual([
      { creatureId: 'g', count: 3, hidden: true },
      { creatureId: 'o', count: 50, hidden: false }
    ])
    expect(clampGroupCount(0)).toBe(1)
    expect(groupsToJson([{ creatureId: 'g', count: 2.7, hidden: false }])).toEqual([
      { creature_id: 'g', count: 2, hidden: false }
    ])
  })

  it('criatura excluída do bestiário é pulada e contada', () => {
    const goblin = creature({ id: 'g', name: 'Goblin', tokenSize: 1 })
    const { requests, missing } = expandEncounter(
      [
        { creatureId: 'g', count: 2, hidden: true },
        { creatureId: 'sumiu', count: 4, hidden: false }
      ],
      [goblin]
    )
    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.hidden)).toBe(true)
    expect(missing).toBe(1)
    expect(encounterSize({ groups: [{ creatureId: 'g', count: 2, hidden: false }] }, [goblin])).toBe(2)
    expect(
      describeEncounter(
        {
          groups: [
            { creatureId: 'g', count: 2, hidden: true },
            { creatureId: 'sumiu', count: 1, hidden: false }
          ]
        },
        [goblin]
      )
    ).toBe('2× Goblin (oculta), 1× (excluída)')
  })
})

describe('onde cada criatura cai', () => {
  const space = {
    grid,
    map: { width: 1000, height: 1000 },
    center: { x: 260, y: 260 },
    tokens: [{ x: 250, y: 250, size: 1, name: 'Goblin 2' }]
  }

  it('sem sobreposição, perto do centro, numeração continuando a do mapa', () => {
    const goblin = creature({ id: 'g', name: 'Goblin' })
    const placements = planSpawn(
      [1, 2, 3].map(() => ({ payload: goblin, baseName: 'Goblin', size: 1, hidden: false })),
      space
    )
    expect(placements.map((item) => item.name)).toEqual(['Goblin 3', 'Goblin 4', 'Goblin 5'])

    const cells = new Set([...placements.map((item) => `${item.x},${item.y}`), '250,250'])
    expect(cells.size).toBe(4)
    for (const item of placements) {
      expect(Math.abs(item.x - 250)).toBeLessThanOrEqual(50)
      expect(Math.abs(item.y - 250)).toBeLessThanOrEqual(50)
      expect(item.x % 50).toBe(0)
    }
  })

  it('criatura grande ocupa os quadrados dela', () => {
    const ogre = creature({ id: 'o', name: 'Ogro', tokenSize: 2 })
    const [first, second] = planSpawn(
      [ogre, ogre].map((payload) => ({ payload, baseName: 'Ogro', size: 2, hidden: false })),
      { ...space, tokens: [] }
    )
    const apart =
      Math.abs((first?.x ?? 0) - (second?.x ?? 0)) >= 100 ||
      Math.abs((first?.y ?? 0) - (second?.y ?? 0)) >= 100
    expect(apart).toBe(true)
  })
})

describe('puxar jogadores', () => {
  const board = {
    grid,
    map: { width: 1000, height: 1000 },
    center: { x: 260, y: 260 },
    tokens: [
      { x: 0, y: 0, size: 1, ownerId: 'bruno', kind: 'player' },
      { x: 250, y: 250, size: 1, ownerId: 'mestre', kind: 'monster' }
    ]
  }
  const players = [
    { userId: 'bruno', token: { x: 0, y: 0, size: 1 } },
    { userId: 'carla', token: null }
  ]

  it('quem já está no mapa fica onde está', () => {
    const spots = planPlayerSpots(players, board, false)
    expect(spots.map((spot) => spot.userId)).toEqual(['carla'])
    expect(spots[0]).not.toMatchObject({ x: 250, y: 250 })
  })

  it('reagrupar leva todos para perto do centro, sem sobreposição', () => {
    const spots = planPlayerSpots(players, board, true)
    expect(spots.map((spot) => spot.userId)).toEqual(['bruno', 'carla'])
    const cells = new Set([...spots.map((spot) => `${spot.x},${spot.y}`), '250,250'])
    expect(cells.size).toBe(3)
    expect(spots.every((spot) => Math.abs(spot.x - 250) <= 50)).toBe(true)
  })
})

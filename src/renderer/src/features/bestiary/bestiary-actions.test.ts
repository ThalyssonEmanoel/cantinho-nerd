import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, DEFAULT_TOKEN_CROP, type BoardMap, type BoardToken } from '@/lib/board'
import type { Creature } from '@/lib/bestiary'
import type { SheetSchema, SheetTemplate } from '@/lib/sheet'

/**
 * Pôr criaturas e jogadores no mapa (seção 8). O banco cria tudo de uma vez; o que se
 * confere aqui é o que o app manda para ele: a parte do mestre separada, a imagem copiada
 * para a mesa (uma vez por criatura), posições sem sobreposição e a numeração.
 */

const db = vi.hoisted(() => ({
  spawnCreatures: vi.fn(async (_s: string, _m: string, items: unknown[]) =>
    items.map((_, index) => ({ tokenId: `tok-${index}`, sheetId: `sheet-${index}` }))
  ),
  pullPlayers: vi.fn(async (_s: string, _m: string, spots: unknown[]) => spots.length),
  createCreature: vi.fn()
}))
const assets = vi.hoisted(() => ({ copyAsset: vi.fn(async () => '') }))
const combat = vi.hoisted(() => ({ addTokensToCombat: vi.fn(async () => 0) }))
const templates = vi.hoisted(() => ({ get: vi.fn() }))
const session = vi.hoisted(() => ({ members: [] as unknown[] }))

vi.mock('@/lib/db/bestiary', () => db)
vi.mock('@/lib/db/assets', () => ({
  copyAsset: assets.copyAsset,
  tokenImagePath: (sessionId: string, hash: string) => `sessions/${sessionId}/tokens/${hash}.webp`
}))
vi.mock('@/features/combat/combat-actions', () => combat)
vi.mock('@/features/sheet-templates/repository', () => ({ templateRepository: templates }))
vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ session: { members: session.members } }) }
}))
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))

const actions = await import('./bestiary-actions')
const { useBoardStore } = await import('@/features/board/board-store')

const schema: SheetSchema = {
  formatVersion: 1,
  tabs: [
    {
      id: 't',
      label: 'Stat block',
      components: [
        {
          id: 'c_vida',
          type: 'resource',
          key: 'vida',
          label: 'Vida',
          maxValue: 7,
          showButtons: true,
          role: 'hp',
          editableBy: 'gm',
          visibleTo: 'all',
          layout: { x: 0, y: 0, w: 4, h: 2 }
        },
        {
          id: 'c_segredo',
          type: 'text',
          key: 'segredo',
          label: 'Segredo',
          editableBy: 'gm',
          visibleTo: 'gm',
          layout: { x: 4, y: 0, w: 4, h: 2 }
        }
      ]
    }
  ]
}

const template: SheetTemplate = {
  id: 'tpl',
  name: 'Bicho',
  kind: 'creature',
  draftSchema: schema,
  versions: [{ version: 1, schema, publishedAt: '' }],
  createdAt: '',
  updatedAt: ''
}

const grid = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }
const map: BoardMap = {
  id: 'm1',
  sessionId: 's1',
  name: 'Taverna',
  imagePath: 'x',
  width: 1000,
  height: 1000,
  grid,
  fog: { enabled: false, shapes: [] },
  sortOrder: 0
}

function token(partial: Partial<BoardToken> & { id: string }): BoardToken {
  return {
    sessionId: 's1',
    mapId: 'm1',
    sheetId: null,
    kind: 'monster',
    ownerId: 'ana',
    name: '',
    imagePath: null,
    crop: DEFAULT_TOKEN_CROP,
    x: 0,
    y: 0,
    size: 1,
    z: 0,
    hidden: false,
    showName: true,
    showBars: true,
    visionM: null,
    bars: {},
    conditions: [],
    ...partial
  }
}

const goblin: Creature = {
  id: 'goblin',
  name: 'Goblin',
  kind: 'monster',
  tags: [],
  templateId: 'tpl',
  templateVersion: 1,
  values: { c_vida: { current: 7 }, c_segredo: 'foge fácil' },
  imagePath: 'users/ana/gallery/abc.webp',
  tokenSize: 1,
  updatedAt: ''
}

beforeEach(() => {
  templates.get.mockResolvedValue(template)
  useBoardStore.setState({
    sessionId: 's1',
    maps: [map],
    openMapId: 'm1',
    viewport: { width: 0, height: 0 },
    tokens: [token({ id: 'g2', name: 'Goblin 2', x: 500, y: 500 })]
  })
})

afterEach(() => {
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

describe('pôr criaturas no mapa', () => {
  it('um encontro: ficha-instância de cada, parte do mestre separada, numeração do mapa', async () => {
    const outcome = await actions.spawnEncounter(
      { id: 'e', name: 'Emboscada', groups: [{ creatureId: 'goblin', count: 2, hidden: true }], updatedAt: '' },
      [goblin],
      { addToCombat: false }
    )

    expect(outcome).toEqual({ placed: 2, skipped: 0 })
    const [sessionId, mapId, items] = db.spawnCreatures.mock.calls[0] as unknown as [
      string,
      string,
      Array<Record<string, unknown>>
    ]
    expect([sessionId, mapId]).toEqual(['s1', 'm1'])
    expect(items.map((item) => item.name)).toEqual(['Goblin 3', 'Goblin 4'])
    expect(items.every((item) => item.hidden === true)).toBe(true)
    // O jogador nunca recebe a parte do mestre da ficha: ela vai para sheet_gm_data.
    expect(items[0]?.values).toEqual({ c_vida: { current: 7 } })
    expect(items[0]?.gmValues).toEqual({ c_segredo: 'foge fácil' })
    expect(items[0]?.summary).toMatchObject({ bars: { hp: { current: 7, max: 7 } } })
    // Imagem da galeria copiada para a mesa, uma vez só para as duas cópias.
    expect(assets.copyAsset).toHaveBeenCalledTimes(1)
    expect(assets.copyAsset).toHaveBeenCalledWith(
      'users/ana/gallery/abc.webp',
      'sessions/s1/tokens/abc.webp'
    )
    expect(items[0]?.imagePath).toBe('sessions/s1/tokens/abc.webp')
    // Sem sobreposição: cada uma num quadrado.
    expect(new Set(items.map((item) => `${String(item.x)},${String(item.y)}`)).size).toBe(2)
  })

  it('criatura excluída é pulada e contada; "já pôr no combate" põe os tokens novos', async () => {
    const outcome = await actions.spawnEncounter(
      {
        id: 'e',
        name: 'X',
        groups: [
          { creatureId: 'goblin', count: 1, hidden: false },
          { creatureId: 'sumiu', count: 3, hidden: false }
        ],
        updatedAt: ''
      },
      [goblin],
      { addToCombat: true }
    )
    expect(outcome).toEqual({ placed: 1, skipped: 1 })
    expect(combat.addTokensToCombat).toHaveBeenCalledWith(['tok-0'])
  })

  it('modelo que não abre: nada é criado para aquela criatura', async () => {
    templates.get.mockResolvedValue(null)
    const outcome = await actions.spawnCreature(
      { ...goblin, templateId: 'outro' },
      { hidden: false, addToCombat: false }
    )
    expect(outcome).toEqual({ placed: 0, skipped: 1 })
    expect(db.spawnCreatures).not.toHaveBeenCalled()
  })

  it('sem mapa aberto, avisa em vez de criar', async () => {
    useBoardStore.setState({ openMapId: null })
    await expect(
      actions.spawnCreature(goblin, { hidden: false, addToCombat: false })
    ).rejects.toThrow('Abra um mapa')
  })
})

describe('puxar jogadores', () => {
  beforeEach(() => {
    session.members = [
      { userId: 'ana', role: 'gm' },
      { userId: 'bruno', role: 'player' },
      { userId: 'carla', role: 'player' }
    ]
    useBoardStore.setState({
      tokens: [token({ id: 'lia', kind: 'player', ownerId: 'bruno', x: 0, y: 0 })]
    })
  })

  it('só quem não está no mapa; o mestre fica de fora', async () => {
    expect(await actions.pullPlayersToMap(false)).toBe(1)
    const [, , spots] = db.pullPlayers.mock.calls[0] as unknown as [string, string, Array<{ userId: string }>]
    expect(spots.map((spot) => spot.userId)).toEqual(['carla'])
  })

  it('reagrupar leva todos os jogadores', async () => {
    await actions.pullPlayersToMap(true)
    const [, , spots] = db.pullPlayers.mock.calls[0] as unknown as [string, string, Array<{ userId: string }>]
    expect(spots.map((spot) => spot.userId)).toEqual(['bruno', 'carla'])
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionChannelHandlers } from '@/lib/db/realtime'
import type { SessionDetail } from '@/lib/db/sessions'

/**
 * A sessão aberta (10.3): snapshot, e o tempo real por cima. O canal do Supabase é dublado
 * e os ouvintes ficam guardados, para simular os eventos chegando.
 */

const mocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  list: vi.fn(),
  migrate: vi.fn(async () => 0),
  handlers: null as SessionChannelHandlers | null,
  closeChannel: vi.fn(),
  broadcast: vi.fn(),
  applyRemote: vi.fn(),
  listMaps: vi.fn(async () => []),
  listTokens: vi.fn(async () => []),
  listDrawings: vi.fn(async () => []),
  fetchCombat: vi.fn(async () => ({
    state: { active: false, round: 0, turnEntryId: null },
    entries: []
  })),
  fetchCombatLog: vi.fn(async () => [])
}))

vi.mock('@/lib/db/sessions', () => ({ fetchSession: mocks.fetchSession }))
vi.mock('@/lib/db/sheets', () => ({ migrateOutdatedSheets: mocks.migrate }))
vi.mock('@/lib/db/realtime', () => ({
  openSessionChannel: (_id: string, _me: unknown, handlers: SessionChannelHandlers) => {
    mocks.handlers = handlers
    // O canal agora é um objeto: fecha e manda evento efêmero (Fase 6).
    return { close: mocks.closeChannel, broadcast: mocks.broadcast }
  }
}))
vi.mock('@/lib/db/maps', () => ({ listMaps: mocks.listMaps }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: mocks.listTokens, moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: mocks.listDrawings }))
// O combate também abre junto com a sessão (Fase 9).
vi.mock('@/lib/db/combat', () => ({
  fetchCombat: mocks.fetchCombat,
  fetchCombatLog: mocks.fetchCombatLog
}))
// O chat abre junto com a sessão; sem o dublê, o teste chegaria ao Supabase de verdade.
vi.mock('@/lib/db/chat', () => ({
  fetchFeed: vi.fn(async () => []),
  listMacros: vi.fn(async () => [])
}))
vi.mock('@/features/sheets/repository', () => ({ sheetRepository: { list: mocks.list } }))
vi.mock('@/features/sheets/sheet-store', () => ({
  useSheetStore: { getState: () => ({ applyRemote: mocks.applyRemote }) }
}))

const { useSessionStore } = await import('./session-store')
const { useBoardStore } = await import('@/features/board/board-store')
const { useLiveStore } = await import('@/features/board/live-store')
const { useCombatStore } = await import('@/features/combat/combat-store')

const viewer = { userId: 'bruno', displayName: 'Bruno', avatarPath: null }

function session(role: 'gm' | 'player'): SessionDetail {
  return {
    id: 's1',
    name: 'Mesa de sexta',
    inviteId: 'k3x9p2m7ab',
    gmId: 'ana',
    gmName: 'Ana',
    role,
    characterTemplateId: 't1',
    activeMapId: null,
    scale: { metersPerSquare: 1.5, diagonal: 'simple' as const },
    diceRules: { critical: { kind: 'natural' as const }, criticalFailureOnOne: true },
    conditions: [],
    defaultVisionM: 9,
    updatedAt: 'x',
    members: []
  }
}

const store = (): ReturnType<typeof useSessionStore.getState> => useSessionStore.getState()
const handlers = (): SessionChannelHandlers => mocks.handlers as SessionChannelHandlers

beforeEach(() => {
  mocks.handlers = null
  mocks.fetchSession.mockResolvedValue(session('player'))
  mocks.list.mockResolvedValue([])
})

afterEach(() => {
  store().close()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('abrir a sessão', () => {
  it('carrega o snapshot e abre o canal', async () => {
    await store().open('s1', viewer)
    expect(store().loadState).toBe('ready')
    expect(store().session?.name).toBe('Mesa de sexta')
    expect(mocks.handlers).not.toBeNull()
  })

  it('quem não está na mesa vê o aviso, e nenhum canal abre', async () => {
    mocks.fetchSession.mockResolvedValueOnce(null)
    await store().open('s1', viewer)
    expect(store().loadState).toBe('missing')
    expect(mocks.handlers).toBeNull()
  })

  it('o mestre leva as fichas desatualizadas para a versão nova', async () => {
    mocks.fetchSession.mockResolvedValueOnce(session('gm'))
    await store().open('s1', viewer)
    expect(mocks.migrate).toHaveBeenCalled()
  })

  it('o jogador não migra nada', async () => {
    await store().open('s1', viewer)
    expect(mocks.migrate).not.toHaveBeenCalled()
  })

  it('fechar desliga o canal', async () => {
    await store().open('s1', viewer)
    store().close()
    expect(mocks.closeChannel).toHaveBeenCalled()
    expect(store().session).toBeNull()
  })
})

describe('eventos do canal', () => {
  it('presença atualiza quem está online', async () => {
    await store().open('s1', viewer)
    handlers().onPresence([{ ...viewer, role: 'player' }])
    expect(store().presence.map((member) => member.userId)).toEqual(['bruno'])
  })

  it('alguém gravou numa ficha: a ficha aberta recebe, e a lista recarrega', async () => {
    vi.useFakeTimers()
    await store().open('s1', viewer)
    mocks.list.mockClear()

    handlers().onSheetChange({
      event: 'UPDATE',
      row: { id: 'f1', values: { c_nome: 'Lia' }, template_version: 1, updated_at: 't' },
      old: {}
    })
    expect(mocks.applyRemote).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: 'f1', values: { c_nome: 'Lia' } })
    )

    // Vários eventos seguidos viram uma recarga só.
    handlers().onSheetChange({ event: 'UPDATE', row: { id: 'f1' }, old: {} })
    await vi.advanceTimersByTimeAsync(400)
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })

  it('a parte do mestre de uma ficha também chega na ficha aberta', async () => {
    await store().open('s1', viewer)
    handlers().onGmDataChange({
      event: 'UPDATE',
      row: { sheet_id: 'f1', values: { c_segredo: 's' }, orphaned: {} },
      old: {}
    })
    expect(mocks.applyRemote).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: 'f1', gmValues: { c_segredo: 's' } })
    )
  })

  it('a sessão excluída avisa quem estava dentro', async () => {
    await store().open('s1', viewer)
    handlers().onSessionChange({ event: 'DELETE', row: {}, old: { id: 's1' } })
    expect(store().loadState).toBe('missing')
    expect(store().problem).toMatch(/excluiu/)
  })

  it('removido da mesa: ao recarregar, a sessão some', async () => {
    await store().open('s1', viewer)
    mocks.fetchSession.mockResolvedValueOnce(null)
    handlers().onMembersChange({ event: 'DELETE', row: {}, old: {} })
    await vi.waitFor(() => expect(store().loadState).toBe('missing'))
  })

  it('caiu e voltou: recarrega o snapshot (10.3)', async () => {
    await store().open('s1', viewer)
    handlers().onStatus('live')
    mocks.fetchSession.mockClear()

    handlers().onStatus('reconnecting')
    expect(store().connection).toBe('reconnecting')
    handlers().onStatus('live')
    await vi.waitFor(() => expect(mocks.fetchSession).toHaveBeenCalledTimes(1))
  })
})

describe('desenho, régua, ping e reações (6.3, 6.5)', () => {
  const drawingRow = {
    id: 'd1',
    session_id: 's1',
    map_id: 'm1',
    author_id: 'carla',
    tool: 'line',
    points: [0, 0, 50, 50],
    color: '#ef4444',
    width: 4,
    created_at: '2026-10-29T12:00:00Z'
  }

  async function openOnMap(): Promise<void> {
    await store().open('s1', viewer)
    useBoardStore.setState({ openMapId: 'm1', activeMapId: 'm1' })
  }

  it('o traço ao vivo aparece e o salvo toma o lugar dele, pelo mesmo id', async () => {
    await openOnMap()
    handlers().onBroadcast('draw-live', {
      id: 'd1',
      mapId: 'm1',
      authorId: 'carla',
      tool: 'line',
      points: [0, 0, 30, 30],
      color: '#ef4444',
      width: 4
    })
    expect(Object.keys(useLiveStore.getState().strokes)).toEqual(['d1'])

    handlers().onDrawingChange({ event: 'INSERT', row: drawingRow, old: {} })
    expect(useLiveStore.getState().strokes).toEqual({})
    expect(useBoardStore.getState().drawings.map((drawing) => drawing.id)).toEqual(['d1'])
  })

  it('um aviso ao vivo atrasado não duplica o traço já salvo', async () => {
    await openOnMap()
    handlers().onDrawingChange({ event: 'INSERT', row: drawingRow, old: {} })
    handlers().onBroadcast('draw-live', {
      id: 'd1',
      mapId: 'm1',
      authorId: 'carla',
      tool: 'line',
      points: [0, 0, 50, 50],
      color: '#ef4444',
      width: 4
    })
    expect(useLiveStore.getState().strokes).toEqual({})
  })

  it('payload torto é ignorado, não derruba nada', async () => {
    await openOnMap()
    handlers().onBroadcast('draw-live', { id: 'x', tool: 'spray' })
    handlers().onBroadcast('reaction', { userId: 'u', mapId: 'm1', tokenId: 't', emoji: '<b>' })
    handlers().onBroadcast('ruler', { userId: 'u', mapId: 'm1', from: 'aqui' })
    expect(useLiveStore.getState().strokes).toEqual({})
    expect(useLiveStore.getState().reactions).toEqual([])
    expect(useLiveStore.getState().rulers).toEqual({})
  })

  it('o DELETE (só com o id) e o "limpar todos" tiram os desenhos da tela', async () => {
    await openOnMap()
    handlers().onDrawingChange({ event: 'INSERT', row: drawingRow, old: {} })
    handlers().onDrawingChange({ event: 'INSERT', row: { ...drawingRow, id: 'd2' }, old: {} })

    handlers().onDrawingChange({ event: 'DELETE', row: {}, old: { id: 'd1' } })
    expect(useBoardStore.getState().drawings.map((drawing) => drawing.id)).toEqual(['d2'])

    handlers().onBroadcast('drawings-cleared', { mapId: 'm1', authorId: null })
    expect(useBoardStore.getState().drawings).toEqual([])
  })

  it('régua, ping e reação chegam ao store dos efeitos', async () => {
    await openOnMap()
    handlers().onBroadcast('ruler', {
      userId: 'carla',
      mapId: 'm1',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 }
    })
    handlers().onBroadcast('ping', { userId: 'carla', mapId: 'm1', x: 10, y: 20 })
    handlers().onBroadcast('reaction', { userId: 'carla', mapId: 'm1', tokenId: 't1', emoji: '🎉' })

    const live = useLiveStore.getState()
    expect(live.rulers.carla?.to).toEqual({ x: 100, y: 0 })
    expect(live.pings.map((ping) => ping.point)).toEqual([{ x: 10, y: 20 }])
    expect(live.reactions.map((reaction) => reaction.emoji)).toEqual(['🎉'])

    handlers().onBroadcast('ruler', { userId: 'carla', mapId: 'm1', from: { x: 0, y: 0 }, to: null })
    expect(useLiveStore.getState().rulers).toEqual({})
  })

  it('caiu e voltou: os desenhos do mapa são recarregados', async () => {
    await openOnMap()
    handlers().onStatus('live')
    mocks.listDrawings.mockClear()

    handlers().onStatus('reconnecting')
    handlers().onStatus('live')
    await vi.waitFor(() => expect(mocks.listDrawings).toHaveBeenCalledWith('m1'))
  })
})

describe('combate (7.3)', () => {
  const entryRow = {
    id: 'e1',
    session_id: 's1',
    token_id: 't1',
    name: 'Goblin',
    image_path: null,
    owner_id: 'ana',
    kind: 'monster',
    hidden: false,
    show_name: true,
    initiative: '15',
    sort_order: 1
  }

  it('abre junto com a sessão', async () => {
    await store().open('s1', viewer)
    expect(mocks.fetchCombat).toHaveBeenCalledWith('s1')
    expect(useCombatStore.getState().sessionId).toBe('s1')
  })

  it('estado, participantes e log chegam pelo canal', async () => {
    await store().open('s1', viewer)
    handlers().onCombatEntryChange({ event: 'INSERT', row: entryRow, old: {} })
    handlers().onCombatStateChange({
      event: 'UPDATE',
      row: { session_id: 's1', active: true, round: 2, turn_entry_id: 'e1' },
      old: {}
    })
    handlers().onCombatLogChange({
      event: 'INSERT',
      row: {
        id: 'l1',
        actor_id: 'ana',
        token_id: 't1',
        token_name: 'Goblin',
        kind: 'damage',
        amount: 3,
        hp_before: 10,
        hp_after: 7,
        created_at: 'agora'
      },
      old: {}
    })

    const combat = useCombatStore.getState()
    expect(combat.state).toEqual({ active: true, round: 2, turnEntryId: 'e1' })
    // `numeric` chega como texto pelo tempo real.
    expect(combat.entries[0]?.initiative).toBe(15)
    expect(combat.log.map((item) => item.after)).toEqual([7])
  })

  it('token que passou a oculto sai do tracker do jogador (o UPDATE não chega)', async () => {
    await store().open('s1', viewer)
    handlers().onCombatEntryChange({ event: 'INSERT', row: entryRow, old: {} })
    handlers().onBroadcast('token-gone', { id: 't1' })
    expect(useCombatStore.getState().entries).toEqual([])
  })

  it('o mestre limpou o log: some de uma vez', async () => {
    await store().open('s1', viewer)
    useCombatStore.setState({
      log: [
        {
          id: 'l1',
          actorId: 'ana',
          tokenId: null,
          tokenName: 'Goblin',
          tokenOwnerId: null,
          kind: 'damage',
          amount: 1,
          before: 2,
          after: 1,
          tokenHidden: false,
          barsHidden: false,
          nameHidden: false,
          createdAt: ''
        }
      ]
    })
    handlers().onBroadcast('combat-log-cleared', {})
    expect(useCombatStore.getState().log).toEqual([])
  })

  it('caiu e voltou: o combate é recarregado', async () => {
    await store().open('s1', viewer)
    handlers().onStatus('live')
    mocks.fetchCombat.mockClear()
    handlers().onStatus('reconnecting')
    handlers().onStatus('live')
    await vi.waitFor(() => expect(mocks.fetchCombat).toHaveBeenCalledWith('s1'))
  })
})

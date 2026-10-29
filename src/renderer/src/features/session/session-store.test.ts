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
  listTokens: vi.fn(async () => [])
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
vi.mock('@/features/sheets/repository', () => ({ sheetRepository: { list: mocks.list } }))
vi.mock('@/features/sheets/sheet-store', () => ({
  useSheetStore: { getState: () => ({ applyRemote: mocks.applyRemote }) }
}))

const { useSessionStore } = await import('./session-store')

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

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionChannelHandlers } from './realtime'

/**
 * O canal da sessão (10.3): que assinaturas ele pede ao Realtime.
 *
 * O bug que este teste prende: o DELETE de uma tabela cuja chave é só o `id` nunca casava com
 * o filtro `session_id=eq.…` (numa linha apagada o Realtime só conhece a chave), então token,
 * desenho e pista apagados só sumiam de quem saísse e voltasse para a mesa.
 */

interface Binding {
  type: string
  filter: { event?: string; table?: string; filter?: string }
  callback: (payload: unknown) => void
}

const fake = vi.hoisted(() => {
  const bindings: Binding[] = []
  const channel = {
    on: (type: string, filter: Binding['filter'], callback: Binding['callback']) => {
      bindings.push({ type, filter, callback })
      return channel
    },
    subscribe: vi.fn(() => channel),
    track: vi.fn(async () => 'ok'),
    send: vi.fn(async () => 'ok'),
    presenceState: () => ({})
  }
  const client = {
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok')
  }
  return { bindings, channel, client }
})

vi.mock('./client', () => ({ getSupabase: () => fake.client }))

const { DELETE_BY_ID_TABLES, openSessionChannel } = await import('./realtime')

function handlers(): SessionChannelHandlers {
  return {
    onStatus: vi.fn(),
    onPresence: vi.fn(),
    onSessionChange: vi.fn(),
    onMembersChange: vi.fn(),
    onSheetChange: vi.fn(),
    onGmDataChange: vi.fn(),
    onMapChange: vi.fn(),
    onTokenChange: vi.fn(),
    onDrawingChange: vi.fn(),
    onCombatStateChange: vi.fn(),
    onCombatEntryChange: vi.fn(),
    onCombatLogChange: vi.fn(),
    onMessageChange: vi.fn(),
    onRollChange: vi.fn(),
    onClueChange: vi.fn(),
    onBroadcast: vi.fn()
  }
}

async function open(on: SessionChannelHandlers): Promise<void> {
  openSessionChannel(
    'mesa-1',
    { userId: 'u1', displayName: 'Ana', avatarPath: null, role: 'player' },
    on
  )
  // O canal só é montado depois do `setAuth`, que é assíncrono.
  await vi.waitFor(() => expect(fake.channel.subscribe).toHaveBeenCalled())
}

function changesOf(table: string): Binding[] {
  return fake.bindings.filter(
    (binding) => binding.type === 'postgres_changes' && binding.filter.table === table
  )
}

afterEach(() => {
  fake.bindings.length = 0
  vi.clearAllMocks()
})

describe('canal da sessão', () => {
  it('cada tabela de chave `id` assina o DELETE sem filtro', async () => {
    await open(handlers())

    for (const table of DELETE_BY_ID_TABLES) {
      const deletes = changesOf(table).filter((binding) => binding.filter.event === 'DELETE')
      expect(deletes, table).toHaveLength(1)
      expect(deletes[0]?.filter.filter, table).toBeUndefined()
    }
  })

  it('INSERT e UPDATE continuam filtrados pela mesa', async () => {
    await open(handlers())

    for (const table of DELETE_BY_ID_TABLES) {
      const all = changesOf(table).filter((binding) => binding.filter.event === '*')
      expect(all, table).toHaveLength(1)
      expect(all[0]?.filter.filter, table).toBe('session_id=eq.mesa-1')
    }
  })

  it('o DELETE sem filtro chega ao store certo, só com o id', async () => {
    const on = handlers()
    await open(on)

    const deleteOf = (table: string): Binding['callback'] => {
      const binding = changesOf(table).find((item) => item.filter.event === 'DELETE')
      if (binding === undefined) throw new Error(`Sem DELETE em ${table}`)
      return binding.callback
    }

    deleteOf('tokens')({ eventType: 'DELETE', new: {}, old: { id: 'token-1' } })
    expect(on.onTokenChange).toHaveBeenCalledWith({
      event: 'DELETE',
      row: {},
      old: { id: 'token-1' }
    })

    deleteOf('drawings')({ eventType: 'DELETE', new: {}, old: { id: 'traco-1' } })
    expect(on.onDrawingChange).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'DELETE', old: { id: 'traco-1' } })
    )

    deleteOf('maps')({ eventType: 'DELETE', new: {}, old: { id: 'mapa-1' } })
    deleteOf('sheets')({ eventType: 'DELETE', new: {}, old: { id: 'ficha-1' } })
    deleteOf('combat_entries')({ eventType: 'DELETE', new: {}, old: { id: 'entrada-1' } })
    deleteOf('clues')({ eventType: 'DELETE', new: {}, old: { id: 'pista-1' } })
    expect(on.onMapChange).toHaveBeenCalledTimes(1)
    expect(on.onSheetChange).toHaveBeenCalledTimes(1)
    expect(on.onCombatEntryChange).toHaveBeenCalledTimes(1)
    expect(on.onClueChange).toHaveBeenCalledTimes(1)
  })

  it('as tabelas com `session_id` na chave, e as que se limpam por aviso, não precisam', async () => {
    await open(handlers())

    // `session_members` e `combat_state`: o DELETE já casa com o filtro, porque a mesa está
    // na chave. Chat, rolagens e log: limpar avisa pelo canal, de uma vez.
    for (const table of ['session_members', 'combat_state', 'messages', 'rolls', 'combat_log']) {
      const unfiltered = changesOf(table).filter((binding) => binding.filter.filter === undefined)
      expect(unfiltered, table).toEqual([])
    }
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMember } from '@/lib/chat/commands'
import { DEFAULT_DICE_RULES } from '@/lib/chat/tray'

/**
 * O chat da mesa (7.1, 7.2). O banco é dublado; o que se prova aqui é o caminho de cada
 * coisa: comando → gravação certa, evento do tempo real → tela, não lidas e o som do
 * sussurro.
 */

const db = vi.hoisted(() => ({
  fetchFeed: vi.fn(),
  listMacros: vi.fn(),
  sendMessage: vi.fn(),
  postRoll: vi.fn(),
  clearChat: vi.fn(),
  clearRolls: vi.fn(),
  addMacro: vi.fn(),
  removeMacro: vi.fn()
}))
vi.mock('@/lib/db/chat', () => db)

const chime = vi.hoisted(() => vi.fn())
vi.mock('@/lib/chat/sound', () => ({ playWhisperChime: chime }))

const { useChatStore } = await import('./chat-store')
const { useAppStore } = await import('@/stores/app-store')

const store = (): ReturnType<typeof useChatStore.getState> => useChatStore.getState()
const broadcast = vi.fn()

const members: ChatMember[] = [
  { userId: 'ana', displayName: 'Ana', username: 'ana', role: 'gm' },
  { userId: 'bruno', displayName: 'Bruno', username: 'bruno', role: 'player' }
]

const messageRow = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  author_id: 'ana',
  recipient_id: null,
  body: 'oi',
  created_at: `2026-10-29T10:00:0${id.length}Z`,
  ...extra
})

beforeEach(async () => {
  db.fetchFeed.mockResolvedValue([])
  db.listMacros.mockResolvedValue([])
  db.sendMessage.mockImplementation(
    async (_session: string, body: string, recipientId: string | null) => ({
      kind: 'message',
      id: `m-${body}`,
      authorId: 'bruno',
      recipientId,
      body,
      createdAt: '2026-10-29T11:00:00Z'
    })
  )
  db.postRoll.mockImplementation(
    async (
      _session: string,
      roll: { source: string; total: number },
      options: { secret: boolean }
    ) => ({
      kind: 'roll',
      id: `r-${roll.source}`,
      authorId: 'bruno',
      label: '',
      formula: roll.source,
      notation: roll.source,
      detail: '',
      dice: [],
      total: roll.total,
      outcome: 'normal',
      secret: options.secret,
      createdAt: '2026-10-29T11:00:01Z'
    })
  )
  useAppStore.setState({ whisperSound: true })
  await store().open('s1', 'bruno', broadcast)
})

afterEach(() => {
  store().close()
  vi.clearAllMocks()
})

describe('tempo real', () => {
  it('mensagem nova de outra pessoa entra e conta como não lida', () => {
    store().applyChange('message', { event: 'INSERT', row: messageRow('m1'), old: {} })
    expect(store().feed).toHaveLength(1)
    expect(store().unread).toBe(1)
  })

  it('com o chat à vista, nada fica como não lido — e abrir zera as que havia', () => {
    store().applyChange('message', { event: 'INSERT', row: messageRow('m1'), old: {} })
    store().watch(true)
    expect(store().unread).toBe(0)
    store().applyChange('message', { event: 'INSERT', row: messageRow('m22'), old: {} })
    expect(store().unread).toBe(0)
    store().watch(false)
  })

  it('o eco da minha própria mensagem não duplica nem conta', async () => {
    await store().sendInput('Oi, mesa', members, DEFAULT_DICE_RULES)
    store().applyChange('message', {
      event: 'INSERT',
      row: messageRow('m-Oi, mesa', { author_id: 'bruno', body: 'Oi, mesa' }),
      old: {}
    })
    expect(store().feed).toHaveLength(1)
    expect(store().unread).toBe(0)
  })

  it('sussurro para mim toca o som; com o som desligado, não', () => {
    store().applyChange('message', {
      event: 'INSERT',
      row: messageRow('m1', { recipient_id: 'bruno' }),
      old: {}
    })
    expect(chime).toHaveBeenCalledTimes(1)

    useAppStore.setState({ whisperSound: false })
    store().applyChange('message', {
      event: 'INSERT',
      row: messageRow('m22', { recipient_id: 'bruno' }),
      old: {}
    })
    expect(chime).toHaveBeenCalledTimes(1)
  })

  it('DELETE tira pelo id; o aviso de limpeza esvazia o tipo de uma vez', () => {
    store().applyChange('message', { event: 'INSERT', row: messageRow('m1'), old: {} })
    store().applyChange('message', { event: 'INSERT', row: messageRow('m22'), old: {} })
    store().applyChange('message', { event: 'DELETE', row: {}, old: { id: 'm1' } })
    expect(store().feed.map((item) => item.id)).toEqual(['m22'])
    store().applyCleared('message')
    expect(store().feed).toEqual([])
  })
})

describe('o que se digita', () => {
  it('texto comum vira mensagem pública', async () => {
    expect(await store().sendInput('Oi, mesa', members, DEFAULT_DICE_RULES)).toEqual({ ok: true })
    expect(db.sendMessage).toHaveBeenCalledWith('s1', 'Oi, mesa', null)
  })

  it('/w vira sussurro para a pessoa certa', async () => {
    await store().sendInput('/w Ana posso abrir a porta?', members, DEFAULT_DICE_RULES)
    expect(db.sendMessage).toHaveBeenCalledWith('s1', 'posso abrir a porta?', 'ana')
  })

  it('/r rola com a regra de crítico da mesa e grava', async () => {
    await store().sendInput('/r 2d6+3', members, DEFAULT_DICE_RULES)
    expect(db.postRoll).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ source: '2d6+3', notation: '2d6+3' }),
      { secret: false }
    )
    expect(store().feed.at(-1)?.kind).toBe('roll')
  })

  it('fórmula inválida volta como erro e nada é gravado', async () => {
    const result = await store().sendInput('/r 2x6', members, DEFAULT_DICE_RULES)
    expect(result.ok).toBe(false)
    expect(db.postRoll).not.toHaveBeenCalled()
  })

  it('comando errado explica, sem gravar', async () => {
    const result = await store().sendInput('/w Zé oi', members, DEFAULT_DICE_RULES)
    expect(result).toEqual({ ok: false, message: 'Não achei ninguém com esse nome na mesa.' })
    expect(db.sendMessage).not.toHaveBeenCalled()
  })
})

describe('rolagens', () => {
  it('rolagem secreta vai marcada (7.1)', async () => {
    await store().roll({ formula: '1d20', ...DEFAULT_DICE_RULES, secret: true })
    expect(db.postRoll).toHaveBeenCalledWith('s1', expect.anything(), { secret: true })
  })

  it('botão da ficha leva o rótulo ("Furtividade: 17")', async () => {
    await store().roll({ formula: '1d20 + 3', label: 'Furtividade', ...DEFAULT_DICE_RULES })
    expect(db.postRoll).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ label: 'Furtividade' }),
      { secret: false }
    )
  })
})

describe('o mestre limpa', () => {
  it('apaga no banco, esvazia a tela e avisa os outros pelo canal', async () => {
    store().applyChange('message', { event: 'INSERT', row: messageRow('m1'), old: {} })
    expect(await store().clear('message')).toEqual({ ok: true })
    expect(db.clearChat).toHaveBeenCalledWith('s1')
    expect(store().feed).toEqual([])
    expect(broadcast).toHaveBeenCalledWith('feed-cleared', { kind: 'message' })
  })

  it('recusa do banco (jogador tentando) não avisa ninguém', async () => {
    db.clearRolls.mockRejectedValueOnce(new Error('sem permissão'))
    expect((await store().clear('roll')).ok).toBe(false)
    expect(broadcast).not.toHaveBeenCalled()
  })
})

describe('favoritas', () => {
  it('tirar é otimista e volta se o banco recusar', async () => {
    useChatStore.setState({ macros: [{ id: 'x', label: 'Ataque', formula: '1d20+5' }] })
    db.removeMacro.mockRejectedValueOnce(new Error('falhou'))
    const result = await store().deleteMacro('x')
    expect(result.ok).toBe(false)
    expect(store().macros).toHaveLength(1)
  })
})

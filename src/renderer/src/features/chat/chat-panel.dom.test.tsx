import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedItem } from '@/lib/chat/feed'
import type { SessionDetail } from '@/lib/db/sessions'
import { buttonByText, byLabel, typeInto } from '@/test/dom-helpers'

/** O painel do chat (7.1, 7.2), montado com o banco dublado. */

const db = vi.hoisted(() => ({
  fetchFeed: vi.fn(async () => []),
  listMacros: vi.fn(async () => []),
  sendMessage: vi.fn(),
  postRoll: vi.fn(),
  clearChat: vi.fn(),
  clearRolls: vi.fn(),
  addMacro: vi.fn(),
  removeMacro: vi.fn()
}))
vi.mock('@/lib/db/chat', () => db)
vi.mock('@/features/sheets/repository', () => ({
  sheetRepository: { list: vi.fn(async () => []) }
}))
vi.mock('@/lib/db/sessions', () => ({ fetchSession: vi.fn() }))
vi.mock('@/lib/db/sheets', () => ({ migrateOutdatedSheets: vi.fn() }))
vi.mock('@/lib/db/realtime', () => ({
  openSessionChannel: () => ({ close: () => {}, broadcast: () => {} })
}))
vi.mock('@/lib/db/auth', () => ({ onAuthChange: () => () => {} }))
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn(), avatarUrl: (path: string) => path }))

const { ChatPanel } = await import('./chat-panel')
const { useChatStore } = await import('./chat-store')
const { useSessionStore } = await import('@/features/session/session-store')
const { useAuthStore } = await import('@/stores/auth-store')

function session(role: 'gm' | 'player'): SessionDetail {
  return {
    id: 's1',
    name: 'Mesa',
    inviteId: 'k3x9p2m7ab',
    gmId: 'ana',
    gmName: 'Ana',
    role,
    characterTemplateId: null,
    activeMapId: null,
    scale: { metersPerSquare: 1.5, diagonal: 'simple' },
    diceRules: { critical: { kind: 'natural' }, criticalFailureOnOne: true },
    conditions: [],
    defaultVisionM: 9,
    updatedAt: 'x',
    members: [
      {
        userId: 'ana',
        role: 'gm',
        displayName: 'Ana',
        username: 'ana',
        avatarPath: null,
        joinedAt: '1'
      },
      {
        userId: 'bruno',
        role: 'player',
        displayName: 'Bruno',
        username: 'bruno',
        avatarPath: null,
        joinedAt: '2'
      },
      {
        userId: 'carla',
        role: 'player',
        displayName: 'Carla',
        username: 'carla',
        avatarPath: null,
        joinedAt: '3'
      }
    ]
  }
}

const feed: FeedItem[] = [
  {
    kind: 'message',
    id: 'm1',
    authorId: 'ana',
    recipientId: null,
    body: 'mapa em https://exemplo.com/mapa ok',
    createdAt: '2026-10-29T10:00:00Z'
  },
  {
    kind: 'message',
    id: 'm2',
    authorId: 'carla',
    recipientId: 'bruno',
    body: 'psiu',
    createdAt: '2026-10-29T10:01:00Z'
  },
  {
    kind: 'roll',
    id: 'r1',
    authorId: 'bruno',
    label: 'Furtividade',
    formula: '1d20+3',
    notation: '1d20 + 3',
    detail: '',
    dice: [{ sides: 20, value: 14, dropped: false, exploded: false }],
    total: 17,
    outcome: 'normal',
    secret: true,
    createdAt: '2026-10-29T10:02:00Z'
  }
]

let root: Root
let container: HTMLElement

async function render(role: 'gm' | 'player'): Promise<void> {
  useAuthStore.setState({ userId: role === 'gm' ? 'ana' : 'bruno' })
  useSessionStore.setState({ session: session(role), sessionId: 's1' })
  useChatStore.setState({
    sessionId: 's1',
    userId: role === 'gm' ? 'ana' : 'bruno',
    feed,
    loadState: 'ready',
    unread: 3
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<ChatPanel />))
}

beforeEach(() => {
  Object.assign(globalThis.api, { openExternal: vi.fn(async () => true) })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('ChatPanel', () => {
  it('mostra mensagens, sussurros e rolagens numa linha só', async () => {
    await render('player')
    const text = container.textContent ?? ''
    expect(text).toContain('Ana')
    expect(text).toContain('sussurro para você')
    expect(text).toContain('Furtividade')
    expect(text).toContain('17')
    expect(text).toContain('secreta')
  })

  it('abrir o chat zera as não lidas', async () => {
    await render('player')
    expect(useChatStore.getState().unread).toBe(0)
  })

  it('link vira clique que abre no navegador, e o resto é texto', async () => {
    await render('player')
    const link = buttonByText(container, 'https://exemplo.com/mapa')
    act(() => link.click())
    expect(window.api.openExternal).toHaveBeenCalledWith('https://exemplo.com/mapa')
    expect(container.querySelector('a')).toBeNull()
  })

  it('a bandeja monta 2d6 com dois cliques', async () => {
    await render('player')
    const d6 = byLabel<HTMLButtonElement>(container, 'd6')
    act(() => d6.click())
    act(() => d6.click())
    expect(buttonByText(container, 'Rolar 2d6')).toBeDefined()
  })

  it('o jogador é avisado de que o mestre vê os sussurros', async () => {
    await render('player')
    const select = byLabel<HTMLSelectElement>(container, 'Para quem')
    act(() => {
      select.value = 'carla'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).toContain('O mestre vê todos os sussurros.')
  })

  it('mandar texto com destinatário escolhido vira sussurro', async () => {
    db.sendMessage.mockResolvedValueOnce({ ...feed[0], id: 'novo' })
    await render('player')
    const select = byLabel<HTMLSelectElement>(container, 'Para quem')
    act(() => {
      select.value = 'carla'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    typeInto(byLabel<HTMLInputElement>(container, 'Mensagem'), 'bora?')
    await act(async () => byLabel<HTMLButtonElement>(container, 'Mandar').click())
    expect(db.sendMessage).toHaveBeenCalledWith('s1', 'bora?', 'carla')
  })

  it('só o mestre tem os botões de limpar', async () => {
    await render('player')
    expect(container.querySelector('[title="Apagar todas as mensagens"]')).toBeNull()

    act(() => root.unmount())
    container.remove()
    await render('gm')
    expect(container.querySelector('[title="Apagar todas as mensagens"]')).not.toBeNull()
    expect(container.querySelector('[title="Excluir o histórico de rolagens"]')).not.toBeNull()
  })
})

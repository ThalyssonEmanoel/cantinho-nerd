import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionDetail } from '@/lib/db/sessions'
import type { SheetSummaryRow } from '@/lib/sheet'
import { buttonByText } from '@/test/dom-helpers'

/** A mesa (Fase 5): o jogador cria o personagem; o mestre vê as fichas de todos. */

const repo = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(async () => []) }))
vi.mock('@/features/sheets/repository', () => ({ sheetRepository: repo }))
vi.mock('@/lib/db/sessions', () => ({ fetchSession: vi.fn() }))
vi.mock('@/lib/db/sheets', () => ({ migrateOutdatedSheets: vi.fn() }))
vi.mock('@/lib/db/realtime', () => ({ openSessionChannel: () => () => {} }))
vi.mock('@/lib/db/auth', () => ({ onAuthChange: () => () => {} }))
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn(), avatarUrl: (path: string) => path }))

const { SessionTablePage } = await import('./session-table-page')
const { useSessionStore } = await import('./session-store')
const { useAuthStore } = await import('@/stores/auth-store')

const members: SessionDetail['members'] = [
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
  }
]

function session(role: 'gm' | 'player', templateId: string | null = 't1'): SessionDetail {
  return {
    id: 's1',
    name: 'Mesa de sexta',
    inviteId: 'k3x9p2m7ab',
    gmId: 'ana',
    gmName: 'Ana',
    role,
    characterTemplateId: templateId,
    activeMapId: null,
    scale: { metersPerSquare: 1.5, diagonal: 'simple' as const },
    updatedAt: 'x',
    members
  }
}

const brunoSheet: SheetSummaryRow = {
  id: 'f1',
  templateId: 't1',
  templateName: 'Ordem',
  templateVersion: 1,
  ownerName: 'Bruno',
  ownerId: 'bruno',
  name: 'Lia Vaz',
  bars: { hp: { current: 7, max: 16 } },
  updatedAt: 'x',
  sessionId: 's1'
}

let root: Root
let container: HTMLElement

async function render(): Promise<void> {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes>
          <Route path="/session/:sessionId" element={<SessionTablePage />} />
          <Route path="/session/:sessionId/sheets/:sheetId" element={<p>ficha aberta</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('SessionTablePage', () => {
  it('jogador sem personagem cria o dele e cai na ficha', async () => {
    useAuthStore.setState({
      userId: 'bruno',
      profile: { id: 'bruno', username: 'bruno', displayName: 'Bruno', bio: '', avatarPath: null }
    })
    useSessionStore.setState({
      session: session('player'),
      sheets: [],
      presence: [],
      sessionId: 's1'
    })
    repo.create.mockResolvedValueOnce({ id: 'novo' })
    await render()

    await act(async () => buttonByText(container, 'Criar meu personagem').click())
    expect(repo.create).toHaveBeenCalledWith({
      sessionId: 's1',
      templateId: 't1',
      ownerName: 'Bruno'
    })
    expect(container.textContent).toContain('ficha aberta')
  })

  it('sem sistema escolhido, o jogador é avisado em vez de ver um botão que não funciona', async () => {
    useAuthStore.setState({ userId: 'bruno' })
    useSessionStore.setState({ session: session('player', null), sheets: [], presence: [] })
    await render()
    expect(container.textContent).toContain('O mestre ainda não escolheu o sistema')
    expect(container.textContent).not.toContain('Criar meu personagem')
  })

  it('o mestre vê as fichas dos jogadores e quem está online', async () => {
    useAuthStore.setState({ userId: 'ana' })
    useSessionStore.setState({
      session: session('gm'),
      sheets: [brunoSheet],
      presence: [{ userId: 'bruno', displayName: 'Bruno', avatarPath: null, role: 'player' }]
    })
    await render()

    const text = container.textContent ?? ''
    expect(text).toContain('Lia Vaz')
    expect(text).toContain('7 / 16')
    expect(text).toContain('Na mesa (2)')
    expect(container.querySelectorAll('[title="online"]').length).toBe(1)

    await act(async () => buttonByText(container, 'Lia Vaz').click())
    expect(container.textContent).toContain('ficha aberta')
  })
})

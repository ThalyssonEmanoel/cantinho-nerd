import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionSummary } from '@/lib/db/sessions'
import { buttonByText, typeInto } from '@/test/dom-helpers'

/** Lobby do mestre (4.3): listar, criar, copiar convite e excluir. */

const sessions = vi.hoisted(() => ({
  listMySessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  fetchSessionPassword: vi.fn()
}))
vi.mock('@/lib/db/sessions', () => sessions)
vi.mock('@/lib/db/auth', () => ({ onAuthChange: () => () => {} }))
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn() }))
vi.mock('@/features/sheet-templates/repository', () => ({
  templateRepository: {
    list: async () => [
      {
        id: 't1',
        name: 'Ordem',
        kind: 'character',
        publishedVersion: 2,
        componentCount: 9,
        updatedAt: ''
      },
      {
        id: 't2',
        name: 'Rascunho',
        kind: 'character',
        publishedVersion: null,
        componentCount: 1,
        updatedAt: ''
      },
      {
        id: 't3',
        name: 'Bestas',
        kind: 'creature',
        publishedVersion: 1,
        componentCount: 4,
        updatedAt: ''
      }
    ]
  }
}))

const { GmLobbyPage } = await import('./gm-lobby-page')
const { useAuthStore } = await import('@/stores/auth-store')

const mesa: SessionSummary = {
  id: 's1',
  name: 'Mesa de sexta',
  inviteId: 'k3x9p2m7ab',
  gmId: 'ana',
  gmName: 'Ana',
  role: 'gm',
  characterTemplateId: 't1',
  activeMapId: null,
  scale: { metersPerSquare: 1.5, diagonal: 'simple' as const },
  updatedAt: '2026-10-29T10:00:00Z'
}

let root: Root
let container: HTMLElement

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function render(): Promise<void> {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/gm']}>
        <Routes>
          <Route path="/gm" element={<GmLobbyPage />} />
          <Route path="/session/:sessionId" element={<p>dentro da mesa nova</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
  await flush()
}

beforeEach(() => {
  useAuthStore.setState({ userId: 'ana' })
  sessions.listMySessions.mockResolvedValue([
    mesa,
    { ...mesa, id: 's2', name: 'Mesa em que jogo', role: 'player' }
  ])
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('GmLobbyPage', () => {
  it('lista só as mesas que a pessoa mestra, com o sistema e o código', async () => {
    await render()
    const text = container.textContent ?? ''
    expect(text).toContain('Mesa de sexta')
    expect(text).toContain('Ordem')
    expect(text).toContain('k3x9p2m7ab')
    expect(text).not.toContain('Mesa em que jogo')
  })

  it('cria a sessão com senha sugerida e sistema publicado, e abre a mesa', async () => {
    sessions.createSession.mockResolvedValueOnce({ id: 's9', inviteId: 'novo123456' })
    await render()

    act(() => buttonByText(container, 'Nova sessão').click())
    const password = container.querySelector<HTMLInputElement>('#session-password')!
    // A senha sugerida já vem preenchida, no formato bicho-cor-número.
    expect(password.value).toMatch(/^[a-z]+-[a-z]+-\d{2}$/)
    expect(container.textContent).toContain('Não use uma senha pessoal')

    // Só o modelo de personagem publicado aparece como sistema.
    const options = [...container.querySelectorAll('#session-template option')].map(
      (o) => o.textContent
    )
    expect(options).toEqual(['Escolher depois', 'Ordem (v2)'])

    typeInto(container.querySelector<HTMLInputElement>('#session-name')!, 'Mesa nova')
    act(() => buttonByText(container, 'Criar e abrir').click())
    await flush()

    expect(sessions.createSession).toHaveBeenCalledWith({
      name: 'Mesa nova',
      password: password.value,
      templateId: 't1'
    })
    expect(container.textContent).toContain('dentro da mesa nova')
  })

  it('nome vazio não vai para o servidor', async () => {
    await render()
    act(() => buttonByText(container, 'Nova sessão').click())
    act(() => buttonByText(container, 'Criar e abrir').click())
    expect(container.textContent).toContain('Dê um nome para a sessão.')
    expect(sessions.createSession).not.toHaveBeenCalled()
  })

  it('excluir pede confirmação', async () => {
    sessions.deleteSession.mockResolvedValueOnce(undefined)
    await render()

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Excluir sessão"]')!.click())
    expect(container.textContent).toContain('Não tem como desfazer')
    expect(sessions.deleteSession).not.toHaveBeenCalled()

    const confirm = [...container.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Excluir'
    )
    await act(async () => confirm.at(-1)?.click())
    await flush()
    expect(sessions.deleteSession).toHaveBeenCalledWith('s1')
    expect(container.textContent).not.toContain('Mesa de sexta')
  })
})

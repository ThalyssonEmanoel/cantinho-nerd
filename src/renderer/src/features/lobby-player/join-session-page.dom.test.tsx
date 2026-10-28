import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { typeInto } from '@/test/dom-helpers'

/** A tela de senha do convite (4.4 e 4.5), onde o deep link cai. */

const sessions = vi.hoisted(() => ({ invitePreview: vi.fn(), joinSession: vi.fn() }))
vi.mock('@/lib/db/sessions', () => sessions)
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const { JoinSessionPage } = await import('./join-session-page')

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
      <MemoryRouter initialEntries={['/join/k3x9p2m7ab']}>
        <Routes>
          <Route path="/join/:inviteId" element={<JoinSessionPage />} />
          <Route path="/session/:sessionId" element={<p>dentro da mesa</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
  await flush()
}

function submit(): void {
  act(() => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('JoinSessionPage', () => {
  it('mostra a mesa e entra com a senha certa', async () => {
    sessions.invitePreview.mockResolvedValueOnce({
      sessionId: 's1',
      name: 'Mesa de sexta',
      gmName: 'Ana',
      isMember: false
    })
    sessions.joinSession.mockResolvedValueOnce('s1')
    await render()

    expect(container.textContent).toContain('Mesa de sexta')
    expect(container.textContent).toContain('Mestre: Ana')

    typeInto(container.querySelector<HTMLInputElement>('#session-password')!, 'lobo-azul-42')
    submit()
    await flush()

    expect(sessions.joinSession).toHaveBeenCalledWith('k3x9p2m7ab', 'lobo-azul-42')
    expect(container.textContent).toContain('dentro da mesa')
  })

  it('senha errada avisa e continua na tela', async () => {
    sessions.invitePreview.mockResolvedValueOnce({
      sessionId: 's1',
      name: 'Mesa de sexta',
      gmName: 'Ana',
      isMember: false
    })
    sessions.joinSession.mockRejectedValueOnce(new Error('x'))
    await render()

    typeInto(container.querySelector<HTMLInputElement>('#session-password')!, 'errada')
    submit()
    await flush()

    expect(toastError).toHaveBeenCalled()
    expect(container.textContent).not.toContain('dentro da mesa')
  })

  it('quem já está na mesa volta sem senha', async () => {
    sessions.invitePreview.mockResolvedValueOnce({
      sessionId: 's1',
      name: 'Mesa de sexta',
      gmName: 'Ana',
      isMember: true
    })
    await render()
    expect(container.textContent).toContain('dentro da mesa')
    expect(sessions.joinSession).not.toHaveBeenCalled()
  })

  it('convite que não existe (ou foi trocado) explica o que fazer', async () => {
    sessions.invitePreview.mockResolvedValueOnce(null)
    await render()
    expect(container.textContent).toContain('Talvez o mestre tenha gerado um novo')
  })
})

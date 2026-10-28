import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** O portão das telas que exigem conta (4.1). */

vi.mock('@/lib/db/auth', () => ({ onAuthChange: () => () => {} }))
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn() }))

const { RequireAuth } = await import('./require-auth')
const { useAuthStore } = await import('@/stores/auth-store')

let root: Root
let container: HTMLElement

function LoginProbe(): React.JSX.Element {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? 'nenhum'
  return <p>tela de login (voltar para: {from})</p>
}

function render(path: string): void {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<RequireAuth />}>
            <Route path="/templates" element={<p>biblioteca de modelos</p>} />
            <Route path="/join/:id" element={<p>senha da sessão</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  })
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('RequireAuth', () => {
  it('sem login, manda para a entrada lembrando de onde veio', () => {
    useAuthStore.setState({ status: 'signed-out', userId: null, profile: null })
    render('/join/lobo-azul-42')
    expect(container.textContent).toContain('voltar para: /join/lobo-azul-42')
  })

  it('logado, mostra a tela', () => {
    useAuthStore.setState({ status: 'signed-in', userId: 'u1', profile: null })
    render('/templates')
    expect(container.textContent).toContain('biblioteca de modelos')
  })

  it('enquanto a sessão carrega, espera em vez de expulsar', () => {
    useAuthStore.setState({ status: 'loading', userId: null, profile: null })
    render('/templates')
    expect(container.textContent).toContain('Entrando…')
    expect(container.textContent).not.toContain('tela de login')
  })
})

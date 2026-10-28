import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { typeInto } from '@/test/dom-helpers'

/**
 * Tela de entrada (4.1). O Supabase é dublado: o que se prova aqui é o caminho da tela —
 * validação antes de ir ao servidor, chamada certa, e seguir para a escolha de papel.
 */

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthChange: vi.fn(() => () => {})
}))
vi.mock('@/lib/db/auth', () => auth)

vi.mock('@/lib/db/profiles', () => ({
  fetchProfile: vi.fn(async (id: string) => ({
    id,
    username: 'thalysson',
    displayName: 'Thalysson',
    bio: '',
    avatarPath: null
  })),
  avatarUrl: (path: string) => path
}))

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const { LoginPage } = await import('./login-page')
const { useAuthStore } = await import('@/stores/auth-store')

let root: Root
let container: HTMLElement

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function render(): void {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/role" element={<p>tela de escolha de papel</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
}

/** O botão de enviar (a aba "Entrar" também é um botão com o mesmo texto). */
function submit(): void {
  const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (button === null) throw new Error('Formulário sem botão de enviar.')
  act(() => button.click())
}

function input(id: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(`#${id}`)
  if (element === null) throw new Error(`Campo #${id} não está na tela.`)
  return element
}

beforeEach(() => {
  useAuthStore.setState({ status: 'signed-out', userId: null, profile: null })
  render()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('entrar', () => {
  it('cobra os campos vazios sem chamar o servidor', () => {
    submit()
    expect(container.textContent).toContain('Digite seu nome de usuário.')
    expect(container.textContent).toContain('Digite sua senha.')
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('entra e segue para a escolha de papel', async () => {
    auth.signIn.mockResolvedValueOnce({ ok: true, userId: 'u1' })

    typeInto(input('username'), 'Thalysson')
    typeInto(input('password'), 'segredo123')
    submit()
    await flush()
    await flush()

    expect(auth.signIn).toHaveBeenCalledWith({
      username: 'Thalysson',
      password: 'segredo123',
      remember: true
    })
    expect(container.textContent).toContain('tela de escolha de papel')
  })

  it('senha errada avisa e continua na entrada', async () => {
    auth.signIn.mockResolvedValueOnce({
      ok: false,
      message: 'Nome de usuário ou senha incorretos.'
    })

    typeInto(input('username'), 'thalysson')
    typeInto(input('password'), 'errada123')
    submit()
    await flush()

    expect(toastError).toHaveBeenCalledWith('Não deu para entrar', {
      description: 'Nome de usuário ou senha incorretos.'
    })
    expect(container.textContent).not.toContain('tela de escolha de papel')
  })
})

describe('criar conta', () => {
  function openSignUp(): void {
    const tab = [...container.querySelectorAll('[role="tab"]')].find(
      (item) => item.textContent === 'Criar conta'
    )
    act(() => (tab as HTMLButtonElement).click())
  }

  it('mostra as regras do nome antes de ir ao servidor', () => {
    openSignUp()
    typeInto(input('username'), 'jo')
    typeInto(input('password'), 'segredo123')
    typeInto(input('confirm-password'), 'segredo123')
    submit()

    expect(container.textContent).toContain('de 3 a 20 caracteres')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('cobra a confirmação da senha', () => {
    openSignUp()
    typeInto(input('username'), 'joana')
    typeInto(input('password'), 'segredo123')
    typeInto(input('confirm-password'), 'segredo124')
    submit()

    expect(container.textContent).toContain('As duas senhas não são iguais.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('cria a conta com nome de exibição e entra', async () => {
    auth.signUp.mockResolvedValueOnce({ ok: true, userId: 'u2' })
    openSignUp()
    typeInto(input('username'), 'joana')
    typeInto(input('display-name'), 'Joana Dark')
    typeInto(input('password'), 'segredo123')
    typeInto(input('confirm-password'), 'segredo123')
    submit()
    await flush()
    await flush()

    expect(auth.signUp).toHaveBeenCalledWith({
      username: 'joana',
      displayName: 'Joana Dark',
      password: 'segredo123',
      remember: true
    })
    expect(container.textContent).toContain('tela de escolha de papel')
  })
})

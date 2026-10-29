import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buttonByText, byLabel, click, typeInto } from '@/test/dom-helpers'

/**
 * Configurações (Fase 12): sons, cache, versão, sair e as exclusões da seção 9 — que só
 * saem com o nome de usuário digitado.
 */

const account = vi.hoisted(() => ({
  deleteMySessions: vi.fn(async () => ({ deleted: 2, left: 1, failed: [] as string[] })),
  deleteMyAccount: vi.fn(async () => {})
}))
const auth = vi.hoisted(() => ({ signOut: vi.fn(async () => {}), onAuthChange: () => () => {} }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))

vi.mock('@/lib/db/account', () => account)
vi.mock('@/lib/db/auth', () => auth)
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { SettingsPage } = await import('./settings-page')
const { useAppStore } = await import('@/stores/app-store')
const { useAuthStore } = await import('@/stores/auth-store')

let container: HTMLElement
let root: Root

beforeEach(() => {
  useAuthStore.setState({
    userId: 'u1',
    profile: {
      id: 'u1',
      username: 'thalysson',
      displayName: 'Thalysson',
      bio: '',
      avatarPath: null
    }
  } as never)
  window.api.assetCacheSize = vi.fn(async () => 12 * 1024 * 1024)
  window.api.clearAssetCache = vi.fn(async () => 12 * 1024 * 1024)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function render(): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<p>tela de entrada</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
}

function checkbox(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((item) =>
    (item.textContent ?? '').includes(text)
  )
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (input === null || input === undefined) throw new Error(`Nenhuma caixa "${text}"`)
  return input
}

describe('Configurações', () => {
  it('liga e desliga os sons, que ficam na máquina', async () => {
    useAppStore.setState({ whisperSound: true, turnSound: true })
    await render()
    click(checkbox('Sua vez!'))
    expect(useAppStore.getState().turnSound).toBe(false)
    click(checkbox('Sussurro'))
    expect(useAppStore.getState().whisperSound).toBe(false)
  })

  it('mostra quanto o cache ocupa e limpa', async () => {
    await render()
    expect(container.textContent).toContain('Hoje ocupam 12,0 MB')
    await act(async () => buttonByText(container, 'Limpar o cache de imagens').click())
    expect(window.api.clearAssetCache).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Cache limpo: 12,0 MB liberados', expect.anything())
  })

  it('mostra a versão e explica como atualizar', async () => {
    await render()
    expect(container.textContent).toContain('versão 0.0.0-test')
    expect(container.textContent).toContain('instalar por cima')
  })

  it('excluir as sessões só libera com o nome de usuário digitado', async () => {
    await render()
    click(buttonByText(container, 'Excluir minhas sessões'))
    const confirm = (): HTMLButtonElement => buttonByText(document.body, 'Excluir as sessões')
    expect(confirm().disabled).toBe(true)

    typeInto(byLabel(document.body, 'Nome de usuário para confirmar'), 'thalyson')
    expect(confirm().disabled).toBe(true)
    typeInto(byLabel(document.body, 'Nome de usuário para confirmar'), ' Thalysson ')
    expect(confirm().disabled).toBe(false)

    await act(async () => confirm().click())
    expect(account.deleteMySessions).toHaveBeenCalledWith('u1')
    expect(toast.success).toHaveBeenCalledWith('2 mesa(s) excluída(s), e você saiu de 1.')
  })

  it('excluir a conta: confirma, exclui, sai e volta para a entrada', async () => {
    await render()
    click(buttonByText(container, 'Excluir a conta'))
    typeInto(byLabel(document.body, 'Nome de usuário para confirmar'), 'thalysson')
    await act(async () => buttonByText(document.body.querySelector('[role="dialog"]') ?? document.body, 'Excluir a conta').click())

    expect(account.deleteMyAccount).toHaveBeenCalledWith('u1')
    expect(auth.signOut).toHaveBeenCalled()
    expect(document.body.textContent).toContain('tela de entrada')
  })

  it('se o servidor recusar, a conta fica e o aviso aparece', async () => {
    account.deleteMyAccount.mockRejectedValueOnce(new Error('A exclusão de conta ainda não foi instalada'))
    await render()
    click(buttonByText(container, 'Excluir a conta'))
    typeInto(byLabel(document.body, 'Nome de usuário para confirmar'), 'thalysson')
    await act(async () => buttonByText(document.body.querySelector('[role="dialog"]') ?? document.body, 'Excluir a conta').click())

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Não consegui excluir a conta', expect.anything())
  })
})

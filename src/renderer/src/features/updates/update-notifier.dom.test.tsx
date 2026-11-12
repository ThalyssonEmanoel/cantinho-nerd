import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateStatus } from '@shared/update'

/**
 * "Nova versão pronta" (decisão 80): avisa uma vez por versão, oferece reiniciar e não
 * aparece na janela separada da ficha.
 */

const toast = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { UpdateNotifier } = await import('./update-notifier')

let container: HTMLElement
let root: Root
let push: (status: UpdateStatus) => void = () => {}

beforeEach(() => {
  window.api.getUpdateStatus = vi.fn(async (): Promise<UpdateStatus> => ({ state: 'idle' }))
  window.api.installUpdate = vi.fn(async () => true)
  window.api.onUpdateStatus = vi.fn((callback: (status: UpdateStatus) => void) => {
    push = callback
    return () => {}
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

async function render(path = '/role'): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <UpdateNotifier />
      </MemoryRouter>
    )
  })
}

interface ToastOptions {
  action: { label: string; onClick: () => void }
  cancel: { label: string }
  duration: number
}

describe('aviso de versão nova', () => {
  it('avisa quando a versão termina de baixar, e o botão reinicia', async () => {
    await render()
    expect(toast.success).not.toHaveBeenCalled()

    act(() => push({ state: 'downloading', version: '0.3.0', percent: 80 }))
    expect(toast.success).not.toHaveBeenCalled()

    act(() => push({ state: 'ready', version: '0.3.0' }))
    expect(toast.success).toHaveBeenCalledTimes(1)
    const [title, options] = toast.success.mock.calls[0] as unknown as [string, ToastOptions]
    expect(title).toBe('Nova versão 0.3.0 pronta')
    expect(options.action.label).toBe('Reiniciar agora')
    expect(options.cancel.label).toBe('Depois')
    // Fica na tela até a pessoa decidir: sumir sozinho faria ela perder o aviso.
    expect(options.duration).toBe(Number.POSITIVE_INFINITY)

    options.action.onClick()
    expect(window.api.installUpdate).toHaveBeenCalled()
  })

  it('avisa uma vez só por versão', async () => {
    await render()
    act(() => push({ state: 'ready', version: '0.3.0' }))
    act(() => push({ state: 'ready', version: '0.3.0' }))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('a versão já baixada antes de a tela abrir também avisa', async () => {
    window.api.getUpdateStatus = vi.fn(async (): Promise<UpdateStatus> => ({
      state: 'ready',
      version: '0.3.0'
    }))
    await render('/login')
    expect(toast.success).toHaveBeenCalledWith('Nova versão 0.3.0 pronta', expect.anything())
  })

  it('a janela separada da ficha não avisa', async () => {
    await render('/window/session/s1/sheets/f1')
    act(() => push({ state: 'ready', version: '0.3.0' }))
    expect(toast.success).not.toHaveBeenCalled()
  })
})

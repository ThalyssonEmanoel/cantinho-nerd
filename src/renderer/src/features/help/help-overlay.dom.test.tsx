import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HelpOverlay } from './help-overlay'
import { useHelpStore } from './help-store'

/**
 * Tela de ajuda (Fase 13): F1 e `?` abrem em qualquer lugar, e a tabela de teclas sai da
 * mesma lista que o tabuleiro usa — então o teste também é a prova de que a ajuda não
 * envelhece sozinha.
 */

let container: HTMLElement
let root: Root

beforeEach(async () => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<HelpOverlay />)
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useHelpStore.getState().closeHelp()
})

async function press(key: string, target: EventTarget = window): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('HelpOverlay', () => {
  it('começa fechada', () => {
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('F1 abre e fecha', async () => {
    await press('F1')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()

    await press('F1')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('? também abre', async () => {
    await press('?')
    expect(useHelpStore.getState().open).toBe(true)
  })

  it('digitando num campo, a tecla é do campo', async () => {
    const field = document.createElement('input')
    document.body.append(field)

    await press('?', field)
    expect(useHelpStore.getState().open).toBe(false)

    field.remove()
  })

  it('mostra as teclas da especificação, separadas por onde valem', async () => {
    await act(async () => useHelpStore.getState().openHelp())
    const text = document.body.textContent ?? ''

    expect(text).toContain('No tabuleiro')
    expect(text).toContain('Na mesa, em qualquer tela')
    expect(text).toContain('Mãozinha (arrastar o mapa)')
    expect(text).toContain('Caber na tela')
    expect(text).toContain('Escrever no chat')
    expect(text).toContain('Próximo turno')
    // E o resumo de como as peças se encaixam.
    expect(text).toContain('Pistas')
  })

  it('o store fecha a janela', async () => {
    await act(async () => useHelpStore.getState().openHelp())
    await act(async () => useHelpStore.getState().closeHelp())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

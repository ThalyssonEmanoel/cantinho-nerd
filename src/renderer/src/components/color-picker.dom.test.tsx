import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buttonByText, byLabel, click, pressKey, typeInto } from '@/test/dom-helpers'
import { ColorPicker } from './color-picker'

/**
 * O seletor de cor do construtor. O jsdom não tem a API de popover, então a paleta fica
 * sempre no DOM aqui — o que se prova é que cada caminho de escolha chega no `onChange`.
 */

let root: Root
let container: HTMLElement

function render(value: string | undefined, onChange = vi.fn()): typeof onChange {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root.render(<ColorPicker value={value} onChange={onChange} emptyLabel="Padrão" />)
  })
  return onChange
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ColorPicker', () => {
  it('mostra o nome da cor da paleta no botão', () => {
    render('#ef4444')
    const trigger = container.querySelector('button[popovertarget]')
    expect(trigger?.textContent).toContain('Vermelho')
  })

  it('mostra o texto de "sem cor" quando não há valor', () => {
    render(undefined)
    expect(container.querySelector('button[popovertarget]')?.textContent).toContain('Padrão')
  })

  it('escolher uma cor pronta devolve o hex dela', () => {
    const onChange = render(undefined)
    click(byLabel(container, 'Azul'))
    expect(onChange).toHaveBeenCalledWith('#3b82f6')
  })

  it('aceita um hex digitado, normalizado', () => {
    const onChange = render('#ef4444')
    const input = byLabel<HTMLInputElement>(container, 'Código hex da cor')
    typeInto(input, 'ABC')
    pressKey(input, 'Enter')
    expect(onChange).toHaveBeenCalledWith('#aabbcc')
  })

  it('hex inválido não muda nada e o campo volta ao valor anterior', () => {
    const onChange = render('#ef4444')
    const input = byLabel<HTMLInputElement>(container, 'Código hex da cor')
    typeInto(input, 'azul')
    pressKey(input, 'Enter')
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('#ef4444')
  })

  it('"usar o padrão" limpa a cor, e fica desligado quando já não há cor', () => {
    const onChange = render('#22c55e')
    click(buttonByText(container, 'Usar o padrão'))
    expect(onChange).toHaveBeenCalledWith(undefined)

    act(() => root.unmount())
    container.remove()
    render(undefined)
    expect(buttonByText(container, 'Usar o padrão').disabled).toBe(true)
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buttonByText, byLabel, click, typeInto } from '@/test/dom-helpers'
import { FormulaGuide } from './formula-guide'

/** Montagem do Guia de fórmulas e da caixa "Experimente". */

let root: Root
let container: HTMLElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(<FormulaGuide />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('FormulaGuide', () => {
  it('monta todas as seções', () => {
    const text = container.textContent ?? ''
    for (const title of [
      'Como as peças se ligam',
      'Passo a passo',
      'Usando outros campos',
      'Botões de rolagem',
      'Quando aparece #ERRO',
      'Experimente'
    ]) {
      expect(text).toContain(title)
    }
  })

  it('nenhum exemplo de acerto mostra #ERRO', () => {
    // A seção de erros mostra só a mensagem, sem o prefixo; o "#ERRO —" denunciaria um
    // exemplo que deveria funcionar e não funciona.
    expect(container.textContent).not.toContain('#ERRO —')
  })

  it('a caixa de teste calcula o que se digita', () => {
    const input = byLabel<HTMLInputElement>(container, 'Fórmula para testar')
    typeInto(input, '=forca.mod * 2')
    expect(container.textContent).toContain('Resultado: 6')

    typeInto(input, '=forca +')
    expect(container.textContent).toContain('#ERRO — A fórmula terminou antes do esperado.')
  })

  it('no modo rolagem, mostra a notação e rola de verdade', () => {
    click(buttonByText(container, 'Rolagem'))
    expect(container.textContent).toContain('Vai rolar: 1d20 + 3')

    click(buttonByText(container, 'Rolar'))
    expect(container.textContent).toMatch(/Total\s*\d+/)
  })
})

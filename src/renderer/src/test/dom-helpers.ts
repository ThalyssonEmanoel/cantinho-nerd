import { act } from 'react'

/**
 * Ajudantes dos testes de montagem.
 *
 * O React escuta o evento nativo `input` para o `onChange`, e ignora a troca de valor feita
 * direto em `input.value` (ele guarda o último valor que viu). Por isso o valor entra pelo
 * setter do protótipo, como o navegador faz quando alguém digita.
 */
export function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function pressKey(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

export function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** Elemento pelo `aria-label`, falhando com mensagem clara se não existir. */
export function byLabel<T extends Element = HTMLElement>(root: ParentNode, label: string): T {
  const element = root.querySelector<T & Element>(`[aria-label="${label}"]`)
  if (element === null) throw new Error(`Nada com aria-label="${label}" na tela.`)
  return element
}

/** Botão pelo texto visível. */
export function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find((item) =>
    (item.textContent ?? '').includes(text)
  )
  if (button === undefined) throw new Error(`Nenhum botão com o texto "${text}".`)
  return button
}

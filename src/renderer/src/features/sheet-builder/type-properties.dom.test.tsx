import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponent, type SheetComponent } from '@/lib/sheet'
import { typeInto } from '@/test/dom-helpers'
import { TypeProperties } from './type-properties'

/**
 * As propriedades novas do construtor (texto padrão, barra que acompanha o máximo, parágrafo,
 * imagem fixa, coluna oculta e linha inicial). O que importa é o mestre conseguir chegar nelas
 * sem editar o JSON na mão, e cada uma escrever o campo certo.
 */

const roots: { unmount: () => void; container: HTMLElement }[] = []

function renderProperties(component: SheetComponent): {
  container: HTMLElement
  onChange: ReturnType<typeof vi.fn>
} {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onChange = vi.fn()
  act(() => {
    root.render(<TypeProperties component={component} onChange={onChange} />)
  })
  roots.push({ unmount: () => root.unmount(), container })
  return { container, onChange }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
    root.container.remove()
  }
})

function field(container: HTMLElement, label: string): HTMLInputElement {
  const group = [...container.querySelectorAll('div')].find(
    (item) => item.querySelector(':scope > label')?.textContent === label
  )
  const control = group?.querySelector<HTMLInputElement>('input, textarea, select')
  if (control === null || control === undefined) throw new Error(`Sem o campo "${label}".`)
  return control
}

function build<T extends SheetComponent['type']>(
  type: T,
  extra: Partial<Extract<SheetComponent, { type: T }>> = {}
): SheetComponent {
  return { ...createComponent(type, { takenKeys: [] }), ...extra } as SheetComponent
}

function change(control: HTMLSelectElement, value: string): void {
  act(() => {
    control.value = value
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('texto padrão', () => {
  it.each(['text', 'textarea'] as const)('%s escreve o padrão, e vazio tira do modelo', (type) => {
    const { container, onChange } = renderProperties(build(type, { defaultValue: 'Geralt' }))
    const control = field(container, 'Texto padrão') as unknown as HTMLTextAreaElement

    expect(control.value).toBe('Geralt')
    typeInto(control, 'Ciri')
    expect(onChange).toHaveBeenLastCalledWith({ defaultValue: 'Ciri' })
    typeInto(control, '')
    expect(onChange).toHaveBeenLastCalledWith({ defaultValue: undefined })
  })
})

describe('barra que acompanha o máximo', () => {
  function followControl(container: HTMLElement): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find(
      (item) => item.textContent === 'Acompanhar'
    )
    const control = label?.querySelector('input')
    if (control === null || control === undefined) throw new Error('Sem a caixa de acompanhar.')
    return control
  }

  it('liga, e desligar tira a propriedade do modelo', () => {
    const off = renderProperties(build('resource'))
    expect(followControl(off.container).checked).toBe(false)
    act(() => followControl(off.container).click())
    expect(off.onChange).toHaveBeenLastCalledWith({ followsMax: true })

    const on = renderProperties(build('resource', { followsMax: true }))
    expect(followControl(on.container).checked).toBe(true)
    act(() => followControl(on.container).click())
    expect(on.onChange).toHaveBeenLastCalledWith({ followsMax: undefined })
  })
})

describe('parágrafo', () => {
  it('o título escolhe parágrafo, e aí o texto vira caixa de várias linhas', () => {
    const section = renderProperties(build('heading'))
    expect(section.container.querySelector('textarea')).toBeNull()
    change(field(section.container, 'Tamanho') as unknown as HTMLSelectElement, 'paragraph')
    expect(section.onChange).toHaveBeenLastCalledWith({ level: 'paragraph' })

    const paragraph = renderProperties(build('heading', { level: 'paragraph', text: 'Regra' }))
    expect(paragraph.container.querySelector('textarea')?.value).toBe('Regra')
  })
})

describe('imagem fixa', () => {
  it('monta sem imagem, com a fórmula e o encaixe', () => {
    const { container, onChange } = renderProperties(build('figure'))

    expect(container.textContent).toContain('Escolher')
    expect(container.textContent).not.toContain('Tirar')
    expect(container.querySelector('input[type="file"]')).not.toBeNull()

    typeInto(field(container, 'Repetir uma imagem da ficha'), '=retrato')
    expect(onChange).toHaveBeenLastCalledWith({ sourceFormula: '=retrato' })

    change(field(container, 'Encaixe') as unknown as HTMLSelectElement, 'cover')
    expect(onChange).toHaveBeenLastCalledWith({ fit: 'cover' })
  })

  it('com imagem, oferece tirar', () => {
    const { container, onChange } = renderProperties(
      build('figure', { src: 'data:image/png;base64,AAAA' })
    )
    const remove = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Tirar')
    )
    act(() => {
      remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith({ src: undefined })
  })
})

describe('tabela', () => {
  const table = build('table', {
    columns: [{ id: 'col_a', key: 'a', label: 'A', kind: 'text' }],
    rows: [{ id: 'r1', key: 'r1', label: 'Linha' }]
  })

  it('a coluna ganha dica e pode ficar oculta', () => {
    const { container, onChange } = renderProperties(table)

    const hint = container.querySelector<HTMLInputElement>('input[placeholder^="Dica"]')
    if (hint === null) throw new Error('Sem o campo de dica.')
    typeInto(hint, 'Explicação')
    expect(onChange).toHaveBeenLastCalledWith({
      columns: [expect.objectContaining({ key: 'a', hint: 'Explicação' })]
    })

    const hidden = [...container.querySelectorAll('label')].find(
      (label) => label.textContent === 'Oculta'
    )
    act(() => {
      hidden?.querySelector('input')?.click()
    })
    expect(onChange).toHaveBeenLastCalledWith({
      columns: [expect.objectContaining({ key: 'a', hidden: true })]
    })
  })

  it('a linha pode virar linha inicial', () => {
    const { container, onChange } = renderProperties(table)
    const starter = container.querySelector<HTMLInputElement>(
      '[aria-label="Linha inicial, que o jogador pode remover"]'
    )
    act(() => {
      starter?.click()
    })
    expect(onChange).toHaveBeenLastCalledWith({
      rows: [expect.objectContaining({ key: 'r1', starter: true })]
    })
  })
})

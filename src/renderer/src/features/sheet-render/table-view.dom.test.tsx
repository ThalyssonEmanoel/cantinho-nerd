import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createSheetContext,
  findComponentById,
  type SheetComponent,
  type SheetValue,
  type SheetValues
} from '@/lib/sheet'
import { TableView } from './table-view'

/**
 * Tabela em modo de preenchimento (5.3 e 5.7).
 *
 * A montagem com a alça de arrastar é a rede de proteção contra o dnd-kit quebrar no React
 * 19 — o arrasto em si depende de medidas de tela que o jsdom não tem, e é conferido à mão.
 */

const roots: { unmount: () => void; container: HTMLElement }[] = []

function render(element: React.ReactNode): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  roots.push({ unmount: () => root.unmount(), container })
  return container
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
    root.container.remove()
  }
})

interface Fixture {
  container: HTMLElement
  onChange: ReturnType<typeof vi.fn>
}

function renderTable(componentId: string, values: SheetValues): Fixture {
  const schema = createExampleSchema()
  const component = findComponentById(schema, componentId) as SheetComponent
  const { context } = createSheetContext(schema, values)
  const onChange = vi.fn()

  const container = render(
    <TableView
      component={component as Extract<SheetComponent, { type: 'table' }>}
      context={context}
      values={values}
      options={{ audience: 'player', onChange }}
    />
  )

  return { container, onChange }
}

function inputValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll('input')].map((input) => input.value)
}

function rows(): SheetValues {
  return {
    c_inventario: [
      { id: 'r1', cells: { item: 'Corda', peso: 2, quantidade: 1 } },
      { id: 'r2', cells: { item: 'Tocha', peso: 1, quantidade: 3 } }
    ]
  }
}

describe('tabela do jogador', () => {
  it('monta com alça de arrastar em cada linha', () => {
    const { container } = renderTable('c_inventario', rows())

    expect(container.querySelectorAll('[aria-label="Reordenar linha"]').length).toBe(2)
    // O que o jogador digitou está no valor do campo, não no texto da página.
    expect(inputValues(container)).toContain('Corda')
    expect(inputValues(container)).toContain('Tocha')
  })

  it('não oferece reordenar com uma linha só', () => {
    const { container } = renderTable('c_inventario', {
      c_inventario: [{ id: 'r1', cells: { item: 'Corda', peso: 2, quantidade: 1 } }]
    })

    expect(container.querySelectorAll('[aria-label="Reordenar linha"]').length).toBe(0)
    expect(container.querySelectorAll('[aria-label="Remover linha"]').length).toBe(1)
  })

  it('adiciona uma linha com as células no padrão', () => {
    const { container, onChange } = renderTable('c_inventario', rows())

    const add = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Adicionar')
    )
    act(() => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const next = onChange.mock.calls[0]?.[1] as SheetValue
    expect(Array.isArray(next) ? next.length : 0).toBe(3)
    expect(Array.isArray(next) ? next[2]?.cells : undefined).toEqual({
      item: '',
      peso: 0,
      quantidade: 0
    })
  })

  it('remove a linha que o jogador criou', () => {
    const { container, onChange } = renderTable('c_inventario', rows())

    act(() => {
      container
        .querySelectorAll('[aria-label="Remover linha"]')[0]
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const next = onChange.mock.calls[0]?.[1] as SheetValue
    expect(Array.isArray(next) ? next.map((row) => row.id) : []).toEqual(['r2'])
  })
})

describe('tabela de linhas fixas', () => {
  it('mostra os rótulos e não deixa remover nem reordenar', () => {
    const schema = createExampleSchema()
    const component = findComponentById(schema, 'c_pericias') as Extract<
      SheetComponent,
      { type: 'table' }
    >
    const values: SheetValues = {
      c_pericias: component.rows.map((row) => ({
        id: row.id,
        key: row.key,
        cells: { atributo: 'destreza', treinado: true, bonus: 0 }
      }))
    }
    const { context } = createSheetContext(schema, values)

    const container = render(
      <TableView
        component={component}
        context={context}
        values={values}
        options={{ audience: 'player', onChange: vi.fn() }}
      />
    )

    expect(container.textContent).toContain('Furtividade')
    expect(container.querySelectorAll('[aria-label="Remover linha"]').length).toBe(0)
    expect(container.querySelectorAll('[aria-label="Reordenar linha"]').length).toBe(0)
    expect(container.textContent).not.toContain('#ERRO')
  })
})

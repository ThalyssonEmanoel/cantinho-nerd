import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createPreviewValues,
  createSheetContext,
  type SheetSchema,
  type SheetValues
} from '@/lib/sheet'
import { GridCanvas } from './grid-canvas'
import { SheetView } from '@/features/sheet-render/sheet-view'

/**
 * Teste de montagem: prova que a grade e a ficha sobem de verdade no React 19.
 *
 * A react-grid-layout depende da react-draggable, que durante anos usou `findDOMNode` —
 * API removida no React 19. Este teste é a rede de proteção contra esse tipo de quebra, que
 * só apareceria ao abrir o app.
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

function fixture(): { schema: SheetSchema; values: SheetValues; tabId: string } {
  const schema = createExampleSchema()
  const values = createPreviewValues(schema)
  return { schema, values, tabId: schema.tabs[0]?.id ?? '' }
}

describe('GridCanvas', () => {
  it('monta a grade do construtor com o modelo de exemplo', () => {
    const { schema, values, tabId } = fixture()
    const { context } = createSheetContext(schema, values)

    const container = render(
      <GridCanvas
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        selectedId={null}
        draggingType={null}
        onSelect={() => {}}
        onLayoutsChange={() => {}}
        onDropNew={() => {}}
        onInteractionStart={() => {}}
        onInteractionEnd={() => {}}
      />
    )

    // Um item da grade por componente da aba.
    const items = container.querySelectorAll('.react-grid-item')
    expect(items.length).toBe(schema.tabs[0]?.components.length)
    expect(container.textContent).toContain('Força')
  })

  it('marca o componente selecionado', () => {
    const { schema, values, tabId } = fixture()
    const { context } = createSheetContext(schema, values)
    const selectedId = schema.tabs[0]?.components[1]?.id ?? null

    const container = render(
      <GridCanvas
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        selectedId={selectedId}
        draggingType={null}
        onSelect={() => {}}
        onLayoutsChange={() => {}}
        onDropNew={() => {}}
        onInteractionStart={() => {}}
        onInteractionEnd={() => {}}
      />
    )

    expect(container.querySelectorAll('.ring-2').length).toBe(1)
  })

  it('apertar o mouse num componente da grade seleciona ele', () => {
    const { schema, values, tabId } = fixture()
    const { context } = createSheetContext(schema, values)
    const onSelect = vi.fn()

    const container = render(
      <GridCanvas
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        selectedId={null}
        draggingType={null}
        onSelect={onSelect}
        onLayoutsChange={() => {}}
        onDropNew={() => {}}
        onInteractionStart={() => {}}
        onInteractionEnd={() => {}}
      />
    )

    const second = container.querySelectorAll('.react-grid-item')[1] as HTMLElement
    // A sequência de um clique de verdade: primeiro pointerdown, depois mousedown. A
    // react-draggable troca o onMouseDown do item pelo dela, então a seleção não pode
    // depender dele (era o bug: o clique nunca abria as propriedades).
    act(() => {
      second.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      second.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(onSelect).toHaveBeenCalledWith(schema.tabs[0]?.components[1]?.id)
  })
})

describe('SheetView', () => {
  it('mostra os valores calculados do modelo de exemplo', () => {
    const { schema, values, tabId } = fixture()
    const { context } = createSheetContext(schema, values)

    const container = render(
      <SheetView
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        options={{ audience: 'player', applyConditionalVisibility: true }}
      />
    )

    const text = container.textContent ?? ''
    // Vida 10 (10 + mod 0 * nível 1), proficiência +2 e defesa 10.
    expect(text).toContain('Vida')
    expect(text).toContain('+2')
    expect(text).not.toContain('#ERRO')
  })

  it('esconde do jogador o campo que é só do mestre', () => {
    const { schema, values, tabId } = fixture()
    const { context } = createSheetContext(schema, values)

    const asPlayer = render(
      <SheetView
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        options={{ audience: 'player', applyConditionalVisibility: true }}
      />
    )
    expect(asPlayer.textContent).not.toContain('Anotações do mestre')

    const asGm = render(
      <SheetView
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        options={{ audience: 'gm', applyConditionalVisibility: true }}
      />
    )
    expect(asGm.textContent).toContain('Anotações do mestre')
  })

  it('monta a tabela de perícias com as linhas fixas', () => {
    const schema = createExampleSchema()
    const values = createPreviewValues(schema)
    const { context } = createSheetContext(schema, values)
    const skillsTab = schema.tabs[1]?.id ?? ''

    const container = render(
      <SheetView
        schema={schema}
        tabId={skillsTab}
        values={values}
        context={context}
        options={{ audience: 'player', applyConditionalVisibility: true }}
      />
    )

    const text = container.textContent ?? ''
    expect(text).toContain('Furtividade')
    expect(text).toContain('Acrobacia')
    expect(text).not.toContain('#ERRO')
  })
})

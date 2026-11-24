import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSheetContext, type SheetComponent, type SheetSchema, type SheetValues } from '@/lib/sheet'
import { SheetView } from './sheet-view'
import type { SheetRenderOptions } from './types'

/**
 * Coluna travada para o mestre, "mostrar a linha quando", texto inteiro no mouse e o botão que
 * desconta ao rolar — montados de verdade, como o jogador e o mestre veem.
 */

const roots: { unmount: () => void; container: HTMLElement }[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
    root.container.remove()
  }
})

const LONG = 'Ataque com a arma corpo a corpo contra um alvo adjacente; acertou, dano da arma + 3.'

const schema: SheetSchema = {
  formatVersion: 1,
  tabs: [
    {
      id: 't',
      label: 'T',
      components: [
        { id: 'c_nivel', key: 'nivel', label: 'Nível', type: 'number', editableBy: 'gm', visibleTo: 'all', layout: { x: 0, y: 0, w: 2, h: 2 } },
        { id: 'c_energia', key: 'energia', label: 'Energia', type: 'resource', maxValue: 6, showButtons: false, editableBy: 'player', visibleTo: 'all', layout: { x: 2, y: 0, w: 4, h: 2 } },
        {
          id: 'c_hab', key: 'hab', label: 'Habilidades', type: 'table', editableBy: 'player', visibleTo: 'all', layout: { x: 0, y: 2, w: 12, h: 8 },
          playerCanAddRows: false, showRowLabels: true, rowVisibleWhen: 'nv <= nivel',
          columns: [
            { id: 'a', key: 'esc', label: 'Esc.', kind: 'checkbox' },
            { id: 'b', key: 'nv', label: 'Nv', kind: 'number', editableBy: 'gm' },
            { id: 'c', key: 'pe', label: 'PE', kind: 'number', editableBy: 'gm' },
            { id: 'd', key: 'efeito', label: 'Efeito', kind: 'text', editableBy: 'gm', hidden: true },
            { id: 'e', key: 'resumo', label: 'Resumo', kind: 'computed', formula: '=efeito', format: 'integer' },
            { id: 'f', key: 'usar', label: 'Usar', kind: 'rollButton', formula: '{pe}', critical: { kind: 'none' }, criticalFailureOnOne: false, cost: { target: 'energia', amount: '=pe' } }
          ],
          rows: [
            { id: 'r1', key: 'golpe', label: 'Golpe Brutal', cells: { nv: 1, pe: 2, efeito: LONG } },
            { id: 'r2', key: 'furia', label: 'Fúria de Guerra', cells: { nv: 3, pe: 5, efeito: 'Nível 3' } }
          ]
        } satisfies SheetComponent
      ]
    }
  ]
}

function values(energia: number): SheetValues {
  return {
    c_nivel: 1,
    c_energia: { current: energia, max: 6 },
    c_hab: [
      { id: 'r1', key: 'golpe', cells: { esc: true, nv: 1, pe: 2, efeito: LONG } },
      { id: 'r2', key: 'furia', cells: { esc: false, nv: 3, pe: 5, efeito: 'Nível 3' } }
    ]
  }
}

function renderSheet(v: SheetValues, options: Partial<SheetRenderOptions> = {}) {
  const onChange = vi.fn()
  const onRoll = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const { context } = createSheetContext(schema, v)
  act(() => {
    root.render(
      <SheetView
        schema={schema}
        tabId="t"
        values={v}
        context={context}
        options={{ audience: 'player', onChange, onRoll, applyConditionalVisibility: true, ...options }}
      />
    )
  })
  roots.push({ unmount: () => root.unmount(), container })
  return { container, onChange, onRoll }
}

function clickUsar(container: HTMLElement): void {
  const button = [...container.querySelectorAll('button')].find((item) => (item.textContent ?? '').includes('Usar'))
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('opções de tabela', () => {
  it('jogador: marca a caixa, mas não edita as colunas do mestre', () => {
    const { container } = renderSheet(values(6))
    const inputs = [...container.querySelectorAll('input')]
    const checkboxes = inputs.filter((input) => input.type === 'checkbox')
    expect(checkboxes.length).toBe(1)
    expect(checkboxes[0]?.disabled).toBe(false)
    // Nv e PE viram texto: nenhum campo de número dentro da tabela.
    expect(container.querySelectorAll('.rounded-md.border input[type="number"]').length).toBe(0)
  })

  it('jogador não vê a linha acima do nível; o mestre vê apagada', () => {
    const jogador = renderSheet(values(6))
    expect(jogador.container.textContent).toContain('Golpe Brutal')
    expect(jogador.container.textContent).not.toContain('Fúria de Guerra')

    const mestre = renderSheet(values(6), { audience: 'gm' })
    expect(mestre.container.textContent).toContain('Fúria de Guerra')
    const dimmed = mestre.container.querySelector('[title^="Escondida para o jogador"]')
    expect(dimmed?.className).toContain('opacity-50')
    // Para o mestre, as colunas travadas continuam campos.
    expect(mestre.container.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0)
  })

  it('célula calculada mostra o texto inteiro ao passar o mouse', () => {
    const { container } = renderSheet(values(6))
    expect(container.querySelector(`span[title="${LONG}"]`)).not.toBeNull()
  })

  it('Usar desconta o custo da barra e rola', () => {
    const { container, onChange, onRoll } = renderSheet(values(6))
    clickUsar(container)
    expect(onChange).toHaveBeenCalledWith('c_energia', { current: 4, max: 6 })
    expect(onRoll.mock.calls[0]?.[0]?.label).toBe('Golpe Brutal')
  })

  it('sem PE suficiente, rola, zera a barra e o rótulo conta quanto faltou', () => {
    const { container, onChange, onRoll } = renderSheet(values(1))
    clickUsar(container)
    expect(onChange).toHaveBeenCalledWith('c_energia', { current: 0, max: 6 })
    expect(onRoll.mock.calls[0]?.[0]?.label).toBe('Golpe Brutal (faltou 1 de Energia)')
  })

  it('só lendo a ficha, rola sem descontar', () => {
    const { container, onChange, onRoll } = renderSheet(values(6), { readOnly: true })
    clickUsar(container)
    expect(onChange).not.toHaveBeenCalled()
    expect(onRoll).toHaveBeenCalledTimes(1)
  })
})

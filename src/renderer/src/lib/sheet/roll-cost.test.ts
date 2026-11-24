import { describe, expect, it } from 'vitest'
import { createRowFormulaContext, createSheetContext } from './context'
import { labelWithMissing, planRollCost } from './roll-cost'
import type { SheetComponent, SheetSchema } from './types'
import type { SheetValues } from './values'

const layout = { x: 0, y: 0, w: 2, h: 2 }

function schema(energiaVisivel: 'all' | 'gm' = 'all'): SheetSchema {
  const components: SheetComponent[] = [
    { id: 'c_energia', key: 'energia', label: 'Energia (PE)', type: 'resource', maxValue: 6, showButtons: true, editableBy: 'player', visibleTo: energiaVisivel, layout },
    { id: 'c_pocoes', key: 'pocoes', label: 'Poções', type: 'number', min: 0, editableBy: 'player', visibleTo: 'all', layout },
    { id: 'c_nivel', key: 'nivel', label: 'Nível', type: 'number', editableBy: 'gm', visibleTo: 'all', layout },
    {
      id: 'c_hab', key: 'hab', label: 'Habilidades', type: 'table', editableBy: 'player', visibleTo: 'all', layout,
      playerCanAddRows: false, showRowLabels: true,
      columns: [
        { id: 'a', key: 'esc', label: 'Esc.', kind: 'checkbox' },
        { id: 'b', key: 'pe', label: 'PE', kind: 'number', editableBy: 'gm' }
      ],
      rows: [{ id: 'r1', key: 'golpe', label: 'Golpe', cells: { pe: 2 } }]
    }
  ]
  return { formatVersion: 1, tabs: [{ id: 't', label: 'T', components }] }
}

function values(energia: number, pocoes = 2, esc = true): SheetValues {
  return {
    c_energia: { current: energia, max: 6 },
    c_pocoes: pocoes,
    c_nivel: 1,
    c_hab: [{ id: 'r1', key: 'golpe', cells: { esc, pe: 2 } }]
  }
}

function rowContext(s: SheetSchema, v: SheetValues): ReturnType<typeof createRowFormulaContext> {
  const table = s.tabs[0]!.components.find((c) => c.key === 'hab') as Extract<SheetComponent, { type: 'table' }>
  return createRowFormulaContext(createSheetContext(s, v).context, table, 'golpe')
}

describe('desconto ao rolar', () => {
  it('desconta da barra o custo da própria linha', () => {
    const s = schema()
    const v = values(5)
    const charge = planRollCost(s, v, { target: 'energia', amount: '=pe' }, rowContext(s, v), 'player')
    expect(charge).toMatchObject({ componentId: 'c_energia', value: { current: 3, max: 6 }, amount: 2, missing: 0 })
  })

  it('faltou: zera a barra e conta quanto faltou', () => {
    const s = schema()
    const v = values(1)
    const charge = planRollCost(s, v, { target: 'energia', amount: '=pe' }, rowContext(s, v), 'player')
    expect(charge).toMatchObject({ value: { current: 0, max: 6 }, missing: 1 })
    expect(labelWithMissing('Golpe', charge!)).toBe('Golpe (faltou 1 de Energia (PE))')
  })

  it('desconta de um campo de número (a poção da mochila)', () => {
    const s = schema()
    const v = values(5, 2)
    const charge = planRollCost(s, v, { target: 'pocoes', amount: '1' }, createSheetContext(s, v).context, 'player')
    expect(charge).toMatchObject({ componentId: 'c_pocoes', value: 1 })
  })

  it('quantidade 0 não mexe em nada (habilidade não escolhida)', () => {
    const s = schema()
    const v = values(5, 2, false)
    expect(planRollCost(s, v, { target: 'energia', amount: '=se(esc, pe, 0)' }, rowContext(s, v), 'player')).toBeNull()
  })

  it('não desconta o que quem rola não pode editar, nem alvo que não é barra ou número', () => {
    const s = schema('gm')
    const v = values(5)
    expect(planRollCost(s, v, { target: 'energia', amount: '1' }, createSheetContext(s, v).context, 'player')).toBeNull()
    expect(planRollCost(s, v, { target: 'nivel', amount: '1' }, createSheetContext(s, v).context, 'player')).toBeNull()
    expect(planRollCost(s, v, { target: 'hab', amount: '1' }, createSheetContext(s, v).context, 'gm')).toBeNull()
    expect(planRollCost(s, v, { target: 'nao_existe', amount: '1' }, createSheetContext(s, v).context, 'gm')).toBeNull()
  })

  it('fórmula com erro não desconta', () => {
    const s = schema()
    const v = values(5)
    expect(planRollCost(s, v, { target: 'energia', amount: '=campo_inexistente' }, createSheetContext(s, v).context, 'player')).toBeNull()
  })

  it('aceita o "=" na chave do alvo', () => {
    const s = schema()
    const v = values(5)
    expect(planRollCost(s, v, { target: '=energia', amount: '2' }, createSheetContext(s, v).context, 'player')?.value).toEqual({ current: 3, max: 6 })
  })
})

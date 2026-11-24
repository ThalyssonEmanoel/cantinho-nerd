import { describe, expect, it } from 'vitest'
import { canEditColumn, changedLockedColumns, isLockedColumn } from './permissions'
import { rejectedPatchFields } from './sheet-record'
import type { SheetComponent, SheetSchema, TableColumn } from './types'
import type { SheetValues, TableRowValue } from './values'

type TableComponent = Extract<SheetComponent, { type: 'table' }>

/** Tabela de habilidades: o jogador marca "Esc.", o mestre cuida do resto. */
function habilidades(): TableComponent {
  return {
    id: 'c_hab',
    key: 'hab',
    label: 'Habilidades',
    type: 'table',
    editableBy: 'player',
    visibleTo: 'all',
    layout: { x: 0, y: 0, w: 12, h: 6 },
    playerCanAddRows: true,
    showRowLabels: true,
    columns: [
      { id: 'a', key: 'esc', label: 'Esc.', kind: 'checkbox' },
      { id: 'b', key: 'pe', label: 'PE', kind: 'number', editableBy: 'gm' },
      { id: 'c', key: 'efeito', label: 'Efeito', kind: 'text', editableBy: 'gm' },
      {
        id: 'd',
        key: 'tipo',
        label: 'Tipo',
        kind: 'select',
        editableBy: 'gm',
        options: [
          { id: 'o1', label: 'A' },
          { id: 'o2', label: 'B' }
        ]
      },
      { id: 'e', key: 'nota', label: 'Nota', kind: 'text' },
      { id: 'f', key: 'total', label: 'Total', kind: 'computed', formula: '=pe', editableBy: 'gm' }
    ],
    rows: []
  }
}

const before: TableRowValue[] = [
  { id: 'r1', key: 'golpe', cells: { esc: false, pe: 1, efeito: 'Dano + 3', tipo: 'o1', nota: '' } },
  { id: 'r2', key: 'guarda', cells: { esc: false, pe: 3, nota: '' } }
]

describe('coluna travada para o mestre', () => {
  it('só trava colunas que guardam valor', () => {
    const table = habilidades()
    const byKey = (key: string): TableColumn => table.columns.find((c) => c.key === key) as TableColumn
    expect(isLockedColumn(byKey('pe'))).toBe(true)
    expect(isLockedColumn(byKey('esc'))).toBe(false)
    // Coluna calculada não guarda valor: marcar não muda nada.
    expect(isLockedColumn(byKey('total'))).toBe(false)
    expect(canEditColumn(byKey('pe'), 'player')).toBe(false)
    expect(canEditColumn(byKey('pe'), 'gm')).toBe(true)
    expect(canEditColumn(byKey('nota'), 'player')).toBe(true)
  })

  it('deixa o jogador marcar, anotar, reordenar e remover', () => {
    const next = [{ ...before[1]!, cells: { ...before[1]!.cells, esc: true, nota: 'boa' } }]
    expect(changedLockedColumns(habilidades(), before, next)).toEqual([])
  })

  it('acusa custo, texto e lista mudados numa linha que já existia', () => {
    const next = [
      { ...before[0]!, cells: { ...before[0]!.cells, pe: 0, efeito: 'Mata tudo', tipo: 'o2' } },
      before[1]!
    ]
    expect(changedLockedColumns(habilidades(), before, next).sort()).toEqual(['efeito', 'pe', 'tipo'])
  })

  it('célula que faltava vale o padrão da coluna', () => {
    // A linha 2 não tinha "efeito" nem "tipo": "" e a primeira opção não são mudança.
    const next = [before[0]!, { ...before[1]!, cells: { ...before[1]!.cells, efeito: '', tipo: 'o1' } }]
    expect(changedLockedColumns(habilidades(), before, next)).toEqual([])
  })

  it('linha nova só nasce com as colunas travadas vazias', () => {
    const blank = { id: 'n1', cells: { esc: false, pe: 0, efeito: '', tipo: '', nota: 'x' } }
    expect(changedLockedColumns(habilidades(), before, [...before, blank])).toEqual([])
    const filled = { id: 'n2', cells: { pe: 5 } }
    expect(changedLockedColumns(habilidades(), before, [...before, filled])).toEqual(['pe'])
  })

  it('tabela sem coluna travada nunca acusa', () => {
    const table = { ...habilidades(), columns: habilidades().columns.map((c) => ({ ...c, editableBy: undefined })) }
    const next = [{ ...before[0]!, cells: { pe: 99 } }]
    expect(changedLockedColumns(table, before, next)).toEqual([])
  })
})

describe('rejectedPatchFields com coluna travada', () => {
  const schema: SheetSchema = { formatVersion: 1, tabs: [{ id: 't', label: 'T', components: [habilidades()] }] }
  const previous: SheetValues = { c_hab: before }
  const mudouPe = { values: { c_hab: [{ ...before[0]!, cells: { ...before[0]!.cells, pe: 0 } }, before[1]!] } }

  it('recusa o jogador e aceita o mestre', () => {
    expect(rejectedPatchFields(schema, mudouPe, 'player', previous)).toEqual(['c_hab'])
    expect(rejectedPatchFields(schema, mudouPe, 'gm', previous)).toEqual([])
  })

  it('sem os valores gravados, fica só a regra do campo inteiro (como antes)', () => {
    expect(rejectedPatchFields(schema, mudouPe, 'player')).toEqual([])
  })
})

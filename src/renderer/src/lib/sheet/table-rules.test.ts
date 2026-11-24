import { describe, expect, it } from 'vitest'
import { createSheetContext, isTableRowVisible } from './context'
import { findKeyUsages, renameKeyInSchema } from './formula-refs'
import { parseTemplateFile, TEMPLATE_FILE_FORMAT } from './schema'
import type { SheetComponent, SheetSchema } from './types'
import { validateSchema } from './validate'

/**
 * As três opções de tabela e botão de 24/11/2026: coluna travada para o mestre, "mostrar a
 * linha quando" e "desconta ao rolar". Todas opcionais: modelo sem elas não muda.
 */

const layout = { x: 0, y: 0, w: 2, h: 2 }
type TableComponent = Extract<SheetComponent, { type: 'table' }>

function table(extra: Partial<TableComponent> = {}): TableComponent {
  return {
    id: 'c_hab', key: 'hab', label: 'Habilidades', type: 'table', editableBy: 'player', visibleTo: 'all', layout: { x: 0, y: 2, w: 12, h: 6 },
    playerCanAddRows: false, showRowLabels: true, rowVisibleWhen: 'nv <= nivel',
    columns: [
      { id: 'a', key: 'esc', label: 'Esc.', kind: 'checkbox' },
      { id: 'b', key: 'nv', label: 'Nv', kind: 'number', editableBy: 'gm' },
      { id: 'c', key: 'pe', label: 'PE', kind: 'number', editableBy: 'gm' },
      { id: 'd', key: 'usar', label: 'Usar', kind: 'rollButton', formula: '{pe}', critical: { kind: 'none' }, criticalFailureOnOne: false, cost: { target: 'energia', amount: '=se(esc, pe, 0)' } }
    ],
    rows: [
      { id: 'r1', key: 'golpe', label: 'Golpe', cells: { nv: 1, pe: 1 } },
      { id: 'r2', key: 'furia', label: 'Fúria', cells: { nv: 3, pe: 5 } }
    ],
    ...extra
  }
}

function schema(components: SheetComponent[] = [table()]): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [{ id: 't', label: 'T', components: [
      { id: 'c_nivel', key: 'nivel', label: 'Nível', type: 'number', editableBy: 'gm', visibleTo: 'all', layout },
      { id: 'c_energia', key: 'energia', label: 'Energia', type: 'resource', maxValue: 6, showButtons: true, editableBy: 'player', visibleTo: 'all', layout },
      { id: 'c_nome', key: 'nome', label: 'Nome', type: 'text', editableBy: 'player', visibleTo: 'all', layout },
      { id: 'c_pocao', key: 'pocao', label: 'Poção', type: 'rollButton', formula: '6', critical: { kind: 'none' }, criticalFailureOnOne: false, editableBy: 'player', visibleTo: 'all', layout, cost: { target: 'energia', amount: '1' } },
      ...components
    ] }]
  }
}

const codes = (s: SheetSchema): string[] => validateSchema(s).issues.map((issue) => issue.code)

describe('validação', () => {
  it('aceita as opções novas sem erro nem ciclo', () => {
    const report = validateSchema(schema())
    expect(report.errors).toEqual([])
  })

  it('acusa alvo que não existe, que não é barra nem número, e quantidade vazia', () => {
    const semAlvo = table({ columns: table().columns.map((c) => (c.kind === 'rollButton' ? { ...c, cost: { target: 'energiaa', amount: '1' } } : c)) })
    expect(codes(schema([semAlvo]))).toContain('formula-unknown-reference')

    const texto = table({ columns: table().columns.map((c) => (c.kind === 'rollButton' ? { ...c, cost: { target: 'nome', amount: '1' } } : c)) })
    expect(codes(schema([texto]))).toContain('cost-target-type')

    const vazio = table({ columns: table().columns.map((c) => (c.kind === 'rollButton' ? { ...c, cost: { target: 'energia', amount: ' ' } } : c)) })
    expect(codes(schema([vazio]))).toContain('cost-no-amount')
  })

  it('o alvo de uma coluna é da ficha, não da linha', () => {
    // "pe" é coluna da linha, mas não é barra da ficha: não pode ser alvo.
    const colunaComoAlvo = table({ columns: table().columns.map((c) => (c.kind === 'rollButton' ? { ...c, cost: { target: 'pe', amount: '1' } } : c)) })
    expect(codes(schema([colunaComoAlvo]))).toContain('formula-unknown-reference')
  })

  it('acusa referência que não existe em "mostrar a linha quando"', () => {
    expect(codes(schema([table({ rowVisibleWhen: 'nv <= nivell' })]))).toContain('formula-unknown-reference')
  })
})

describe('renomear chave', () => {
  it('acompanha o alvo do desconto, a quantidade e a condição da linha', () => {
    let next = renameKeyInSchema(schema(), 'c_energia', 'pe_atual')
    next = renameKeyInSchema(next, 'c_nivel', 'nivel_personagem')
    const all = next.tabs[0]!.components
    const hab = all.find((c) => c.key === 'hab') as TableComponent
    const pocao = all.find((c) => c.key === 'pocao') as Extract<SheetComponent, { type: 'rollButton' }>

    expect(pocao.cost?.target).toBe('pe_atual')
    expect(hab.columns.find((c) => c.key === 'usar')?.cost?.target).toBe('pe_atual')
    expect(hab.rowVisibleWhen).toBe('nv <= nivel_personagem')
    expect(validateSchema(next).errors).toEqual([])
  })

  it('o aviso de exclusão encontra o desconto', () => {
    const usages = findKeyUsages(schema(), 'energia').map((usage) => usage.slot.field)
    expect(usages).toContain('cost.target')
    expect(usages).toContain('columns[3].cost.target')
  })
})

describe('importação', () => {
  const file = (s: SheetSchema): string =>
    JSON.stringify({ format: TEMPLATE_FILE_FORMAT, fileVersion: 1, name: 'Teste', kind: 'character', schema: s })

  it('aceita as opções novas e as mantém', () => {
    const parsed = parseTemplateFile(file(schema()))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const hab = parsed.value.schema.tabs[0]!.components.find((c) => c.key === 'hab') as TableComponent
    expect(hab.rowVisibleWhen).toBe('nv <= nivel')
    expect(hab.columns[1]?.editableBy).toBe('gm')
    expect(hab.columns[3]?.cost).toEqual({ target: 'energia', amount: '=se(esc, pe, 0)' })
  })

  it('recusa permissão de coluna inventada', () => {
    const ruim = table({ columns: [{ id: 'a', key: 'esc', label: 'Esc.', kind: 'checkbox', editableBy: 'todos' as 'gm' }] })
    expect(parseTemplateFile(file(schema([ruim]))).ok).toBe(false)
  })
})

describe('mostrar a linha quando', () => {
  it('vale por linha, com as colunas da própria linha', () => {
    const s = schema()
    const { context } = createSheetContext(s, {
      c_nivel: 2,
      c_hab: [
        { id: 'r1', key: 'golpe', cells: { esc: false, nv: 1, pe: 1 } },
        { id: 'r2', key: 'furia', cells: { esc: false, nv: 3, pe: 5 } }
      ]
    })
    const hab = s.tabs[0]!.components.find((c) => c.key === 'hab') as TableComponent
    expect(isTableRowVisible(context, hab, 'golpe')).toBe(true)
    expect(isTableRowVisible(context, hab, 'furia')).toBe(false)
  })

  it('sem condição, ou com condição quebrada, mostra a linha', () => {
    const s = schema([table({ rowVisibleWhen: undefined })])
    const { context } = createSheetContext(s, {})
    const hab = s.tabs[0]!.components.find((c) => c.key === 'hab') as TableComponent
    expect(isTableRowVisible(context, hab, 'golpe')).toBe(true)
    expect(isTableRowVisible(context, { ...hab, rowVisibleWhen: 'nao_existe > 1' }, 'golpe')).toBe(true)
  })
})

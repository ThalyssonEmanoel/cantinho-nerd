import { describe, expect, it } from 'vitest'
import { evaluateFormula } from '../formula'
import { computeSheet, createInitialValues, createSheetContext } from './context'
import { createExampleSchema } from './example-template'
import type { SheetSchema } from './types'
import { createDefaultValues, type SheetValues } from './values'

/** Modelo pequeno, montado à mão, para testar cada regra isolada. */
function buildSchema(): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [
      {
        id: 'tab',
        label: 'Geral',
        components: [
          {
            id: 'c1',
            type: 'attribute',
            key: 'forca',
            label: 'Força',
            editableBy: 'player',
            visibleTo: 'all',
            defaultValue: 15,
            modifierFormula: 'piso((valor - 10) / 2)',
            layout: { x: 0, y: 0, w: 2, h: 3 }
          },
          {
            id: 'c2',
            type: 'number',
            key: 'nivel',
            label: 'Nível',
            editableBy: 'player',
            visibleTo: 'all',
            defaultValue: 3,
            layout: { x: 2, y: 0, w: 2, h: 2 }
          },
          {
            id: 'c3',
            type: 'resource',
            key: 'vida',
            label: 'Vida',
            editableBy: 'player',
            visibleTo: 'all',
            maxFormula: '=10 + forca.mod * nivel',
            showButtons: true,
            role: 'hp',
            layout: { x: 4, y: 0, w: 4, h: 2 }
          },
          {
            id: 'c4',
            type: 'computed',
            key: 'defesa',
            label: 'Defesa',
            editableBy: 'gm',
            visibleTo: 'all',
            formula: '=10 + forca.mod',
            format: 'integer',
            role: 'defense',
            layout: { x: 8, y: 0, w: 2, h: 2 }
          },
          {
            id: 'c5',
            type: 'select',
            key: 'tamanho',
            label: 'Tamanho',
            editableBy: 'player',
            visibleTo: 'all',
            options: [
              { id: 'o1', label: 'Médio', value: 0 },
              { id: 'o2', label: 'Grande', value: 2 },
              { id: 'o3', label: 'Enorme' }
            ],
            defaultOptionId: 'o2',
            layout: { x: 0, y: 3, w: 3, h: 2 }
          },
          {
            id: 'c6',
            type: 'checkbox',
            key: 'treinado',
            label: 'Treinado',
            editableBy: 'player',
            visibleTo: 'all',
            defaultValue: true,
            layout: { x: 3, y: 3, w: 2, h: 2 }
          },
          {
            id: 'c7',
            type: 'text',
            key: 'nome',
            label: 'Nome',
            editableBy: 'player',
            visibleTo: 'all',
            role: 'name',
            layout: { x: 5, y: 3, w: 4, h: 2 }
          },
          {
            id: 'c8',
            type: 'table',
            key: 'inventario',
            label: 'Mochila',
            editableBy: 'player',
            visibleTo: 'all',
            playerCanAddRows: true,
            showRowLabels: false,
            columns: [
              { id: 'k1', key: 'item', label: 'Item', kind: 'text' },
              { id: 'k2', key: 'peso', label: 'Peso', kind: 'number' },
              { id: 'k3', key: 'quantidade', label: 'Qtd', kind: 'number' },
              {
                id: 'k4',
                key: 'carga',
                label: 'Carga',
                kind: 'computed',
                formula: '=peso * quantidade',
                format: 'decimal'
              }
            ],
            rows: [],
            layout: { x: 0, y: 5, w: 12, h: 6 }
          }
        ]
      }
    ]
  }
}

const schema = buildSchema()

function valuesWithInventory(): SheetValues {
  const values = createDefaultValues(schema)
  values['c8'] = [
    { id: 'r1', cells: { item: 'Corda', peso: 2, quantidade: 1 } },
    { id: 'r2', cells: { item: 'Poção', peso: 0.5, quantidade: 4 } }
  ]
  return values
}

function resolve(path: string[], values = createInitialValues(schema)): unknown {
  return createSheetContext(schema, values).context.resolve(path)
}

describe('createSheetContext — valores próprios', () => {
  it('atributo devolve o valor e `.mod` roda a fórmula do modificador', () => {
    expect(resolve(['forca'])).toBe(15)
    expect(resolve(['forca', 'mod'])).toBe(2)
  })

  it('barra devolve o atual e `.max` calcula a fórmula do máximo', () => {
    // 10 + mod(2) * nivel(3) = 16
    expect(resolve(['vida', 'max'])).toBe(16)
    expect(resolve(['vida'])).toBe(16)
  })

  it('campo calculado é resolvido na hora', () => {
    expect(resolve(['defesa'])).toBe(12)
  })

  it('lista de opções devolve o valor numérico quando existe', () => {
    expect(resolve(['tamanho'])).toBe(2)
  })

  it('lista de opções sem valor numérico devolve o rótulo', () => {
    const values = createDefaultValues(schema)
    values['c5'] = 'o3'
    expect(resolve(['tamanho'], values)).toBe('Enorme')
  })

  it('caixa de seleção devolve booleano', () => {
    expect(resolve(['treinado'])).toBe(true)
  })

  it('campo que não existe devolve undefined', () => {
    expect(resolve(['xyz'])).toBeUndefined()
    expect(resolve(['forca', 'max'])).toBeUndefined()
  })
})

describe('createSheetContext — tabelas', () => {
  it('soma uma coluna', () => {
    const { context } = createSheetContext(schema, valuesWithInventory())
    expect(evaluateFormula('=soma(inventario.peso)', context)).toEqual({ ok: true, value: 2.5 })
  })

  it('conta as linhas', () => {
    const { context } = createSheetContext(schema, valuesWithInventory())
    expect(evaluateFormula('=contar(inventario)', context)).toEqual({ ok: true, value: 2 })
  })

  it('coluna calculada usa as colunas da própria linha', () => {
    const { context } = createSheetContext(schema, valuesWithInventory())
    // Linha sem chave é acessada pelo id: carga da poção = 0,5 * 4
    expect(context.resolve(['inventario', 'r2', 'carga'])).toBe(2)
  })

  it('soma de coluna calculada também funciona', () => {
    const { context } = createSheetContext(schema, valuesWithInventory())
    expect(evaluateFormula('=soma(inventario.carga)', context)).toEqual({ ok: true, value: 4 })
  })
})

describe('createSheetContext — dependência circular', () => {
  it('não trava quando um campo calculado se refere a si mesmo', () => {
    const circular: SheetSchema = {
      formatVersion: 1,
      tabs: [
        {
          id: 't',
          label: 'T',
          components: [
            {
              id: 'a',
              type: 'computed',
              key: 'a',
              label: 'A',
              editableBy: 'gm',
              visibleTo: 'all',
              formula: '=b + 1',
              format: 'integer',
              layout: { x: 0, y: 0, w: 2, h: 2 }
            },
            {
              id: 'b',
              type: 'computed',
              key: 'b',
              label: 'B',
              editableBy: 'gm',
              visibleTo: 'all',
              formula: '=a + 1',
              format: 'integer',
              layout: { x: 2, y: 0, w: 2, h: 2 }
            }
          ]
        }
      ]
    }

    const { context } = createSheetContext(circular, {})
    const result = evaluateFormula('=a', context)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('cycle')
  })

  it('repassa o motivo do erro para quem dependia do campo', () => {
    const broken: SheetSchema = {
      formatVersion: 1,
      tabs: [
        {
          id: 't',
          label: 'T',
          components: [
            {
              id: 'a',
              type: 'computed',
              key: 'quebrado',
              label: 'Quebrado',
              editableBy: 'gm',
              visibleTo: 'all',
              formula: '=1 / 0',
              format: 'integer',
              layout: { x: 0, y: 0, w: 2, h: 2 }
            },
            {
              id: 'b',
              type: 'computed',
              key: 'depende',
              label: 'Depende',
              editableBy: 'gm',
              visibleTo: 'all',
              formula: '=quebrado + 1',
              format: 'integer',
              layout: { x: 2, y: 0, w: 2, h: 2 }
            }
          ]
        }
      ]
    }

    const { context } = createSheetContext(broken, {})
    const result = evaluateFormula('=depende', context)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('division-by-zero')
      expect(result.error.message).toContain('quebrado')
    }
  })
})

describe('computeSheet', () => {
  it('monta o cache dos calculados e o resumo dos papéis', () => {
    const values = createInitialValues(schema)
    values['c7'] = 'Shiraga'
    const result = computeSheet(schema, values)

    expect(result.computed['defesa']).toBe(12)
    expect(result.computed['forca.mod']).toBe(2)
    expect(result.computed['vida.max']).toBe(16)
    expect(result.summary.name).toBe('Shiraga')
    expect(result.summary.bars.hp).toEqual({ current: 16, max: 16 })
    expect(result.summary.defense).toBe(12)
    expect(result.errors.size).toBe(0)
  })

  it('registra o erro por chave sem derrubar o resto', () => {
    const withBroken = structuredClone(schema)
    const computed = withBroken.tabs[0]?.components.find((c) => c.key === 'defesa')
    if (computed?.type === 'computed') computed.formula = '=1 +'

    const result = computeSheet(withBroken, createDefaultValues(withBroken))
    expect(result.errors.has('defesa')).toBe(true)
    expect(result.computed['vida.max']).toBe(16)
  })
})

describe('modelo de exemplo', () => {
  const example = createExampleSchema()
  const values = createInitialValues(example)

  it('calcula vida, defesa e proficiência do jeito esperado', () => {
    const result = computeSheet(example, values)
    // Constituição 10 → mod 0; nível 1 → vida 10 + 0 * 1
    expect(result.computed['vida.max']).toBe(10)
    expect(result.computed['defesa']).toBe(10)
    // 1 + teto(1 / 4) = 2
    expect(result.computed['proficiencia']).toBe(2)
    expect(result.errors.size).toBe(0)
  })

  it('a coluna calculada das perícias soma o treino', () => {
    const { context } = createSheetContext(example, values)
    expect(context.resolve(['pericias', 'furtividade', 'total'])).toBe(0)

    const treinado = structuredClone(values)
    const rows = treinado['c_pericias']
    if (Array.isArray(rows)) {
      rows[0] = { ...rows[0], cells: { ...rows[0]?.cells, treinado: true, bonus: 1 } } as never
    }
    const comTreino = createSheetContext(example, treinado).context
    // bonus 1 + proficiencia 2
    expect(comTreino.resolve(['pericias', 'acrobacia', 'total'])).toBe(3)
  })

  it('o peso total começa em zero com a mochila vazia', () => {
    const result = computeSheet(example, values)
    expect(result.computed['peso_total']).toBe(0)
  })
})

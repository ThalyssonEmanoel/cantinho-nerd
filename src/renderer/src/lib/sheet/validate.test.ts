import { describe, expect, it } from 'vitest'
import { createExampleSchema } from './example-template'
import { createComponent } from './factory'
import type { SheetComponent, SheetSchema } from './types'
import { validateSchema } from './validate'

function schemaWith(...components: SheetComponent[]): SheetSchema {
  return { formatVersion: 1, tabs: [{ id: 'tab', label: 'Geral', components }] }
}

function component(
  partial: Partial<SheetComponent> & Pick<SheetComponent, 'type'>
): SheetComponent {
  const base = createComponent(partial.type, { takenKeys: [] })
  return { ...base, ...partial } as SheetComponent
}

function codesOf(schema: SheetSchema): string[] {
  return validateSchema(schema).issues.map((issue) => issue.code)
}

describe('validateSchema — modelo de exemplo', () => {
  it('passa sem erro nem aviso', () => {
    const report = validateSchema(createExampleSchema())
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.ok).toBe(true)
  })
})

describe('validateSchema — chaves', () => {
  it('acusa chave repetida', () => {
    const schema = schemaWith(
      component({ type: 'number', id: 'a', key: 'forca', label: 'Força' }),
      component({ type: 'number', id: 'b', key: 'forca', label: 'Vigor' })
    )
    expect(codesOf(schema)).toContain('key-duplicate')
  })

  it('acusa chave reservada e chave com formato errado', () => {
    const schema = schemaWith(
      component({ type: 'number', id: 'a', key: 'soma', label: 'Soma' }),
      component({ type: 'number', id: 'b', key: '2d', label: 'Dois' })
    )
    const codes = codesOf(schema)
    expect(codes).toContain('key-reserved')
    expect(codes).toContain('key-format')
  })

  it('ignora chave de componente decorativo', () => {
    const schema = schemaWith(
      component({ type: 'heading', id: 'a', key: '', label: 'Seção' }),
      component({ type: 'number', id: 'b', key: 'vida', label: 'Vida', role: 'hp' })
    )
    expect(codesOf(schema)).not.toContain('key-empty')
  })
})

describe('validateSchema — fórmulas', () => {
  it('acusa fórmula que não compila', () => {
    const schema = schemaWith(
      component({ type: 'computed', id: 'a', key: 'total', formula: '=1 +', format: 'integer' })
    )
    expect(codesOf(schema)).toContain('formula-invalid')
  })

  it('acusa referência a campo que não existe', () => {
    const schema = schemaWith(
      component({ type: 'computed', id: 'a', key: 'total', formula: '=xyz + 1', format: 'integer' })
    )
    const report = validateSchema(schema)
    expect(report.errors.some((issue) => issue.code === 'formula-unknown-reference')).toBe(true)
    expect(report.errors[0]?.message).toContain('xyz')
  })

  it('acusa `.mod` em componente que não é atributo', () => {
    const schema = schemaWith(
      component({ type: 'number', id: 'a', key: 'nivel', label: 'Nível' }),
      component({
        type: 'computed',
        id: 'b',
        key: 'total',
        formula: '=nivel.mod',
        format: 'integer'
      })
    )
    expect(codesOf(schema)).toContain('formula-unknown-reference')
  })

  it('aceita `.mod` de atributo e `.max` de barra', () => {
    const schema = schemaWith(
      component({ type: 'attribute', id: 'a', key: 'forca', modifierFormula: 'valor' }),
      component({ type: 'resource', id: 'b', key: 'vida', maxValue: 10, role: 'hp' }),
      component({
        type: 'computed',
        id: 'c',
        key: 'total',
        formula: '=forca.mod + vida.max',
        format: 'integer'
      })
    )
    expect(validateSchema(schema).errors).toEqual([])
  })

  it('acusa coluna inexistente numa referência de tabela', () => {
    const table = component({
      type: 'table',
      id: 't',
      key: 'pericias',
      columns: [{ id: 'c1', key: 'bonus', label: 'Bônus', kind: 'number' }],
      rows: [{ id: 'r1', key: 'furtividade', label: 'Furtividade' }]
    })
    const schema = schemaWith(
      table,
      component({
        type: 'computed',
        id: 'x',
        key: 'total',
        formula: '=pericias.furtividade.inexistente',
        format: 'integer'
      })
    )
    expect(codesOf(schema)).toContain('formula-unknown-reference')
  })

  it('acusa notação de rolagem inválida', () => {
    const schema = schemaWith(
      component({ type: 'rollButton', id: 'a', key: 'ataque', formula: '1d20++' })
    )
    expect(codesOf(schema)).toContain('notation-invalid')
  })

  it('aceita notação com chaves calculadas', () => {
    const schema = schemaWith(
      component({ type: 'attribute', id: 'f', key: 'forca', modifierFormula: 'valor' }),
      component({ type: 'resource', id: 'v', key: 'vida', maxValue: 1, role: 'hp' }),
      component({
        type: 'rollButton',
        id: 'a',
        key: 'ataque',
        formula: '{forca}d20kh1 + {forca.mod}'
      })
    )
    expect(validateSchema(schema).errors).toEqual([])
  })
})

describe('validateSchema — dependência circular', () => {
  it('acusa ciclo entre campos calculados', () => {
    const schema = schemaWith(
      component({ type: 'computed', id: 'a', key: 'a', formula: '=b + 1', format: 'integer' }),
      component({ type: 'computed', id: 'b', key: 'b', formula: '=a + 1', format: 'integer' })
    )
    const report = validateSchema(schema)
    const cycle = report.errors.find((issue) => issue.code === 'formula-cycle')
    expect(cycle?.message).toContain('a → b → a')
  })

  it('acusa ciclo passando pelo máximo de uma barra', () => {
    const schema = schemaWith(
      component({ type: 'resource', id: 'v', key: 'vida', maxFormula: '=esforco', role: 'hp' }),
      component({
        type: 'computed',
        id: 'e',
        key: 'esforco',
        formula: '=vida.max',
        format: 'integer'
      })
    )
    expect(codesOf(schema)).toContain('formula-cycle')
  })

  it('não confunde coluna da própria linha com dependência entre componentes', () => {
    const table = component({
      type: 'table',
      id: 't',
      key: 'pericias',
      columns: [
        { id: 'c1', key: 'bonus', label: 'Bônus', kind: 'number' },
        {
          id: 'c2',
          key: 'total',
          label: 'Total',
          kind: 'computed',
          formula: '=bonus + 1',
          format: 'integer'
        }
      ],
      rows: []
    })
    expect(validateSchema(schemaWith(table)).errors).toEqual([])
  })
})

describe('validateSchema — papéis', () => {
  it('avisa quando falta a barra de vida', () => {
    const schema = schemaWith(component({ type: 'number', id: 'a', key: 'nivel' }))
    const report = validateSchema(schema)
    expect(report.warnings.map((issue) => issue.code)).toContain('role-missing-hp')
    // Aviso não impede publicar.
    expect(report.ok).toBe(true)
  })

  it('acusa papel repetido', () => {
    const schema = schemaWith(
      component({ type: 'resource', id: 'a', key: 'vida', maxValue: 10, role: 'hp' }),
      component({ type: 'resource', id: 'b', key: 'sanidade', maxValue: 10, role: 'hp' })
    )
    expect(codesOf(schema)).toContain('role-duplicate')
  })

  it('acusa papel em tipo de componente que não pode assumi-lo', () => {
    const schema = schemaWith(component({ type: 'text', id: 'a', key: 'vida', role: 'hp' }))
    expect(codesOf(schema)).toContain('role-type')
  })
})

describe('validateSchema — vazamento de informação', () => {
  it('acusa campo visível ao jogador que depende de campo só do mestre', () => {
    const schema = schemaWith(
      component({ type: 'number', id: 'a', key: 'segredo', visibleTo: 'gm' }),
      component({
        type: 'computed',
        id: 'b',
        key: 'pista',
        formula: '=segredo * 2',
        format: 'integer',
        visibleTo: 'all'
      })
    )
    const report = validateSchema(schema)
    const leak = report.errors.find((issue) => issue.code === 'visibility-leak')
    expect(leak?.message).toContain('segredo')
  })

  it('deixa passar quando o campo que depende também é só do mestre', () => {
    const schema = schemaWith(
      component({ type: 'number', id: 'a', key: 'segredo', visibleTo: 'gm' }),
      component({
        type: 'computed',
        id: 'b',
        key: 'pista',
        formula: '=segredo * 2',
        format: 'integer',
        visibleTo: 'gm'
      }),
      component({ type: 'resource', id: 'c', key: 'vida', maxValue: 10, role: 'hp' })
    )
    expect(validateSchema(schema).errors).toEqual([])
  })
})

describe('validateSchema — forma dos componentes', () => {
  it('acusa lista sem opções e tabela sem colunas', () => {
    const schema = schemaWith(
      component({ type: 'select', id: 'a', key: 'classe', options: [] }),
      component({ type: 'table', id: 'b', key: 'itens', columns: [], rows: [] })
    )
    const codes = codesOf(schema)
    expect(codes).toContain('select-no-options')
    expect(codes).toContain('table-no-columns')
  })

  it('acusa barra sem máximo', () => {
    const schema = schemaWith(
      component({ type: 'resource', id: 'a', key: 'vida', maxValue: undefined, role: 'hp' })
    )
    expect(codesOf(schema)).toContain('resource-no-max')
  })

  it('acusa coluna repetida na tabela', () => {
    const schema = schemaWith(
      component({
        type: 'table',
        id: 'a',
        key: 'itens',
        columns: [
          { id: 'c1', key: 'peso', label: 'Peso', kind: 'number' },
          { id: 'c2', key: 'peso', label: 'Peso 2', kind: 'number' }
        ],
        rows: []
      })
    )
    expect(codesOf(schema)).toContain('column-key-duplicate')
  })
})

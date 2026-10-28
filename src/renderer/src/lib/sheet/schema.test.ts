import { describe, expect, it } from 'vitest'
import { createExampleSchema } from './example-template'
import { createTemplate } from './factory'
import {
  exportTemplateJson,
  MAX_IMPORT_BYTES,
  parseSheetSchema,
  parseTemplateFile,
  TEMPLATE_FILE_FORMAT
} from './schema'
import { createDefaultValues, migrateValues } from './values'

const template = createTemplate({
  name: 'Exemplo d20',
  kind: 'character',
  schema: createExampleSchema()
})

describe('exportar e importar', () => {
  it('fecha o ciclo: o que sai entra de volta igual', () => {
    const text = exportTemplateJson(template)
    const result = parseTemplateFile(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.format).toBe(TEMPLATE_FILE_FORMAT)
    expect(result.value.name).toBe('Exemplo d20')
    expect(result.value.kind).toBe('character')
    expect(result.value.schema).toEqual(template.draftSchema)
  })

  it('recusa arquivo que não é JSON', () => {
    const result = parseTemplateFile('isto não é json {')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('JSON')
  })

  it('recusa arquivo vazio', () => {
    expect(parseTemplateFile('   ').ok).toBe(false)
  })

  it('recusa JSON de outro formato', () => {
    const result = parseTemplateFile(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('modelo de ficha')
  })

  it('recusa modelo com componente inválido', () => {
    const broken = JSON.parse(exportTemplateJson(template)) as Record<string, unknown>
    const schema = broken['schema'] as { tabs: { components: unknown[] }[] }
    schema.tabs[0]?.components.push({ type: 'inventado', id: 'x' })

    expect(parseTemplateFile(JSON.stringify(broken)).ok).toBe(false)
  })

  it('recusa arquivo grande demais sem tentar interpretar', () => {
    const huge = 'x'.repeat(MAX_IMPORT_BYTES + 1)
    const result = parseTemplateFile(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('grande demais')
  })

  it('não lança com nenhuma entrada estranha', () => {
    for (const text of ['null', '[]', '{}', '"texto"', '0']) {
      expect(() => parseTemplateFile(text)).not.toThrow()
      expect(parseTemplateFile(text).ok).toBe(false)
    }
  })
})

describe('parseSheetSchema', () => {
  it('aceita o esquema do exemplo', () => {
    expect(parseSheetSchema(createExampleSchema())).not.toBeNull()
  })

  it('recusa esquema sem aba', () => {
    expect(parseSheetSchema({ formatVersion: 1, tabs: [] })).toBeNull()
  })

  it('recusa versão de formato desconhecida', () => {
    expect(parseSheetSchema({ formatVersion: 2, tabs: [] })).toBeNull()
  })
})

describe('migrateValues', () => {
  const schema = createExampleSchema()

  it('dá o padrão para componente novo e guarda o valor do que saiu', () => {
    const previous = { c_nome: 'Shiraga', c_que_nao_existe_mais: 42 }
    const result = migrateValues(schema, previous)

    expect(result.values['c_nome']).toBe('Shiraga')
    // Valor de componente removido fica guardado, escondido (5.7).
    expect(result.values['c_que_nao_existe_mais']).toBe(42)
    expect(result.orphanedIds).toEqual(['c_que_nao_existe_mais'])
    expect(result.addedIds).toContain('c_nivel')
  })

  it('não mexe no que já está preenchido', () => {
    const values = createDefaultValues(schema)
    values['c_nivel'] = 7
    const result = migrateValues(schema, values)
    expect(result.values['c_nivel']).toBe(7)
    expect(result.addedIds).toEqual([])
  })

  it('coluna nova numa tabela com linhas ganha o padrão em cada linha', () => {
    const values = createDefaultValues(schema)
    values['c_inventario'] = [{ id: 'r1', cells: { item: 'Corda' } }]

    const result = migrateValues(schema, values)
    const rows = result.values['c_inventario']
    expect(Array.isArray(rows)).toBe(true)
    if (!Array.isArray(rows)) return
    expect(rows[0]?.cells).toEqual({ item: 'Corda', peso: 0, quantidade: 0 })
  })
})

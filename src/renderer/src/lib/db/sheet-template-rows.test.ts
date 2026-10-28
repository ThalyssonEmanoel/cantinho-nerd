import { describe, expect, it } from 'vitest'
import { allComponents, createExampleSchema } from '@/lib/sheet'
import {
  schemaToJson,
  summaryFromRow,
  templateFromRow,
  versionsFromRows
} from './sheet-template-rows'

const example = schemaToJson(createExampleSchema())

const baseRow = {
  id: '6f1c1d2e-0000-4000-8000-000000000001',
  name: 'Exemplo d20',
  kind: 'character',
  draft_schema: example,
  created_at: '2026-10-28T10:00:00Z',
  updated_at: '2026-10-28T11:00:00Z'
}

describe('templateFromRow', () => {
  it('monta o modelo com as versões em ordem', () => {
    const template = templateFromRow({
      ...baseRow,
      sheet_template_versions: [
        { version: 2, schema: example, published_at: '2026-10-28T10:30:00Z' },
        { version: 1, schema: example, published_at: '2026-10-28T10:10:00Z' }
      ]
    })

    expect(template?.name).toBe('Exemplo d20')
    expect(template?.kind).toBe('character')
    expect(template?.versions.map((version) => version.version)).toEqual([1, 2])
    expect(template?.updatedAt).toBe('2026-10-28T11:00:00Z')
  })

  it('rascunho corrompido ou tipo desconhecido viram null, sem quebrar', () => {
    expect(
      templateFromRow({ ...baseRow, draft_schema: { tabs: 'x' }, sheet_template_versions: [] })
    ).toBeNull()
    expect(templateFromRow({ ...baseRow, kind: 'npc', sheet_template_versions: [] })).toBeNull()
  })
})

describe('versionsFromRows', () => {
  it('deixa de fora só a versão corrompida', () => {
    const versions = versionsFromRows([
      { version: 1, schema: example, published_at: 'a' },
      { version: 2, schema: { nada: true }, published_at: 'b' },
      { version: 3, schema: example, published_at: 'c' }
    ])
    expect(versions.map((version) => version.version)).toEqual([1, 3])
  })
})

describe('summaryFromRow', () => {
  it('conta componentes e pega a versão mais alta', () => {
    const summary = summaryFromRow({
      ...baseRow,
      sheet_template_versions: [{ version: 1 }, { version: 3 }, { version: 2 }]
    })
    expect(summary?.publishedVersion).toBe(3)
    expect(summary?.componentCount).toBe(allComponents(createExampleSchema()).length)
  })

  it('sem versões é rascunho', () => {
    expect(summaryFromRow({ ...baseRow, sheet_template_versions: [] })?.publishedVersion).toBeNull()
  })
})

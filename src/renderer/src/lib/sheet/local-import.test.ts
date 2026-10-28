import { describe, expect, it } from 'vitest'
import { createExampleSchema, EXAMPLE_TEMPLATE_NAME } from './example-template'
import { createTemplate } from './factory'
import { isPristineExample, planLocalImport } from './local-import'
import { createLocalTemplateRepository, removeLocalTemplates } from './repository'
import { createLocalSheetRepository, relinkLocalSheets } from './sheet-repository'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length(): number {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    }
  }
}

describe('isPristineExample', () => {
  it('reconhece o exemplo que ninguém mexeu', () => {
    const example = createTemplate({
      name: EXAMPLE_TEMPLATE_NAME,
      kind: 'character',
      schema: createExampleSchema()
    })
    expect(isPristineExample(example)).toBe(true)
  })

  it('o exemplo editado, renomeado ou publicado é trabalho do mestre e sobe', () => {
    const edited = createExampleSchema()
    edited.tabs[0]!.label = 'Minha aba'
    expect(
      isPristineExample(
        createTemplate({ name: EXAMPLE_TEMPLATE_NAME, kind: 'character', schema: edited })
      )
    ).toBe(false)

    expect(
      isPristineExample(
        createTemplate({ name: 'Meu d20', kind: 'character', schema: createExampleSchema() })
      )
    ).toBe(false)

    const published = createTemplate({
      name: EXAMPLE_TEMPLATE_NAME,
      kind: 'character',
      schema: createExampleSchema()
    })
    published.versions.push({ version: 1, schema: createExampleSchema(), publishedAt: 'x' })
    expect(isPristineExample(published)).toBe(false)
  })
})

describe('planLocalImport', () => {
  it('separa o que sobe do exemplo intocado', () => {
    const example = createTemplate({
      name: EXAMPLE_TEMPLATE_NAME,
      kind: 'character',
      schema: createExampleSchema()
    })
    const ordem = createTemplate({ name: 'Ordem Paranormal', kind: 'character' })
    const plan = planLocalImport([example, ordem])
    expect(plan.upload.map((item) => item.name)).toEqual(['Ordem Paranormal'])
    expect(plan.skip.map((item) => item.name)).toEqual([EXAMPLE_TEMPLATE_NAME])
  })
})

describe('depois de subir', () => {
  it('as fichas locais passam a apontar para o modelo novo e continuam abrindo', async () => {
    const storage = createMemoryStorage()
    const local = createLocalTemplateRepository(storage)
    const sheets = createLocalSheetRepository(local, storage)

    const template = await local.create({
      name: 'Ordem',
      kind: 'character',
      schema: createExampleSchema()
    })
    await local.publish(template.id)
    const sheet = await sheets.create({ templateId: template.id, ownerName: 'Thalysson' })

    expect(relinkLocalSheets(new Map([[template.id, 'uuid-novo']]), storage)).toBe(1)
    expect((await sheets.get(sheet.id))?.templateId).toBe('uuid-novo')

    // Ficha de outro modelo não é tocada.
    expect(relinkLocalSheets(new Map([['tpl_outro', 'x']]), storage)).toBe(0)
  })

  it('os modelos que subiram saem do armazenamento local', async () => {
    const storage = createMemoryStorage()
    const local = createLocalTemplateRepository(storage)
    const a = await local.create({ name: 'A', kind: 'character' })
    const b = await local.create({ name: 'B', kind: 'creature' })

    removeLocalTemplates([a.id], storage)
    expect((await local.list()).map((item) => item.id)).toEqual([b.id])
  })
})

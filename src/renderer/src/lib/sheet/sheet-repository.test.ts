import { beforeEach, describe, expect, it } from 'vitest'
import { createExampleSchema } from './example-template'
import { createLocalTemplateRepository, type TemplateRepository } from './repository'
import {
  createLocalSheetRepository,
  SheetPermissionError,
  type SheetRepository
} from './sheet-repository'
import { allComponents, type SheetSchema } from './types'
import { isResourceValue } from './values'

/** Armazenamento de mentira: os testes não dependem do localStorage do navegador. */
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

let storage: Storage
let templates: TemplateRepository
let sheets: SheetRepository

beforeEach(() => {
  storage = createMemoryStorage()
  templates = createLocalTemplateRepository(storage)
  sheets = createLocalSheetRepository(templates, storage)
})

/** Modelo publicado, do jeito que a ficha precisa (5.1). */
async function publishedTemplate(schema: SheetSchema = createExampleSchema()): Promise<string> {
  const template = await templates.create({ name: 'Exemplo d20', kind: 'character', schema })
  await templates.publish(template.id)
  return template.id
}

describe('createLocalSheetRepository', () => {
  it('cria a ficha presa à última versão publicada', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    expect(sheet.templateVersion).toBe(1)
    expect(sheet.ownerName).toBe('Thalysson')
    expect(await sheets.get(sheet.id)).toEqual(sheet)
  })

  it('recusa criar ficha de modelo que ainda é rascunho', async () => {
    const template = await templates.create({
      name: 'Rascunho',
      kind: 'character',
      schema: createExampleSchema()
    })

    await expect(sheets.create({ templateId: template.id, ownerName: 'Ana' })).rejects.toThrow(
      /Publique uma versão/
    )
  })

  it('a lista mostra nome do personagem e barra de vida', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })
    await sheets.patch(sheet.id, { values: { c_nome: 'Vaz' } }, 'player')

    const [row] = await sheets.list()

    expect(row?.name).toBe('Vaz')
    expect(row?.bars.hp).toEqual({ current: 10, max: 10 })
    expect(row?.templateName).toBe('Exemplo d20')
  })

  it('o esquema da ficha continua o da versão publicada, não o do rascunho', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    // O mestre continua mexendo no rascunho depois de publicar.
    await templates.saveDraft(templateId, {
      formatVersion: 1,
      tabs: [{ id: 'tab_nova', label: 'Começando de novo', components: [] }]
    })

    const schema = await sheets.schemaOf(sheet)
    expect(schema?.tabs[0]?.id).toBe('tab_personagem')
    expect(schema?.tabs.length).toBeGreaterThan(1)
  })

  it('grava campo a campo: duas alterações seguidas não se perdem', async () => {
    const templateId = await publishedTemplate()
    const created = await sheets.create({ templateId, ownerName: 'Thalysson' })

    // A cópia que a tela do jogador tem em mãos, de antes do dano.
    const copiaDoJogador = created

    // O mestre aplica dano.
    await sheets.patch(created.id, { values: { c_vida: { current: 3 } } }, 'gm')

    // O jogador grava o nome a partir da cópia velha: o patch leva só o campo dele.
    const afterPlayer = await sheets.patch(
      copiaDoJogador.id,
      { values: { c_nome: 'Vaz' } },
      'player'
    )

    const vida = afterPlayer.values.c_vida
    expect(afterPlayer.values.c_nome).toBe('Vaz')
    expect(isResourceValue(vida) ? vida.current : -1).toBe(3)
  })

  it('recusa o patch de um campo que o jogador não pode alterar', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    await expect(
      sheets.patch(sheet.id, { gmValues: { c_notas_mestre: 'espiando' } }, 'player')
    ).rejects.toBeInstanceOf(SheetPermissionError)

    // E nada foi gravado.
    const stored = await sheets.get(sheet.id)
    expect(stored?.gmValues.c_notas_mestre).toBe('')
  })

  it('o mestre altera o campo dele', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    const patched = await sheets.patch(
      sheet.id,
      { gmValues: { c_notas_mestre: 'traidor' } },
      'gm'
    )
    expect(patched.gmValues.c_notas_mestre).toBe('traidor')
  })

  it('remove a ficha', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    await sheets.remove(sheet.id)
    expect(await sheets.get(sheet.id)).toBeNull()
    expect(await sheets.list()).toEqual([])
  })

  it('ignora ficha corrompida no armazenamento', async () => {
    storage.setItem('cantinho-nerd:sheets', JSON.stringify([{ id: 'quebrada' }]))
    expect(await sheets.list()).toEqual([])
  })
})

describe('syncToLatestVersion', () => {
  it('não faz nada quando a ficha já está na última versão', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })

    expect(await sheets.syncToLatestVersion(sheet.id)).toBeNull()
  })

  it('puxa a ficha para a versão nova mantendo o que o jogador preencheu', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })
    await sheets.patch(sheet.id, { values: { c_nome: 'Vaz' } }, 'player')

    // O mestre acrescenta um campo e publica a v2.
    const schema = createExampleSchema()
    const firstTab = schema.tabs[0]
    firstTab?.components.push({
      id: 'c_origem',
      type: 'text',
      key: 'origem',
      label: 'Origem',
      editableBy: 'player',
      visibleTo: 'all',
      layout: { x: 6, y: 20, w: 4, h: 2 }
    })
    await templates.saveDraft(templateId, schema)
    await templates.publish(templateId)

    const result = await sheets.syncToLatestVersion(sheet.id)

    expect(result?.fromVersion).toBe(1)
    expect(result?.toVersion).toBe(2)
    expect(result?.addedLabels).toEqual(['Origem'])
    expect(result?.sheet.values.c_nome).toBe('Vaz')
    expect(result?.sheet.values.c_origem).toBe('')

    // E ficou gravado: abrir de novo não repete o aviso.
    expect((await sheets.get(sheet.id))?.templateVersion).toBe(2)
    expect(await sheets.syncToLatestVersion(sheet.id)).toBeNull()
  })

  it('guarda o valor do campo que saiu do modelo', async () => {
    const templateId = await publishedTemplate()
    const sheet = await sheets.create({ templateId, ownerName: 'Thalysson' })
    await sheets.patch(sheet.id, { values: { c_nome: 'Vaz' } }, 'player')

    // A v2 perde a aba de perícias inteira.
    const schema = createExampleSchema()
    const removedCount = allComponents(schema).filter(
      (component) => component.type === 'table' && component.key === 'pericias'
    ).length
    schema.tabs = schema.tabs.filter((tab) => tab.id !== 'tab_pericias')
    await templates.saveDraft(templateId, schema)
    await templates.publish(templateId)

    const result = await sheets.syncToLatestVersion(sheet.id)

    expect(removedCount).toBe(1)
    expect(result?.orphanedCount).toBe(1)
    expect(result?.sheet.orphaned.c_pericias).toBeDefined()
    expect(result?.sheet.values.c_nome).toBe('Vaz')
  })
})

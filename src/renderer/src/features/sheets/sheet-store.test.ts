import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createLocalSheetRepository,
  createLocalTemplateRepository,
  isResourceValue,
  type SheetPatch,
  type SheetRecord,
  type SheetRepository,
  type TemplateRepository
} from '@/lib/sheet'
import { useSheetStore } from './sheet-store'

/**
 * O que está em jogo aqui é o salvamento campo a campo (5.7): a alteração aparece na hora,
 * vai para o repositório como um patch de um campo só, volta atrás se for recusada, e nunca
 * regrava a ficha inteira em cima do que outra pessoa gravou.
 */

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

let templates: TemplateRepository
let repository: SheetRepository
let sheetId: string

const store = (): ReturnType<typeof useSheetStore.getState> => useSheetStore.getState()

beforeEach(async () => {
  const storage = createMemoryStorage()
  templates = createLocalTemplateRepository(storage)
  repository = createLocalSheetRepository(templates, storage)

  const template = await templates.create({
    name: 'Exemplo d20',
    kind: 'character',
    schema: createExampleSchema()
  })
  await templates.publish(template.id)
  const sheet = await repository.create({ templateId: template.id, ownerName: 'Thalysson' })
  sheetId = sheet.id

  store().close()
  store().attach(repository)
  await store().open(sheetId)
})

afterEach(() => {
  store().close()
  vi.useRealTimers()
})

describe('abrir a ficha', () => {
  it('carrega ficha, esquema e primeira aba', () => {
    expect(store().loadState).toBe('ready')
    expect(store().sheet?.id).toBe(sheetId)
    expect(store().activeTabId).toBe('tab_personagem')
    expect(store().migration).toBeNull()
  })

  it('avisa quando a ficha não existe', async () => {
    await store().open('sheet_fantasma')
    expect(store().loadState).toBe('missing')
  })

  it('avisa quando o modelo da ficha foi excluído', async () => {
    const sheet = store().sheet as SheetRecord
    await templates.remove(sheet.templateId)

    await store().open(sheetId)
    expect(store().loadState).toBe('no-template')
  })
})

describe('editar um campo', () => {
  it('aparece na hora e fica pendente até gravar', () => {
    store().changeField('c_nome', 'Vaz')

    expect(store().sheet?.values.c_nome).toBe('Vaz')
    expect(store().saveState).toBe('dirty')
    expect(store().pending).toEqual({ c_nome: 'Vaz' })
  })

  it('grava sozinho depois de um instante', async () => {
    vi.useFakeTimers()
    store().changeField('c_nome', 'Vaz')

    await vi.advanceTimersByTimeAsync(500)

    expect(store().saveState).toBe('saved')
    expect(store().pending).toEqual({})
    expect((await repository.get(sheetId))?.values.c_nome).toBe('Vaz')
  })

  it('recalcula o resumo dos papéis na hora', () => {
    store().changeField('c_vida', { current: 4 })
    expect(store().sheet?.summary.bars.hp).toEqual({ current: 4, max: 10 })
  })

  it('ignora campo calculado e id que não existe', () => {
    store().changeField('c_defesa', 99)
    store().changeField('c_fantasma', 1)

    expect(store().pending).toEqual({})
    expect(store().saveState).toBe('idle')
  })

  it('junta as teclas numa gravação só', async () => {
    store().changeField('c_nome', 'V')
    store().changeField('c_nome', 'Va')
    store().changeField('c_nome', 'Vaz')

    expect(store().pending).toEqual({ c_nome: 'Vaz' })
    await store().flush()
    expect((await repository.get(sheetId))?.values.c_nome).toBe('Vaz')
  })
})

describe('recusa do repositório', () => {
  it('volta ao valor gravado e conta o motivo', async () => {
    store().setAudience('player')
    store().changeField('c_notas_mestre', 'espiando')

    // Otimista: o campo já mudou na tela.
    expect(store().sheet?.gmValues.c_notas_mestre).toBe('espiando')

    await store().flush()

    expect(store().saveState).toBe('error')
    expect(store().lastError).toContain('mestre')
    expect(store().sheet?.gmValues.c_notas_mestre).toBe('')
    expect((await repository.get(sheetId))?.gmValues.c_notas_mestre).toBe('')
  })

  it('o mestre grava o mesmo campo sem problema', async () => {
    store().setAudience('gm')
    store().changeField('c_notas_mestre', 'o prefeito mente')
    await store().flush()

    expect(store().saveState).toBe('saved')
    expect((await repository.get(sheetId))?.gmValues.c_notas_mestre).toBe('o prefeito mente')
  })
})

describe('duas pessoas na mesma ficha', () => {
  it('a gravação de um campo não desfaz a do outro', async () => {
    // O jogador começa a escrever o nome (ainda pendente na tela dele).
    store().changeField('c_nome', 'Vaz')

    // Nesse meio-tempo, o mestre aplica dano direto no repositório.
    await repository.patch(sheetId, { values: { c_vida: { current: 2 } } }, 'gm')

    await store().flush()

    const stored = await repository.get(sheetId)
    const vida = stored?.values.c_vida
    expect(stored?.values.c_nome).toBe('Vaz')
    expect(isResourceValue(vida) ? vida.current : -1).toBe(2)
    // E a tela recebeu o dano de volta, porque o repositório devolve a ficha inteira.
    expect(store().sheet?.summary.bars.hp).toEqual({ current: 2, max: 10 })
  })

  it('o que foi digitado durante a gravação não se perde', async () => {
    // Repositório que deixa a gravação travada, para editar no meio dela.
    let release: (() => void) | undefined
    const slow: SheetRepository = {
      ...repository,
      patch: async (id: string, patch: SheetPatch, audience) => {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return repository.patch(id, patch, audience)
      }
    }

    store().attach(slow)
    store().changeField('c_nome', 'Vaz')
    const flushing = store().flush()

    // Enquanto o primeiro patch está no ar, o jogador mexe noutro campo.
    store().changeField('c_nivel', 3)
    release?.()
    await flushing

    expect(store().sheet?.values.c_nome).toBe('Vaz')
    expect(store().sheet?.values.c_nivel).toBe(3)
    expect(store().saveState).toBe('dirty')

    store().attach(repository)
    await store().flush()

    const stored = await repository.get(sheetId)
    expect(stored?.values.c_nome).toBe('Vaz')
    expect(stored?.values.c_nivel).toBe(3)
  })
})

describe('migração ao abrir', () => {
  it('sobe de versão e avisa o que mudou', async () => {
    const sheet = store().sheet as SheetRecord
    const schema = createExampleSchema()
    schema.tabs[0]?.components.push({
      id: 'c_origem',
      type: 'text',
      key: 'origem',
      label: 'Origem',
      editableBy: 'player',
      visibleTo: 'all',
      layout: { x: 6, y: 20, w: 4, h: 2 }
    })

    await templates.saveDraft(sheet.templateId, schema)
    await templates.publish(sheet.templateId)

    await store().open(sheetId)

    expect(store().sheet?.templateVersion).toBe(2)
    expect(store().migration?.addedLabels).toEqual(['Origem'])

    store().dismissMigration()
    expect(store().migration).toBeNull()
  })
})

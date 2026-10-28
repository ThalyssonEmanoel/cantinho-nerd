import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addTab,
  createTemplate,
  type SheetSchema,
  type SheetTemplate,
  type TemplateRepository
} from '@/lib/sheet'
import { useBuilderStore } from './builder-store'

/**
 * Salvamento automático do construtor. Com o modelo na conta (Fase 4), salvar viaja pela
 * rede — e aí importam a ordem das gravações e o que acontece ao sair da tela no meio.
 */

function repositoryWith(
  saveDraft: (id: string, schema: SheetSchema) => Promise<void>
): TemplateRepository & { rename: ReturnType<typeof vi.fn> } {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(async () => {}),
    saveDraft: vi.fn(saveDraft),
    duplicate: vi.fn(),
    remove: vi.fn(),
    publish: vi.fn(),
    isInUse: vi.fn(async () => false)
  }
}

function loadTemplate(repository: TemplateRepository): SheetTemplate {
  const template = createTemplate({ name: 'Ordem', kind: 'character' })
  const store = useBuilderStore.getState()
  store.attach(repository)
  store.load(template)
  return template
}

const store = (): ReturnType<typeof useBuilderStore.getState> => useBuilderStore.getState()

const tabCount = (schema: SheetSchema): number => schema.tabs.length

afterEach(() => {
  store().reset()
})

describe('salvamento do rascunho', () => {
  it('sair da tela antes do salvamento automático não perde a última alteração', async () => {
    const saved: number[] = []
    const repository = repositoryWith(async (_id, schema) => {
      saved.push(tabCount(schema))
    })
    loadTemplate(repository)

    const schema = store().schema as SheetSchema
    store().commit(addTab(schema, 'Rituais').schema)

    // O que a tela faz ao desmontar: grava o pendente e limpa o estado na hora.
    const pending = store().flush()
    store().reset()
    await pending

    expect(saved).toEqual([2])
  })

  it('grava na ordem pedida, mesmo quando a primeira gravação demora mais', async () => {
    const saved: number[] = []
    let first = true
    const repository = repositoryWith(async (_id, schema) => {
      // A primeira gravação é a lenta: sem fila, a segunda chegaria antes e seria
      // sobrescrita pelo rascunho velho.
      const delay = first ? 30 : 0
      first = false
      await new Promise((resolve) => setTimeout(resolve, delay))
      saved.push(tabCount(schema))
    })
    loadTemplate(repository)

    store().commit(addTab(store().schema as SheetSchema, 'A').schema)
    const a = store().saveNow()
    store().commit(addTab(store().schema as SheetSchema, 'B').schema)
    const b = store().saveNow()
    await Promise.all([a, b])

    expect(saved).toEqual([2, 3])
    expect(store().saveState).toBe('saved')
  })

  it('nome apagado não vai para o banco; nome com espaços vai aparado', async () => {
    const repository = repositoryWith(async () => {})
    loadTemplate(repository)

    store().setName('   ')
    await store().saveNow()
    expect(repository.rename).not.toHaveBeenCalled()

    store().setName('  Ordem Paranormal  ')
    await store().saveNow()
    expect(repository.rename).toHaveBeenCalledWith(expect.any(String), 'Ordem Paranormal')

    // Depois de renomeado, salvar de novo não renomeia outra vez.
    await store().saveNow()
    expect(repository.rename).toHaveBeenCalledTimes(1)
  })

  it('falha ao gravar marca o erro', async () => {
    const repository = repositoryWith(async () => {
      throw new Error('sem rede')
    })
    loadTemplate(repository)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    store().commit(addTab(store().schema as SheetSchema, 'A').schema)
    await store().saveNow()
    expect(store().saveState).toBe('error')
  })
})

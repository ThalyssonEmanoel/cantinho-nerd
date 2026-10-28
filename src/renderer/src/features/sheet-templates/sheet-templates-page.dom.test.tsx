import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createLocalSheetRepository,
  createLocalTemplateRepository,
  EXAMPLE_TEMPLATE_NAME,
  type TemplateRepository
} from '@/lib/sheet'
import { buttonByText } from '@/test/dom-helpers'

/**
 * Biblioteca de modelos (5.1) com a conta no lugar do armazenamento local.
 *
 * A "conta" aqui é um repositório em memória, e os modelos "deste computador" ficam no
 * localStorage do jsdom — que é onde a Fase 2 os deixou de verdade.
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

const mocks = vi.hoisted(() => ({
  account: null as unknown as TemplateRepository,
  ensureExample: vi.fn(async () => {}),
  importTemplate: vi.fn(async () => '6f1c1d2e-0000-4000-8000-000000000099')
}))

vi.mock('./repository', () => ({
  get templateRepository() {
    return mocks.account
  },
  ensureExampleTemplate: mocks.ensureExample
}))

vi.mock('@/lib/db/sheet-templates', () => ({
  importTemplateWithVersions: mocks.importTemplate
}))

const { SheetTemplatesPage } = await import('./sheet-templates-page')

let root: Root
let container: HTMLElement

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function render(): Promise<void> {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter>
        <SheetTemplatesPage />
      </MemoryRouter>
    )
  })
  await flush()
}

beforeEach(async () => {
  localStorage.clear()
  mocks.account = createLocalTemplateRepository(createMemoryStorage())
  await mocks.account.create({ name: 'Ordem na nuvem', kind: 'character' })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('SheetTemplatesPage', () => {
  it('lista os modelos da conta e garante o exemplo', async () => {
    await render()
    expect(mocks.ensureExample).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Ordem na nuvem')
    expect(container.textContent).toContain('Guia de fórmulas')
  })

  it('oferece enviar os modelos deste computador e religa as fichas locais', async () => {
    const local = createLocalTemplateRepository(localStorage)
    const old = await local.create({
      name: 'D&D caseiro',
      kind: 'character',
      schema: createExampleSchema()
    })
    await local.publish(old.id)
    const sheets = createLocalSheetRepository(local, localStorage)
    const sheet = await sheets.create({ templateId: old.id, ownerName: 'Thalysson' })

    await render()
    expect(container.textContent).toContain('Há 1 modelo salvo só neste computador')
    expect(container.textContent).toContain('D&D caseiro')

    await act(async () => {
      buttonByText(container, 'Enviar para a conta').click()
    })
    await flush()

    // Subiu com as versões (a ficha está presa à v1)…
    expect(mocks.importTemplate).toHaveBeenCalledTimes(1)
    const [sent] = mocks.importTemplate.mock.calls[0] as unknown as [
      { name: string; versions: unknown[] }
    ]
    expect(sent.name).toBe('D&D caseiro')
    expect(sent.versions).toHaveLength(1)

    // …saiu do armazenamento local, e a ficha antiga aponta para o id novo.
    expect(await local.list()).toEqual([])
    expect((await sheets.get(sheet.id))?.templateId).toBe('6f1c1d2e-0000-4000-8000-000000000099')
    expect(container.textContent).not.toContain('só neste computador')
  })

  it('não oferece nada quando só existe o exemplo intocado', async () => {
    await createLocalTemplateRepository(localStorage).create({
      name: EXAMPLE_TEMPLATE_NAME,
      kind: 'character',
      schema: createExampleSchema()
    })
    await render()
    expect(container.textContent).not.toContain('só neste computador')
  })
})

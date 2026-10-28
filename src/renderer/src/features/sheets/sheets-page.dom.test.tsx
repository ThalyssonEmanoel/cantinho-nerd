import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createLocalSheetRepository,
  createLocalTemplateRepository,
  type SheetRepository,
  type TemplateRepository
} from '@/lib/sheet'

/**
 * Montagem da lista de fichas.
 *
 * O estado vazio importa tanto quanto a lista cheia: sem modelo publicado não há como
 * criar ficha, e a tela precisa dizer isso em vez de mostrar um botão que não funciona.
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

vi.mock('./repository', () => ({
  get sheetRepository() {
    return repository
  }
}))

vi.mock('@/features/sheet-templates/repository', () => ({
  get templateRepository() {
    return templates
  }
}))

const { SheetsPage } = await import('./sheets-page')

let container: HTMLElement
let unmount: () => void

beforeEach(() => {
  const storage = createMemoryStorage()
  templates = createLocalTemplateRepository(storage)
  repository = createLocalSheetRepository(templates, storage)

  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => unmount())
  container.remove()
})

async function renderPage(): Promise<void> {
  const root = createRoot(container)
  unmount = () => root.unmount()

  await act(async () => {
    root.render(
      <MemoryRouter>
        <SheetsPage />
      </MemoryRouter>
    )
  })
}

async function publishedTemplate(): Promise<string> {
  const template = await templates.create({
    name: 'Exemplo d20',
    kind: 'character',
    schema: createExampleSchema()
  })
  await templates.publish(template.id)
  return template.id
}

describe('SheetsPage', () => {
  it('explica o que falta quando nenhum modelo está publicado', async () => {
    await templates.create({
      name: 'Só rascunho',
      kind: 'character',
      schema: createExampleSchema()
    })

    await renderPage()

    expect(container.textContent).toContain('Nenhum modelo publicado')
    const newSheet = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Nova ficha')
    )
    expect(newSheet?.disabled).toBe(true)
  })

  it('mostra o estado vazio com modelo publicado disponível', async () => {
    await publishedTemplate()
    await renderPage()

    expect(container.textContent).toContain('Nenhuma ficha ainda')
    const newSheet = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Nova ficha')
    )
    expect(newSheet?.disabled).toBe(false)
  })

  it('lista a ficha com dono, modelo e vida', async () => {
    const templateId = await publishedTemplate()
    const sheet = await repository.create({ templateId, ownerName: 'Thalysson' })
    await repository.patch(sheet.id, { values: { c_nome: 'Vaz' } }, 'player')

    await renderPage()
    const text = container.textContent ?? ''

    expect(text).toContain('Vaz')
    expect(text).toContain('Thalysson')
    expect(text).toContain('Exemplo d20 v1')
    expect(text).toContain('10 / 10')
  })
})

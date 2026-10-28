import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createTemplate,
  type SheetTemplate,
  type TemplateRepository
} from '@/lib/sheet'
import { byLabel, typeInto } from '@/test/dom-helpers'

/**
 * Montagem da tela do construtor.
 *
 * O repositório é dublado para o teste não depender do localStorage: o que está em jogo
 * aqui é a tela subir inteira (barra, paleta, abas, grade e propriedades) sem quebrar.
 */

const template: SheetTemplate = {
  ...createTemplate({ name: 'Exemplo d20', kind: 'character', schema: createExampleSchema() }),
  id: 'tpl_teste'
}

const repository: TemplateRepository = {
  list: vi.fn(async () => []),
  get: vi.fn(async () => template),
  create: vi.fn(async () => template),
  rename: vi.fn(async () => {}),
  saveDraft: vi.fn(async () => {}),
  duplicate: vi.fn(async () => template),
  remove: vi.fn(async () => {}),
  publish: vi.fn(async () => 1),
  isInUse: vi.fn(async () => false)
}

vi.mock('@/features/sheet-templates/repository', () => ({
  get templateRepository() {
    return repository
  }
}))

const { SheetBuilderPage } = await import('./sheet-builder-page')
const { useBuilderStore } = await import('./builder-store')

let container: HTMLElement
let unmount: () => void

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => unmount())
  container.remove()
  vi.clearAllMocks()
})

async function renderPage(): Promise<void> {
  const root = createRoot(container)
  unmount = () => root.unmount()

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/templates/tpl_teste']}>
        <Routes>
          <Route path="/templates/:templateId" element={<SheetBuilderPage />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

describe('SheetBuilderPage', () => {
  it('monta com paleta, abas, grade e barra de ações', async () => {
    await renderPage()
    const text = container.textContent ?? ''

    // Barra superior (5.2)
    expect(text).toContain('Ver como jogador')
    expect(text).toContain('Validar')
    expect(text).toContain('Publicar')
    expect(text).toContain('Exportar')

    // Paleta com os 13 componentes
    expect(text).toContain('Botão de rolagem')
    expect(text).toContain('Campo calculado')

    // Abas do modelo de exemplo
    expect(text).toContain('Personagem')
    expect(text).toContain('Perícias')

    // Grade montada com os componentes da aba
    expect(container.querySelectorAll('.react-grid-item').length).toBeGreaterThan(5)

    // Painel de propriedades no estado vazio
    expect(text).toContain('Nada selecionado')
  })

  it('carrega o modelo pelo id da rota', async () => {
    await renderPage()
    expect(repository.get).toHaveBeenCalledWith('tpl_teste')
  })

  it('avisa quando o modelo não existe', async () => {
    vi.mocked(repository.get).mockResolvedValueOnce(null)
    await renderPage()
    expect(container.textContent).toContain('não existe mais')
  })

  it('digitar no Rótulo não tira o foco, mesmo com a chave acompanhando', async () => {
    await renderPage()
    act(() => useBuilderStore.getState().select('c_forca'))

    const label = byLabel<HTMLInputElement>(container, 'Rótulo')
    act(() => label.focus())

    // Cada letra muda a chave (forca → forcas → forcass). Antes da correção, isso remontava
    // o painel inteiro e o campo saía da tela a cada tecla.
    typeInto(label, 'Forças')
    typeInto(label, 'Forçass')

    expect(label.isConnected).toBe(true)
    expect(document.activeElement).toBe(label)
    expect(label.value).toBe('Forçass')
    expect(byLabel<HTMLInputElement>(container, 'Chave').value).toBe('forcass')
  })
})

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExampleSchema,
  createLocalSheetRepository,
  createLocalTemplateRepository,
  isResourceValue,
  type SheetRepository,
  type TemplateRepository
} from '@/lib/sheet'

/**
 * Montagem da ficha preenchível.
 *
 * Aqui o que se prova é o caminho completo de uma alteração: clicar num botão da barra de
 * vida precisa virar patch no repositório e barra nova no resumo. É o teste que pegaria uma
 * biblioteca quebrando no React 19 ou uma ponta solta entre tela, store e repositório.
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

const { SheetFillPage } = await import('./sheet-fill-page')
const { useSheetStore } = await import('./sheet-store')

let container: HTMLElement
let unmount: () => void
let sheetId: string

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
  sheetId = (await repository.create({ templateId: template.id, ownerName: 'Thalysson' })).id

  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => unmount())
  container.remove()
  useSheetStore.getState().close()
})

async function renderPage(): Promise<void> {
  const root = createRoot(container)
  unmount = () => root.unmount()

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/sheets/${sheetId}`]}>
        <Routes>
          <Route path="/sheets/:sheetId" element={<SheetFillPage />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

function buttonWith(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((button) =>
    (button.textContent ?? '').includes(text)
  )
  if (found === undefined) throw new Error(`Botão "${text}" não encontrado`)
  return found
}

function byLabel(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  if (found === null) throw new Error(`Elemento "${label}" não encontrado`)
  return found
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('SheetFillPage', () => {
  it('monta a ficha com abas, barra e indicador de salvamento', async () => {
    await renderPage()
    const text = container.textContent ?? ''

    expect(text).toContain('Exemplo d20')
    expect(text).toContain('Thalysson')
    expect(text).toContain('Personagem')
    expect(text).toContain('Perícias')
    expect(text).toContain('Vida')
    expect(text).toContain('Rolagens')
    expect(text).not.toContain('#ERRO')
  })

  it('o jogador não recebe o campo só do mestre, e o mestre recebe', async () => {
    await renderPage()
    expect(container.textContent).not.toContain('Anotações do mestre')

    await click(buttonWith('Mestre'))
    expect(container.textContent).toContain('Anotações do mestre')
  })

  it('mexer na barra de vida grava só aquele campo', async () => {
    await renderPage()

    await click(byLabel('Diminuir'))
    await act(async () => {
      await useSheetStore.getState().flush()
    })

    const stored = await repository.get(sheetId)
    const vida = stored?.values.c_vida
    expect(isResourceValue(vida) ? vida.current : -1).toBe(9)
    expect(stored?.summary.bars.hp).toEqual({ current: 9, max: 10 })
    expect(container.textContent).toContain('Salvo')
  })

  it('o botão de rolagem joga o resultado no painel', async () => {
    await renderPage()
    expect(container.textContent).toContain('As rolagens aparecem aqui')

    await click(buttonWith('Rolar'))

    expect(container.textContent).toContain('Iniciativa')
    expect(container.textContent).not.toContain('As rolagens aparecem aqui')
  })

  it('a rolagem de uma perícia leva o nome da linha', async () => {
    await renderPage()
    await click(buttonWith('Perícias'))

    const skillButtons = [...container.querySelectorAll('button')].filter((button) =>
      (button.textContent ?? '').includes('Rolar')
    )
    // Uma por linha fixa da tabela de perícias.
    expect(skillButtons.length).toBe(5)

    await click(skillButtons[2] as HTMLElement)

    // O rótulo é lido dentro da entrada do painel, senão a própria tabela já diria
    // "Furtividade" e o teste passaria sem rolar nada.
    const entry = container.querySelector('code')?.closest('div.rounded-md')
    expect(entry?.textContent).toContain('Furtividade')
    expect(entry?.textContent).toContain('1d20')
  })

  it('escrever o nome atualiza o cabeçalho da ficha', async () => {
    await renderPage()
    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="Nome do personagem"]'
    )
    expect(input).not.toBeNull()

    await act(async () => {
      setInputValue(input as HTMLInputElement, 'Vaz')
    })

    expect(container.textContent).toContain('Vaz')
    expect(container.textContent).not.toContain('Personagem sem nome')
  })
})

/** Digitar num campo controlado do React exige mexer no setter nativo. */
function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

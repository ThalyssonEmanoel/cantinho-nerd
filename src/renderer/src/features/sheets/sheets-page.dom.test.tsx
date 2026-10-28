import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SheetRepository, SheetSummaryRow } from '@/lib/sheet'

/**
 * Lista de fichas (Fase 5): os personagens das mesas em que a pessoa está. Abrir uma ficha
 * leva para dentro da sessão dela, onde o tempo real funciona.
 */

const sheets: SheetSummaryRow[] = [
  {
    id: 'ficha-1',
    templateId: 't',
    templateName: 'Ordem',
    templateVersion: 2,
    ownerName: 'Bruno',
    ownerId: 'bruno',
    name: 'Lia Vaz',
    bars: { hp: { current: 7, max: 16 } },
    updatedAt: '2026-10-29T10:00:00Z',
    sessionId: 'sessao-1',
    sessionName: 'Mesa de sexta'
  }
]

const repository = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('./repository', () => ({
  get sheetRepository() {
    return repository as unknown as SheetRepository
  }
}))

vi.mock('@/lib/db/auth', () => ({ onAuthChange: () => () => {} }))
vi.mock('@/lib/db/profiles', () => ({ fetchProfile: vi.fn() }))

const { SheetsPage } = await import('./sheets-page')
const { useAuthStore } = await import('@/stores/auth-store')

let root: Root
let container: HTMLElement

async function render(): Promise<void> {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/sheets']}>
        <Routes>
          <Route path="/sheets" element={<SheetsPage />} />
          <Route path="/session/:sessionId/sheets/:sheetId" element={<p>ficha dentro da mesa</p>} />
        </Routes>
      </MemoryRouter>
    )
  })
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('SheetsPage', () => {
  it('lista os personagens com a mesa de cada um', async () => {
    useAuthStore.setState({ userId: 'ana' })
    repository.list.mockResolvedValueOnce(sheets)
    await render()

    const text = container.textContent ?? ''
    expect(text).toContain('Lia Vaz')
    expect(text).toContain('Bruno')
    expect(text).toContain('Mesa de sexta')
    expect(text).toContain('7 / 16')
  })

  it('o próprio personagem aparece como seu', async () => {
    useAuthStore.setState({ userId: 'bruno' })
    repository.list.mockResolvedValueOnce(sheets)
    await render()
    expect(container.textContent).toContain('Seu personagem')
  })

  it('abrir leva para a ficha dentro da sessão', async () => {
    repository.list.mockResolvedValueOnce(sheets)
    await render()

    const open = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Lia Vaz')
    )
    await act(async () => open?.click())
    expect(container.textContent).toContain('ficha dentro da mesa')
  })

  it('sem fichas, explica que o personagem nasce dentro da mesa', async () => {
    repository.list.mockResolvedValueOnce([])
    await render()
    expect(container.textContent).toContain('criado dentro de uma mesa')
  })
})

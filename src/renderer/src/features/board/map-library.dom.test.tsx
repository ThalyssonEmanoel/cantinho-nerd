import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap } from '@/lib/board'

/**
 * Biblioteca de mapas do mestre (6.1): ativar é para a mesa, abrir é só para ele.
 */

const db = vi.hoisted(() => ({
  listMaps: vi.fn(),
  renameMap: vi.fn(),
  deleteMap: vi.fn(),
  reorderMaps: vi.fn(),
  setActiveMap: vi.fn(),
  listTokens: vi.fn(),
  moveToken: vi.fn()
}))

vi.mock('@/lib/db/maps', () => ({
  listMaps: db.listMaps,
  renameMap: db.renameMap,
  deleteMap: db.deleteMap,
  reorderMaps: db.reorderMaps
}))
vi.mock('@/lib/db/tokens', () => ({ listTokens: db.listTokens, moveToken: db.moveToken }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))
vi.mock('@/lib/db/sessions', () => ({ setActiveMap: db.setActiveMap }))
vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ reload: async () => undefined }) }
}))
vi.mock('./board-actions', () => ({ addMapFromFile: vi.fn() }))

const { MapLibrary } = await import('./map-library')
const { useBoardStore } = await import('./board-store')

const taverna: BoardMap = {
  id: 'mapa-1',
  sessionId: 'mesa',
  name: 'Taverna',
  imagePath: 'sessions/mesa/maps/a.webp',
  width: 2000,
  height: 1500,
  grid: DEFAULT_GRID,
  sortOrder: 0
}

const cripta: BoardMap = { ...taverna, id: 'mapa-2', name: 'Cripta', sortOrder: 1 }

let container: HTMLElement
let root: Root

beforeEach(() => {
  db.listMaps.mockResolvedValue([taverna, cripta])
  db.listTokens.mockResolvedValue([])
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

async function render(maps: BoardMap[], activeMapId: string | null): Promise<void> {
  useBoardStore.setState({ sessionId: 'mesa', maps, activeMapId, openMapId: activeMapId })
  root = createRoot(container)
  await act(async () => {
    root.render(<MapLibrary />)
  })
}

function buttonsLabeled(label: string): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>(`[aria-label="${label}"]`)]
}

describe('MapLibrary', () => {
  it('lista os mapas com o tamanho de cada um', async () => {
    await render([taverna, cripta], 'mapa-1')
    const text = container.textContent ?? ''

    expect(text).toContain('Taverna')
    expect(text).toContain('2000 × 1500')
    expect(text).toContain('Cripta')
  })

  it('o mapa ativo aparece como ativo; os outros, com botão de ativar', async () => {
    await render([taverna, cripta], 'mapa-1')

    expect(container.textContent).toContain('ativo')
    expect(buttonsLabeled('Ativar para a mesa')).toHaveLength(1)
  })

  it('ativar manda para o banco', async () => {
    await render([taverna, cripta], 'mapa-1')

    await act(async () => {
      buttonsLabeled('Ativar para a mesa')[0]?.click()
    })

    expect(db.setActiveMap).toHaveBeenCalledWith('mesa', 'mapa-2')
  })

  it('abrir sem ativar só muda a tela do mestre', async () => {
    await render([taverna, cripta], 'mapa-1')

    await act(async () => {
      buttonsLabeled('Abrir só para mim')[0]?.click()
    })

    expect(useBoardStore.getState().openMapId).toBe('mapa-2')
    expect(useBoardStore.getState().activeMapId).toBe('mapa-1')
    expect(db.setActiveMap).not.toHaveBeenCalled()
  })

  it('com um mapa só, não há alça de reordenar', async () => {
    await render([taverna], 'mapa-1')
    expect(buttonsLabeled('Reordenar mapa')).toHaveLength(0)
  })

  it('com dois, cada um tem alça', async () => {
    await render([taverna, cripta], 'mapa-1')
    expect(buttonsLabeled('Reordenar mapa')).toHaveLength(2)
  })

  it('sem mapa, explica o que fazer', async () => {
    await render([], null)
    expect(container.textContent).toContain('Nenhum mapa ainda')
  })
})

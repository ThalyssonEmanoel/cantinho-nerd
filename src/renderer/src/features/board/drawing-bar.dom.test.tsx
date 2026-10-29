import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Drawing } from '@/lib/board'
import { buttonByText, byLabel, click } from '@/test/dom-helpers'

/**
 * A barra do desenho (6.5) e o menu do token com as reações (6.3).
 */

const actions = vi.hoisted(() => ({
  clearAllDrawings: vi.fn(async () => {}),
  clearMyDrawings: vi.fn(async () => {}),
  undoLastDrawing: vi.fn(async () => true)
}))

vi.mock('./drawing-actions', () => actions)
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))

const { DrawingBar } = await import('./drawing-bar')
const { BoardMenu } = await import('./board-menu')
const { useBoardStore } = await import('./board-store')

function drawing(id: string, authorId: string): Drawing {
  return {
    id,
    sessionId: 'mesa',
    mapId: 'mapa-1',
    authorId,
    tool: 'line',
    points: [0, 0, 10, 10],
    color: '#ef4444',
    width: 4,
    createdAt: ''
  }
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useBoardStore.setState({ openMapId: 'mapa-1', drawings: [], tool: 'draw', drawTool: 'pencil' })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

function render(element: React.JSX.Element): void {
  act(() => root.render(element))
}

describe('DrawingBar', () => {
  it('não aparece com a seleção na mão', () => {
    useBoardStore.setState({ tool: 'select' })
    render(<DrawingBar role="player" userId="ana" />)
    expect(container.textContent).toBe('')
  })

  it('a régua explica como medir', () => {
    useBoardStore.setState({ tool: 'ruler' })
    render(<DrawingBar role="player" userId="ana" />)
    expect(container.textContent).toContain('Shift')
    expect(container.textContent).toContain('Todos veem a medição')
  })

  it('escolher a forma troca a ferramenta do traço', () => {
    render(<DrawingBar role="player" userId="ana" />)
    click(byLabel(container, 'Círculo'))
    expect(useBoardStore.getState().drawTool).toBe('circle')
    expect(byLabel(container, 'Círculo').getAttribute('aria-pressed')).toBe('true')

    click(byLabel(container, 'Espessura grossa'))
    expect(useBoardStore.getState().strokeLevel).toBe(2)
  })

  it('sem traço meu, não há o que desfazer nem apagar', () => {
    useBoardStore.setState({ drawings: [drawing('d1', 'mestre')] })
    render(<DrawingBar role="player" userId="ana" />)
    expect(buttonByText(container, 'Desfazer').disabled).toBe(true)
    expect(buttonByText(container, 'Apagar meus desenhos').disabled).toBe(true)
  })

  it('"limpar todos" é só do mestre', () => {
    useBoardStore.setState({ drawings: [drawing('d1', 'ana')] })
    render(<DrawingBar role="player" userId="ana" />)
    expect(container.textContent).not.toContain('Limpar todos')

    render(<DrawingBar role="gm" userId="mestre" />)
    expect(container.textContent).toContain('Limpar todos')
  })

  it('apagar os meus pede confirmação antes', async () => {
    useBoardStore.setState({ drawings: [drawing('d1', 'ana')] })
    render(<DrawingBar role="player" userId="ana" />)

    click(buttonByText(container, 'Apagar meus desenhos'))
    expect(actions.clearMyDrawings).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Apagar os seus desenhos?')

    await act(async () => {
      click(buttonByText(document.body, 'Apagar os meus'))
    })
    expect(actions.clearMyDrawings).toHaveBeenCalledWith('ana')
  })

  it('o botão Desfazer desfaz o meu último traço', () => {
    useBoardStore.setState({ drawings: [drawing('d1', 'ana')] })
    render(<DrawingBar role="player" userId="ana" />)
    click(buttonByText(container, 'Desfazer'))
    expect(actions.undoLastDrawing).toHaveBeenCalledWith('ana')
  })

  it('com a borracha, o jogador é avisado de que apaga só os seus', () => {
    useBoardStore.setState({ tool: 'erase' })
    render(<DrawingBar role="player" userId="ana" />)
    expect(container.textContent).toContain('Você apaga só os seus')
  })
})

describe('menu do token com reações', () => {
  it('os oito emojis em cima; escolher um reage e fecha o menu', () => {
    const onReact = vi.fn()
    const onClose = vi.fn()
    render(<BoardMenu at={{ x: 10, y: 10 }} items={[]} onReact={onReact} onClose={onClose} />)

    const group = byLabel(container, 'Reagir')
    expect(group.querySelectorAll('button')).toHaveLength(8)

    click(byLabel(container, 'Reagir com ⚔️'))
    expect(onReact).toHaveBeenCalledWith('⚔️')
    expect(onClose).toHaveBeenCalled()
  })

  it('o menu do mapa não tem reações', () => {
    render(<BoardMenu at={{ x: 10, y: 10 }} items={[]} onClose={() => {}} />)
    expect(container.querySelector('[aria-label="Reagir"]')).toBeNull()
  })
})

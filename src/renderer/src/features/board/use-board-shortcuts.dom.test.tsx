import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap, type BoardToken } from '@/lib/board'

/**
 * Atalhos de teclado da mesa (Fase 13).
 *
 * O que `lib/board/shortcuts` decide já tem teste puro; aqui se confere a outra metade:
 * que a tecla chega no lugar certo (ferramenta, zoom, excluir, chat, turno) e que o
 * tabuleiro **não** reage quando a ficha está na frente.
 */

// As ações devolvem promessa: o gancho encadeia `.catch` nelas.
const actions = vi.hoisted(() => ({
  removeTokens: vi.fn(async () => 1),
  undoLastDrawing: vi.fn(async () => undefined),
  nextTurn: vi.fn(async () => undefined),
  endMyTurn: vi.fn(async () => undefined)
}))

vi.mock('./board-actions', () => ({ removeTokens: actions.removeTokens }))
vi.mock('./drawing-actions', () => ({ undoLastDrawing: actions.undoLastDrawing }))
vi.mock('@/features/combat/combat-actions', () => ({
  nextTurn: actions.nextTurn,
  endMyTurn: actions.endMyTurn
}))
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: vi.fn(async () => []) }))

const { useBoardShortcuts } = await import('./use-board-shortcuts')
const { useBoardStore } = await import('./board-store')
const { useChatStore } = await import('@/features/chat/chat-store')
const { useCombatStore } = await import('@/features/combat/combat-store')
const { useLiveStore } = await import('./live-store')

const map: BoardMap = {
  id: 'mapa-1',
  sessionId: 'mesa',
  name: 'Taverna',
  imagePath: 'sessions/mesa/maps/a.webp',
  width: 1000,
  height: 800,
  grid: { ...DEFAULT_GRID, size: 50 },
  fog: { enabled: false, shapes: [] },
  sortOrder: 0
}

function token(partial: Partial<BoardToken> & { id: string }): BoardToken {
  return {
    sessionId: 'mesa',
    mapId: 'mapa-1',
    sheetId: null,
    kind: 'monster',
    ownerId: 'mestre',
    name: 'Goblin',
    imagePath: null,
    crop: { zoom: 1, offsetX: 0, offsetY: 0 },
    x: 0,
    y: 0,
    size: 1,
    z: 0,
    hidden: false,
    showName: true,
    showBars: true,
    visionM: null,
    bars: {},
    conditions: [],
    ...partial
  }
}

interface HostProps {
  onBoard?: boolean
  role?: 'gm' | 'player'
  userId?: string
}

function Host({ onBoard = true, role = 'gm', userId = 'mestre' }: HostProps): React.JSX.Element {
  useBoardShortcuts({ role, userId, onBoard })
  return <input aria-label="campo" />
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  useBoardStore.setState({
    sessionId: 'mesa',
    maps: [map],
    openMapId: 'mapa-1',
    activeMapId: 'mapa-1',
    tokens: [],
    selection: [],
    viewport: { width: 800, height: 600 },
    cameras: { 'mapa-1': { x: 0, y: 0, scale: 1 } },
    tool: 'select'
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useBoardStore.getState().close()
  useLiveStore.getState().reset()
  vi.clearAllMocks()
})

async function mount(props: HostProps = {}): Promise<void> {
  root = createRoot(container)
  await act(async () => {
    root.render(<Host {...props} />)
  })
}

async function press(
  key: string,
  options: { target?: EventTarget; ctrlKey?: boolean } = {}
): Promise<void> {
  await act(async () => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey ?? false,
      bubbles: true,
      cancelable: true
    })
    ;(options.target ?? window).dispatchEvent(event)
  })
}

describe('atalhos no tabuleiro', () => {
  it('as letras trocam a ferramenta', async () => {
    await mount()

    await press('h')
    expect(useBoardStore.getState().tool).toBe('pan')

    await press('r')
    expect(useBoardStore.getState().tool).toBe('ruler')

    await press('d')
    expect(useBoardStore.getState().tool).toBe('draw')

    await press('e')
    expect(useBoardStore.getState().tool).toBe('erase')

    await press('v')
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('mais e menos mexem no zoom; F faz caber', async () => {
    await mount()
    const scaleOf = (): number => useBoardStore.getState().cameras['mapa-1']?.scale ?? 0

    await press('+')
    expect(scaleOf()).toBeGreaterThan(1)

    await press('-')
    expect(scaleOf()).toBeCloseTo(1, 5)

    await press('f')
    // Caber na tela afasta: o mapa é maior que a janela do teste.
    expect(scaleOf()).toBeLessThan(1)
  })

  it('Del exclui o que está selecionado', async () => {
    useBoardStore.setState({ tokens: [token({ id: 't1' })], selection: ['t1'] })
    await mount()

    await press('Delete')
    expect(actions.removeTokens).toHaveBeenCalledTimes(1)
  })

  it('o jogador não exclui token que não é dele', async () => {
    useBoardStore.setState({
      tokens: [token({ id: 't1', ownerId: 'mestre' })],
      selection: ['t1']
    })
    await mount({ role: 'player', userId: 'ana' })

    await press('Delete')
    expect(actions.removeTokens).not.toHaveBeenCalled()
  })

  it('Esc larga a seleção, a régua e o traço começado', async () => {
    useBoardStore.setState({ tokens: [token({ id: 't1' })], selection: ['t1'] })
    useLiveStore.getState().setMyRuler({ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } })
    await mount()

    await press('Escape')

    expect(useBoardStore.getState().selection).toEqual([])
    expect(useLiveStore.getState().myRuler).toBeNull()
  })

  it('Ctrl+Z desfaz o meu último traço', async () => {
    await mount()
    await press('z', { ctrlKey: true })
    expect(actions.undoLastDrawing).toHaveBeenCalledWith('mestre')
  })
})

describe('atalhos da mesa inteira', () => {
  it('Enter pede o foco do chat', async () => {
    const before = useChatStore.getState().focusRequest
    await mount()

    await press('Enter')
    expect(useChatStore.getState().focusRequest).toBe(before + 1)
  })

  it('N passa o turno do mestre', async () => {
    useCombatStore.setState({ state: { ...useCombatStore.getState().state, active: true } })
    await mount()

    await press('n')
    expect(actions.nextTurn).toHaveBeenCalled()
  })

  it('sem combate, N não faz nada', async () => {
    useCombatStore.setState({ state: { ...useCombatStore.getState().state, active: false } })
    await mount()

    await press('n')
    expect(actions.nextTurn).not.toHaveBeenCalled()
  })

  it('Enter e N valem também fora do tabuleiro (na ficha)', async () => {
    const before = useChatStore.getState().focusRequest
    await mount({ onBoard: false })

    await press('Enter')
    expect(useChatStore.getState().focusRequest).toBe(before + 1)
  })

  it('fora do tabuleiro, as teclas dele não valem', async () => {
    useBoardStore.setState({ tokens: [token({ id: 't1' })], selection: ['t1'] })
    await mount({ onBoard: false })

    await press('h')
    await press('Delete')

    expect(useBoardStore.getState().tool).toBe('select')
    expect(actions.removeTokens).not.toHaveBeenCalled()
  })
})

describe('quando o atalho não deve valer', () => {
  it('digitando num campo, a letra é letra', async () => {
    await mount()
    const field = container.querySelector('input') as HTMLInputElement

    await press('h', { target: field })
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('com uma janela aberta, o tabuleiro não reage', async () => {
    await mount()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)

    await press('h')
    expect(useBoardStore.getState().tool).toBe('select')

    dialog.remove()
  })
})

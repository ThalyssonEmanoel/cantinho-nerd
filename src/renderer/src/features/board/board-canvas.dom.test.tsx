import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Konva from 'konva'
import { DEFAULT_GRID, type BoardMap, type BoardToken } from '@/lib/board'

/**
 * Montagem do tabuleiro.
 *
 * É a rede de proteção contra a react-konva quebrar com o React 19 — foi exatamente esse
 * tipo de quebra (a react-draggable e o `findDOMNode`) que apareceu na Fase 2 e só daria
 * para notar abrindo o app. Aqui a árvore do Konva é montada de verdade e contada.
 */

const db = vi.hoisted(() => ({ listMaps: vi.fn(), listTokens: vi.fn(), moveToken: vi.fn() }))

vi.mock('@/lib/db/maps', () => ({ listMaps: db.listMaps }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: db.listTokens, moveToken: db.moveToken }))
// O tabuleiro não baixa imagem nestes testes: só a geometria importa.
vi.mock('@/lib/db/assets', () => ({ assetUrl: () => new Promise(() => {}) }))

const { BoardCanvas } = await import('./board-canvas')
const { useBoardStore } = await import('./board-store')

const grid = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }

const map: BoardMap = {
  id: 'mapa-1',
  sessionId: 'mesa',
  name: 'Taverna',
  imagePath: 'sessions/mesa/maps/a.webp',
  width: 1000,
  height: 800,
  grid,
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
    x: 100,
    y: 100,
    size: 1,
    z: 0,
    hidden: false,
    showName: true,
    showBars: true,
    visionM: null,
    bars: {},
    ...partial
  }
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  db.listMaps.mockResolvedValue([map])
  db.listTokens.mockResolvedValue([])

  // O jsdom não faz layout: sem isto, todo elemento mede 0 e o Stage não sobe.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { value: 600, configurable: true })

  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

/** O tabuleiro desenha o que está no store: aqui ele é posto à mão. */
function prepareStore(tokens: BoardToken[] = []): void {
  useBoardStore.setState({
    sessionId: 'mesa',
    maps: [map],
    openMapId: 'mapa-1',
    activeMapId: 'mapa-1',
    tokens
  })
}

async function render(
  role: 'gm' | 'player' = 'gm',
  userId = 'mestre',
  board: BoardMap = map
): Promise<void> {
  root = createRoot(container)
  await act(async () => {
    root.render(
      <BoardCanvas
        map={board}
        role={role}
        userId={userId}
        onOpenToken={() => {}}
        onTokenMenu={() => {}}
        onBoardMenu={() => {}}
      />
    )
  })
}

function stage(): Konva.Stage {
  const found = Konva.stages.at(-1)
  if (found === undefined) throw new Error('o Stage do Konva não subiu')
  return found
}

describe('BoardCanvas', () => {
  it('monta o Stage do Konva com o tamanho do container', async () => {
    prepareStore()
    await render()

    expect(container.querySelector('canvas')).not.toBeNull()
    expect(stage().width()).toBe(800)
    expect(stage().height()).toBe(600)
  })

  it('a câmera começa com o mapa inteiro à vista', async () => {
    prepareStore()
    await render()
    const camera = useBoardStore.getState().cameras['mapa-1']

    expect(camera).toBeDefined()
    expect((camera?.scale ?? 1) * map.width).toBeLessThanOrEqual(800)
  })

  it('desenha um token por linha da lista, com nome e barras', async () => {
    prepareStore([
      token({ id: 't1', name: 'Goblin', bars: { hp: { current: 5, max: 10 } } }),
      token({ id: 't2', name: 'Lobo', x: 300 })
    ])
    await render()

    // Cada token é um Group com o nome dentro.
    const texts = stage().find('Text')
    expect(texts.map((node) => (node as Konva.Text).text()).sort()).toEqual(['Goblin', 'Lobo'])

    // A barra de vida do primeiro: fundo + preenchimento.
    expect(stage().find('Rect').length).toBeGreaterThanOrEqual(3)
  })

  it('o jogador arrasta só o próprio token (6.3)', async () => {
    prepareStore([
      token({ id: 'meu', ownerId: 'ana', kind: 'player', x: 100 }),
      token({ id: 'do-mestre', ownerId: 'mestre', x: 300 })
    ])
    await render('player', 'ana')

    const draggable = stage()
      .find('Group')
      .filter((node) => node.draggable())
    expect(draggable).toHaveLength(1)
    expect(draggable[0]?.x()).toBe(100)
  })

  it('o mestre arrasta todos', async () => {
    prepareStore([
      token({ id: 'meu', ownerId: 'ana', kind: 'player', x: 100 }),
      token({ id: 'do-mestre', ownerId: 'mestre', x: 300 })
    ])
    await render('gm', 'mestre')

    expect(stage().find('Group').filter((node) => node.draggable())).toHaveLength(2)
  })

  it('a grade desligada não desenha linhas', async () => {
    prepareStore()
    await render()
    const withGrid = stage().find('Shape').length
    expect(withGrid).toBeGreaterThan(0)

    await act(async () => root.unmount())
    prepareStore()
    await render('gm', 'mestre', { ...map, grid: { ...grid, enabled: false } })

    expect(stage().find('Shape').length).toBeLessThan(withGrid)
  })
})

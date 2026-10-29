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

const db = vi.hoisted(() => ({
  listMaps: vi.fn(),
  listTokens: vi.fn(),
  moveToken: vi.fn(),
  createDrawing: vi.fn(),
  deleteDrawings: vi.fn(async () => {})
}))
const broadcast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/maps', () => ({ listMaps: db.listMaps }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: db.listTokens, moveToken: db.moveToken }))
vi.mock('@/lib/db/drawings', () => ({
  listDrawings: () => Promise.resolve([]),
  createDrawing: db.createDrawing,
  deleteDrawings: db.deleteDrawings
}))
vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ broadcast }) }
}))
// O tabuleiro não baixa imagem nestes testes: só a geometria importa.
vi.mock('@/lib/db/assets', () => ({ assetUrl: () => new Promise(() => {}) }))

const { BoardCanvas } = await import('./board-canvas')
const { useBoardStore } = await import('./board-store')
const { useLiveStore } = await import('./live-store')
const { useCombatStore } = await import('@/features/combat/combat-store')

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
    conditions: [],
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
  useBoardStore.setState({ tool: 'select' })
  useCombatStore.getState().close()
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
        nameOf={(id) => (id === 'carla' ? 'Carla' : '')}
      />
    )
  })
}

/**
 * Um gesto do mouse sobre o tabuleiro. No jsdom o Konva não acha forma nenhuma sob o
 * cursor (o canvas é de mentira), então o alvo é sempre o próprio Stage — que é o caso de
 * desenhar, medir ou apagar sobre o mapa.
 */
async function mouse(
  type: 'mousedown' | 'mousemove' | 'mouseup',
  x: number,
  y: number,
  init: MouseEventInit = {}
): Promise<void> {
  const content = container.querySelector('.konvajs-content')
  if (content === null) throw new Error('o Stage do Konva não subiu')
  await act(async () => {
    content.dispatchEvent(
      new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...init })
    )
  })
}

/** Câmera neutra: ponto da tela = ponto do mapa, para as contas do teste ficarem óbvias. */
function neutralCamera(): void {
  act(() => {
    useBoardStore.setState({ cameras: { 'mapa-1': { x: 0, y: 0, scale: 1 } } })
  })
}

function texts(): string[] {
  return stage()
    .find('Text')
    .map((node) => (node as Konva.Text).text())
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

describe('desenho, régua, ping e reações (6.3, 6.5)', () => {
  const base = {
    sessionId: 'mesa',
    mapId: 'mapa-1',
    tool: 'line' as const,
    color: '#ef4444',
    width: 4,
    createdAt: ''
  }

  it('desenha os traços salvos entre o mapa e os tokens', async () => {
    prepareStore([token({ id: 't1' })])
    useBoardStore.setState({
      drawings: [{ ...base, id: 'd1', authorId: 'mestre', tool: 'pencil', points: [0, 0, 10, 10, 20, 0] }]
    })
    await render()

    const line = stage().findOne('Line') as Konva.Line | undefined
    expect(line?.points()).toEqual([0, 0, 10, 10, 20, 0])
    // A camada do desenho fica abaixo da dos tokens.
    const layers = stage().getLayers()
    const drawingLayer = layers.findIndex((layer) => layer.findOne('Line') !== undefined)
    const tokenLayer = layers.findIndex((layer) => layer.findOne('Group') !== undefined)
    expect(drawingLayer).toBeGreaterThan(-1)
    expect(drawingLayer).toBeLessThan(tokenLayer)
  })

  it('com o lápis na mão, nenhum token arrasta (o clique é do desenho)', async () => {
    prepareStore([token({ id: 't1' })])
    useBoardStore.setState({ tool: 'draw' })
    await render()

    expect(stage().find('Group').filter((node) => node.draggable())).toHaveLength(0)
  })

  it('arrastar com a linha grava o traço e mostra ao vivo para os outros', async () => {
    prepareStore()
    useBoardStore.setState({ tool: 'draw', drawTool: 'line', strokeLevel: 1 })
    db.createDrawing.mockImplementation(async (input: Record<string, unknown>) => ({
      ...input,
      authorId: 'mestre',
      createdAt: 'agora'
    }))
    await render()
    neutralCamera()

    await mouse('mousedown', 100, 100)
    await mouse('mousemove', 300, 160)
    expect(useLiveStore.getState().draft?.points).toEqual([100, 100, 300, 160])
    expect(broadcast).toHaveBeenCalledWith('draw-live', expect.objectContaining({ tool: 'line' }))

    await mouse('mouseup', 300, 160)
    expect(useLiveStore.getState().draft).toBeNull()
    // Espessura média: 6% do quadrado de 50 px.
    expect(db.createDrawing).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'line',
        points: [100, 100, 300, 160],
        color: '#ef4444',
        width: 3
      })
    )
  })

  it('um clique sem arrastar com a linha não grava nada', async () => {
    prepareStore()
    useBoardStore.setState({ tool: 'draw', drawTool: 'line' })
    await render()
    neutralCamera()

    await mouse('mousedown', 100, 100)
    await mouse('mouseup', 100, 100)
    expect(db.createDrawing).not.toHaveBeenCalled()
    expect(broadcast).toHaveBeenCalledWith('draw-end', expect.anything())
  })

  it('a borracha do jogador apaga o traço dele e passa por cima do dos outros', async () => {
    prepareStore()
    useBoardStore.setState({
      tool: 'erase',
      drawings: [
        { ...base, id: 'meu', authorId: 'ana', points: [0, 100, 400, 100] },
        { ...base, id: 'do-mestre', authorId: 'mestre', points: [0, 102, 400, 102] }
      ]
    })
    await render('player', 'ana')
    neutralCamera()

    await mouse('mousedown', 200, 101)
    await mouse('mouseup', 200, 101)
    expect(db.deleteDrawings).toHaveBeenCalledWith(['meu'])
    expect(useBoardStore.getState().drawings.map((drawing) => drawing.id)).toEqual(['do-mestre'])
  })

  it('a régua mostra metros pela escala da mesa e vai de centro a centro', async () => {
    prepareStore()
    useBoardStore.setState({ tool: 'ruler', scale: { metersPerSquare: 1.5, diagonal: 'simple' } })
    await render()
    neutralCamera()

    await mouse('mousedown', 10, 10)
    await mouse('mousemove', 160, 20)
    expect(useLiveStore.getState().myRuler).toEqual({
      from: { x: 25, y: 25 },
      to: { x: 175, y: 25 }
    })
    expect(texts()).toContain('4,5 m · 3 quadrados')
    expect(broadcast).toHaveBeenCalledWith('ruler', expect.objectContaining({ mapId: 'mapa-1' }))

    await mouse('mouseup', 160, 20)
    expect(useLiveStore.getState().myRuler).toBeNull()
    expect(broadcast).toHaveBeenLastCalledWith('ruler', expect.objectContaining({ to: null }))
  })

  it('a régua dos outros aparece com o nome de quem mede', async () => {
    prepareStore()
    useBoardStore.setState({ scale: { metersPerSquare: 1.5, diagonal: 'simple' } })
    await render()
    act(() => {
      useLiveStore.getState().applyRuler({
        userId: 'carla',
        mapId: 'mapa-1',
        from: { x: 25, y: 25 },
        to: { x: 125, y: 25 }
      })
    })
    expect(texts()).toContain('Carla: 3 m · 2 quadrados')
  })

  it('Alt+clique manda um ping, e o pulso aparece com o nome', async () => {
    prepareStore()
    await render('gm', 'mestre')
    neutralCamera()

    await mouse('mousedown', 50, 60, { altKey: true })
    // O clique é o Konva que gera, ao soltar o botão no mesmo lugar.
    await mouse('mouseup', 50, 60, { altKey: true })

    const pings = broadcast.mock.calls.filter(([event]) => event === 'ping')
    expect(pings).toHaveLength(1)
    expect(pings[0]?.[1]).toMatchObject({ mapId: 'mapa-1', x: 50, y: 60 })
    // Alt+clique não começa caixa de seleção nem nada além do ping.
    expect(useBoardStore.getState().selection).toEqual([])
    expect(container.querySelector('.board-ping')).not.toBeNull()

    act(() => {
      useLiveStore.getState().addPing({ userId: 'carla', mapId: 'mapa-1', point: { x: 1, y: 1 } })
    })
    expect(container.textContent).toContain('Carla')
  })

  it('a reação aparece sobre o token certo', async () => {
    prepareStore([token({ id: 't1', x: 100, y: 100 })])
    await render()
    neutralCamera()
    act(() => {
      useLiveStore
        .getState()
        .addReaction({ userId: 'carla', mapId: 'mapa-1', tokenId: 't1', emoji: '🎉' })
    })

    const emoji = container.querySelector<HTMLElement>('.board-reaction')
    expect(emoji?.textContent).toBe('🎉')
    // Topo do token, no meio: x = 100 + 50/2.
    expect(emoji?.style.left).toBe('125px')
    expect(emoji?.style.top).toBe('100px')
  })
})

describe('combate no mapa (6.3, 7.3)', () => {
  it('as condições aparecem sobre o token, com as rodadas que faltam', async () => {
    prepareStore([
      token({
        id: 't1',
        name: 'Goblin',
        conditions: [
          { key: 'atordoado', name: 'Atordoado', icon: '💫', rounds: 2 },
          { key: 'caido', name: 'Caído', icon: '🔻', rounds: null }
        ]
      })
    ])
    await render()
    expect(texts()).toEqual(expect.arrayContaining(['💫', '2', '🔻', 'Goblin']))
  })

  it('muitas condições: as primeiras e um "+N"', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({
      key,
      name: key,
      icon: '⭐',
      rounds: null
    }))
    prepareStore([token({ id: 't1', name: '', conditions: many })])
    await render()
    expect(texts().filter((text) => text === '⭐')).toHaveLength(3)
    expect(texts()).toContain('+3')
  })

  it('o token da vez ganha o anel com brilho', async () => {
    prepareStore([token({ id: 't1' }), token({ id: 't2', x: 300 })])
    useCombatStore.setState({
      sessionId: 'mesa',
      state: { active: true, round: 1, turnEntryId: 'e2' },
      entries: [
        {
          id: 'e2',
          sessionId: 'mesa',
          tokenId: 't2',
          name: 'Lobo',
          imagePath: null,
          ownerId: 'mestre',
          kind: 'monster',
          hidden: false,
          showName: true,
          initiative: 12,
          sortOrder: 1
        }
      ]
    })
    await render()

    const glow = stage()
      .find('Circle')
      .filter((node) => (node as Konva.Circle).stroke() === '#fbbf24')
    expect(glow).toHaveLength(1)
    expect(glow[0]?.getParent()?.x()).toBe(300)
  })
})

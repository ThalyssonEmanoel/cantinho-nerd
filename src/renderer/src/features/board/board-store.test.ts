import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap, type BoardToken, type Drawing } from '@/lib/board'
import { FriendlyError } from '@/lib/db/errors'
import type { TokenRow } from '@/lib/db/board-rows'

/**
 * O estado do tabuleiro (6.1 a 6.3): troca de mapa, tokens chegando pelo tempo real,
 * arrasto com encaixe na grade e a câmera de cada um.
 */

const db = vi.hoisted(() => ({
  listMaps: vi.fn(),
  listTokens: vi.fn(),
  moveToken: vi.fn(),
  listDrawings: vi.fn(async (): Promise<Drawing[]> => [])
}))

vi.mock('@/lib/db/maps', () => ({ listMaps: db.listMaps }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: db.listTokens, moveToken: db.moveToken }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: db.listDrawings }))

const { drawPosition, useBoardStore } = await import('./board-store')
const { useLiveStore } = await import('./live-store')

const grid = { ...DEFAULT_GRID, size: 50, offsetX: 0, offsetY: 0 }

const taverna: BoardMap = {
  id: 'mapa-1',
  sessionId: 'mesa',
  name: 'Taverna',
  imagePath: 'sessions/mesa/maps/a.webp',
  width: 1000,
  height: 800,
  grid,
  fog: { enabled: false, shapes: [] },
  sortOrder: 0
}

const cripta: BoardMap = {
  ...taverna,
  id: 'mapa-2',
  name: 'Cripta',
  width: 400,
  height: 400,
  sortOrder: 1
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

function row(partial: Partial<TokenRow> & { id: string }): TokenRow {
  return {
    session_id: 'mesa',
    map_id: 'mapa-1',
    sheet_id: null,
    kind: 'monster',
    owner_id: 'mestre',
    name: 'Goblin',
    image_path: null,
    image_crop: {},
    x: 0,
    y: 0,
    size: 1,
    z: 0,
    hidden: false,
    show_name: true,
    show_bars: true,
    vision_m: null,
    bars: {},
    ...partial
  }
}

const store = (): ReturnType<typeof useBoardStore.getState> => useBoardStore.getState()

beforeEach(() => {
  db.listMaps.mockResolvedValue([taverna, cripta])
  db.listTokens.mockResolvedValue([])
  db.moveToken.mockResolvedValue(undefined)
  store().close()
})

afterEach(() => {
  store().close()
  vi.clearAllMocks()
})

describe('abrir o tabuleiro', () => {
  it('o jogador abre no mapa ativo', async () => {
    db.listTokens.mockResolvedValueOnce([token({ id: 't1' })])
    await store().open({
      sessionId: 'mesa',
      role: 'player',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })

    expect(store().openMapId).toBe('mapa-1')
    expect(store().tokens).toHaveLength(1)
    expect(db.listTokens).toHaveBeenCalledWith('mapa-1')
  })

  it('sem mapa ativo, o jogador fica sem tabuleiro', async () => {
    await store().open({
      sessionId: 'mesa',
      role: 'player',
      activeMapId: null,
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })

    expect(store().openMapId).toBeNull()
    expect(store().tokens).toEqual([])
  })

  it('sem mapa ativo, o mestre abre o primeiro da biblioteca para preparar', async () => {
    await store().open({
      sessionId: 'mesa',
      role: 'gm',
      activeMapId: null,
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })

    expect(store().openMapId).toBe('mapa-1')
  })
})

describe('mapa ativo mudou', () => {
  beforeEach(async () => {
    await store().open({
      sessionId: 'mesa',
      role: 'player',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })
  })

  it('o jogador é levado para o mapa novo', () => {
    store().syncSession('mapa-2', store().scale)
    expect(store().openMapId).toBe('mapa-2')
    expect(db.listTokens).toHaveBeenLastCalledWith('mapa-2')
  })

  it('o mestre que está preparando outro mapa não é arrastado', () => {
    useBoardStore.setState({ role: 'gm' })
    store().openMap('mapa-2')
    store().syncSession('mapa-1', store().scale)
    // Ele continua na Cripta, mesmo com a Taverna ativa (6.1).
    expect(store().openMapId).toBe('mapa-2')
  })

  it('a escala da mesa acompanha', () => {
    store().syncSession('mapa-1', { metersPerSquare: 3, diagonal: 'real' })
    expect(store().scale).toEqual({ metersPerSquare: 3, diagonal: 'real' })
  })
})

describe('tokens pelo tempo real', () => {
  beforeEach(async () => {
    await store().open({
      sessionId: 'mesa',
      role: 'gm',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })
  })

  it('INSERT entra, UPDATE troca e DELETE sai', () => {
    store().applyTokenChange({ event: 'INSERT', row: row({ id: 't1' }) as never, old: {} })
    expect(store().tokens).toHaveLength(1)

    store().applyTokenChange({
      event: 'UPDATE',
      row: row({ id: 't1', name: 'Goblin chefe', x: 100 }) as never,
      old: {}
    })
    expect(store().tokens[0]?.name).toBe('Goblin chefe')
    expect(store().tokens[0]?.x).toBe(100)

    // O DELETE chega só com o id.
    store().applyTokenChange({ event: 'DELETE', row: {}, old: { id: 't1' } })
    expect(store().tokens).toEqual([])
  })

  it('token de outro mapa não entra nesta tela', () => {
    store().applyTokenChange({
      event: 'INSERT',
      row: row({ id: 't2', map_id: 'mapa-2' }) as never,
      old: {}
    })
    expect(store().tokens).toEqual([])
  })

  it('token que saiu da seleção sai do arrasto também', () => {
    store().applyTokenChange({ event: 'INSERT', row: row({ id: 't1' }) as never, old: {} })
    store().select(['t1'])
    store().applyGhost('t1', { x: 10, y: 10 })

    store().removeTokenLocally('t1')
    expect(store().selection).toEqual([])
    expect(store().dragging).toEqual({})
  })

  it('a ordem de desenho é estável', () => {
    store().applyTokenChange({ event: 'INSERT', row: row({ id: 'b', z: 2 }) as never, old: {} })
    store().applyTokenChange({ event: 'INSERT', row: row({ id: 'a', z: 1 }) as never, old: {} })
    expect(store().tokens.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('arrastar e soltar', () => {
  beforeEach(async () => {
    db.listTokens.mockResolvedValueOnce([token({ id: 't1', x: 0, y: 0 })])
    await store().open({
      sessionId: 'mesa',
      role: 'gm',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })
  })

  it('a posição do arrasto é a desenhada', () => {
    store().dragTo('t1', { x: 37, y: 42 })
    const current = store().tokens[0] as BoardToken
    expect(drawPosition(current, store().dragging)).toEqual({ x: 37, y: 42 })
  })

  it('soltar encaixa na grade e grava', async () => {
    await store().dropToken('t1', { x: 124, y: 76 }, true)

    expect(db.moveToken).toHaveBeenCalledWith('t1', 100, 100)
    expect(store().tokens[0]?.x).toBe(100)
    expect(store().dragging).toEqual({})
  })

  it('com Alt, solta livre (6.2)', async () => {
    await store().dropToken('t1', { x: 124, y: 76 }, false)
    expect(db.moveToken).toHaveBeenCalledWith('t1', 124, 76)
  })

  it('recusado pelo banco, o token volta para onde estava', async () => {
    // O acesso ao banco levanta FriendlyError, que já vem em português.
    db.moveToken.mockRejectedValueOnce(new FriendlyError('Esse token não é seu para mover.'))
    await store().dropToken('t1', { x: 300, y: 300 }, true)

    expect(store().tokens[0]?.x).toBe(0)
    expect(store().tokens[0]?.y).toBe(0)
    expect(store().problem).toMatch(/não é seu/)
  })
})

describe('câmera', () => {
  beforeEach(async () => {
    await store().open({
      sessionId: 'mesa',
      role: 'gm',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })
  })

  it('a primeira medida da janela já põe o mapa inteiro à vista', () => {
    store().setViewport({ width: 500, height: 500 })
    const camera = store().cameras['mapa-1']

    expect(camera).toBeDefined()
    expect((camera?.scale ?? 0) * taverna.width).toBeLessThanOrEqual(500)
  })

  it('cada mapa lembra a própria câmera (6.1)', () => {
    store().setViewport({ width: 500, height: 500 })
    // Com o mapa inteiro à vista não há para onde arrastar: aproxima antes.
    store().zoomStep(4)
    store().pan(-30, -20)
    const first = store().cameras['mapa-1']

    store().openMap('mapa-2')
    store().fit()

    expect(store().cameras['mapa-1']).toEqual(first)
    expect(store().cameras['mapa-2']).not.toEqual(first)

    store().openMap('mapa-1')
    expect(store().cameras['mapa-1']).toEqual(first)
  })

  it('mapa que cabe inteiro na janela fica centralizado, sem arrastar', () => {
    store().setViewport({ width: 500, height: 500 })
    const centered = store().cameras['mapa-1']
    store().pan(-120, -90)
    expect(store().cameras['mapa-1']).toEqual(centered)
  })

  it('o zoom não passa dos limites', () => {
    store().setViewport({ width: 500, height: 500 })
    for (let index = 0; index < 50; index += 1) store().zoomStep(2)
    expect(store().cameras['mapa-1']?.scale).toBeLessThanOrEqual(8)
  })
})

describe('desenhos (6.5)', () => {
  function drawing(id: string, mapId: string, authorId = 'mestre'): Drawing {
    return {
      id,
      sessionId: 'mesa',
      mapId,
      authorId,
      tool: 'line',
      points: [0, 0, 10, 10],
      color: '#ef4444',
      width: 4,
      createdAt: ''
    }
  }

  it('abrir e trocar de mapa troca os desenhos junto com os tokens', async () => {
    db.listMaps.mockResolvedValue([taverna, cripta])
    db.listTokens.mockResolvedValue([])
    db.listDrawings
      .mockResolvedValueOnce([drawing('d-mapa-1', 'mapa-1')])
      .mockResolvedValueOnce([drawing('d-mapa-2', 'mapa-2')])

    await useBoardStore.getState().open({
      sessionId: 'mesa',
      role: 'gm',
      activeMapId: 'mapa-1',
      scale: { metersPerSquare: 1.5, diagonal: 'simple' }
    })
    expect(useBoardStore.getState().drawings.map((item) => item.id)).toEqual(['d-mapa-1'])

    useBoardStore.getState().openMap('mapa-2')
    expect(useBoardStore.getState().drawings).toEqual([])
    await vi.waitFor(() =>
      expect(useBoardStore.getState().drawings.map((item) => item.id)).toEqual(['d-mapa-2'])
    )
  })

  it('desenho de outro mapa não entra nesta tela', () => {
    useBoardStore.setState({ openMapId: 'mapa-1', drawings: [] })
    useBoardStore.getState().upsertDrawing(drawing('d1', 'mapa-2'))
    expect(useBoardStore.getState().drawings).toEqual([])
  })

  it('"apagar meus desenhos" de outra pessoa tira só os dela', () => {
    useBoardStore.setState({
      openMapId: 'mapa-1',
      drawings: [drawing('a', 'mapa-1', 'carla'), drawing('b', 'mapa-1', 'bruno')]
    })
    useBoardStore.getState().applyDrawingsCleared({ mapId: 'mapa-1', authorId: 'carla' })
    expect(useBoardStore.getState().drawings.map((item) => item.id)).toEqual(['b'])

    // Aviso de outro mapa (o mestre limpando o que prepara) não mexe nesta tela.
    useBoardStore.getState().applyDrawingsCleared({ mapId: 'mapa-2', authorId: null })
    expect(useBoardStore.getState().drawings.map((item) => item.id)).toEqual(['b'])
  })

  it('fechar a mesa limpa os efeitos passageiros também', () => {
    useLiveStore.getState().addPing({ userId: 'carla', mapId: 'mapa-1', point: { x: 1, y: 1 } })
    useBoardStore.getState().close()
    expect(useLiveStore.getState().pings).toEqual([])
  })
})

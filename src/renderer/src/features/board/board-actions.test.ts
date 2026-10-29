import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap, type BoardToken } from '@/lib/board'

/**
 * As ações do tabuleiro que envolvem o canal e o Storage (6.3).
 *
 * Duas regras valem ouro aqui, porque são o aceite da fase: o arrasto de um token oculto
 * **não** é transmitido, e ocultar um token avisa pelo canal — senão ele ficaria para
 * sempre na tela de quem já não pode mais vê-lo.
 */

const broadcast = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  patchToken: vi.fn(),
  deleteTokens: vi.fn(),
  createToken: vi.fn(),
  copyAsset: vi.fn()
}))

vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ broadcast }) }
}))

vi.mock('@/lib/db/tokens', () => ({
  patchToken: db.patchToken,
  deleteTokens: db.deleteTokens,
  createToken: db.createToken
}))

vi.mock('@/lib/db/assets', () => ({
  copyAsset: db.copyAsset,
  uploadAsset: vi.fn(),
  mapImagePath: (sessionId: string, hash: string) => `sessions/${sessionId}/maps/${hash}.webp`,
  tokenImagePath: (sessionId: string, hash: string) => `sessions/${sessionId}/tokens/${hash}.webp`,
  galleryImagePath: (userId: string, hash: string) => `users/${userId}/gallery/${hash}.webp`
}))

vi.mock('@/lib/db/maps', () => ({ createMap: vi.fn() }))

const actions = await import('./board-actions')
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

beforeEach(() => {
  db.patchToken.mockImplementation(async () => null)
  db.deleteTokens.mockResolvedValue(1)
  db.createToken.mockImplementation(async (input: unknown) => ({ ...token({ id: 'novo' }), ...(input as object) }))
  db.copyAsset.mockResolvedValue('ok')
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  useBoardStore.getState().close()
})

describe('arrasto ao vivo', () => {
  it('manda a posição para os outros', () => {
    actions.broadcastDrag(token({ id: 'visivel-1' }), { x: 10, y: 20 })
    expect(broadcast).toHaveBeenCalledWith('token-drag', { id: 'visivel-1', x: 10, y: 20 })
  })

  it('token oculto não é transmitido (6.3)', () => {
    actions.broadcastDrag(token({ id: 'oculto-1', hidden: true }), { x: 10, y: 20 })
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('não passa de ~20 avisos por segundo', () => {
    vi.useFakeTimers()
    const subject = token({ id: 'visivel-2' })

    actions.broadcastDrag(subject, { x: 1, y: 1 })
    actions.broadcastDrag(subject, { x: 2, y: 2 })
    actions.broadcastDrag(subject, { x: 3, y: 3 })
    expect(broadcast).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60)
    actions.broadcastDrag(subject, { x: 4, y: 4 })
    expect(broadcast).toHaveBeenCalledTimes(2)
  })
})

describe('ocultar e revelar', () => {
  it('ocultar avisa pelo canal', async () => {
    await actions.applyTokenPatch(token({ id: 't1' }), { hidden: true })

    expect(db.patchToken).toHaveBeenCalledWith('t1', { hidden: true })
    expect(broadcast).toHaveBeenCalledWith('token-gone', { id: 't1' })
  })

  it('revelar não precisa de aviso: o UPDATE chega ao jogador', async () => {
    await actions.applyTokenPatch(token({ id: 't1', hidden: true }), { hidden: false })
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('mexer noutra coisa não avisa nada', async () => {
    await actions.applyTokenPatch(token({ id: 't1' }), { name: 'Chefe' })
    expect(broadcast).not.toHaveBeenCalled()
  })
})

describe('focar a câmera de todos', () => {
  it('manda o ponto do mapa', () => {
    actions.focusEveryone({ x: 300, y: 150 })
    expect(broadcast).toHaveBeenCalledWith('camera-focus', { x: 300, y: 150 })
  })
})

describe('colocar tokens', () => {
  it('o token do jogador cai no quadrado onde se pediu, acima dos outros', async () => {
    await actions.placeMyToken({
      map,
      desired: { x: 124, y: 76 },
      tokens: [token({ id: 'outro', z: 5 })],
      sheetId: 'ficha-1',
      name: 'Lia'
    })

    // O ponto (124, 76) está dentro do quadrado que começa em (100, 50) — colocar é
    // "neste quadrado", diferente de arrastar, onde o canto vai para o canto mais perto.
    expect(db.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'player', sheetId: 'ficha-1', x: 100, y: 50, z: 6 })
    )
  })

  it('não cai em cima de um token que já está lá', async () => {
    await actions.placeMyToken({
      map,
      desired: { x: 100, y: 100 },
      tokens: [token({ id: 'ocupado', x: 100, y: 100 })],
      sheetId: null,
      name: 'Lia'
    })

    const [input] = db.createToken.mock.calls[0] as [{ x: number; y: number }]
    expect([input.x, input.y]).not.toEqual([100, 100])
  })

  it('a imagem da galeria é copiada para a pasta da mesa (seção 8)', async () => {
    await actions.placeGalleryToken({
      map,
      desired: { x: 0, y: 0 },
      tokens: [token({ id: 'a', name: 'Goblin 1' }), token({ id: 'b', name: 'Goblin 2' })],
      image: {
        id: 'g1',
        kind: 'monster',
        name: 'Goblin',
        imagePath: 'users/mestre/gallery/abc123.webp',
        tokenSize: 1
      },
      hidden: true
    })

    expect(db.copyAsset).toHaveBeenCalledWith(
      'users/mestre/gallery/abc123.webp',
      'sessions/mesa/tokens/abc123.webp'
    )
    expect(db.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'monster',
        // Numeração automática continuando de onde parou.
        name: 'Goblin 3',
        hidden: true,
        imagePath: 'sessions/mesa/tokens/abc123.webp'
      })
    )
  })
})

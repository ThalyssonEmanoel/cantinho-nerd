import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardToken, Drawing, LiveStroke } from '@/lib/board'

/**
 * Desenho, régua, ping e reações (6.3, 6.5): o que junta banco, canal e stores.
 *
 * O ponto delicado é o traço otimista: ele entra na tela antes de o banco confirmar, então
 * desfazer ou apagar no meio da gravação tem que esperar por ela — e o traço desfeito não
 * pode voltar quando a gravação termina.
 */

const broadcast = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  createDrawing: vi.fn(),
  deleteDrawings: vi.fn(async () => {}),
  deleteMyDrawings: vi.fn(async () => {}),
  deleteAllDrawings: vi.fn(async () => {}),
  listDrawings: vi.fn(async (): Promise<Drawing[]> => [])
}))

vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ broadcast }) }
}))
vi.mock('@/lib/db/drawings', () => db)
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))

const actions = await import('./drawing-actions')
const { useBoardStore } = await import('./board-store')
const { useLiveStore } = await import('./live-store')

const stroke: LiveStroke = {
  id: 'd1',
  mapId: 'm1',
  authorId: 'bruno',
  tool: 'line',
  points: [0, 0, 50, 50],
  color: '#ef4444',
  width: 4
}

function saved(partial: Partial<Drawing> & { id: string }): Drawing {
  return { ...stroke, sessionId: 's1', createdAt: '2026-10-29T12:00:00Z', ...partial }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const ids = (): string[] => useBoardStore.getState().drawings.map((drawing) => drawing.id)

beforeEach(() => {
  useBoardStore.getState().close()
  useBoardStore.setState({ sessionId: 's1', openMapId: 'm1', activeMapId: 'm1' })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('salvar o traço', () => {
  it('entra na tela na hora e é trocado pelo que o banco devolveu', async () => {
    const saving = deferred<Drawing>()
    db.createDrawing.mockReturnValueOnce(saving.promise)

    const done = actions.saveDrawing(stroke)
    expect(ids()).toEqual(['d1'])
    expect(db.createDrawing).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', sessionId: 's1' }))

    saving.resolve(saved({ id: 'd1' }))
    await done
    expect(useBoardStore.getState().drawings[0]?.createdAt).toBe('2026-10-29T12:00:00Z')
  })

  it('recusado pelo banco: some da minha tela e da dos outros', async () => {
    db.createDrawing.mockRejectedValueOnce(new Error('sem permissão'))

    await expect(actions.saveDrawing(stroke)).rejects.toThrow('sem permissão')
    expect(ids()).toEqual([])
    expect(broadcast).toHaveBeenCalledWith('draw-end', { id: 'd1' })
  })
})

describe('desfazer e apagar', () => {
  it('Ctrl+Z durante a gravação espera o banco e não deixa o traço voltar', async () => {
    const saving = deferred<Drawing>()
    db.createDrawing.mockReturnValueOnce(saving.promise)
    const save = actions.saveDrawing(stroke)

    const undo = actions.undoLastDrawing('bruno')
    expect(ids()).toEqual([])
    // Ainda não existe no banco: apagar agora não apagaria nada.
    expect(db.deleteDrawings).not.toHaveBeenCalled()

    saving.resolve(saved({ id: 'd1' }))
    await Promise.all([save, undo])
    expect(db.deleteDrawings).toHaveBeenCalledWith(['d1'])
    expect(ids()).toEqual([])

    // Nem o INSERT que chega depois pelo tempo real o ressuscita.
    useBoardStore.getState().upsertDrawing(saved({ id: 'd1' }))
    expect(ids()).toEqual([])
  })

  it('desfaz só o meu traço mais recente', async () => {
    useBoardStore.setState({
      drawings: [
        saved({ id: 'a', authorId: 'bruno' }),
        saved({ id: 'b', authorId: 'bruno' }),
        saved({ id: 'c', authorId: 'carla' })
      ]
    })
    expect(await actions.undoLastDrawing('bruno')).toBe(true)
    expect(db.deleteDrawings).toHaveBeenCalledWith(['b'])
    expect(ids()).toEqual(['a', 'c'])
    expect(await actions.undoLastDrawing('davi')).toBe(false)
  })

  it('o banco recusou apagar: a tela volta ao que o banco tem', async () => {
    useBoardStore.setState({ drawings: [saved({ id: 'a' })] })
    db.deleteDrawings.mockRejectedValueOnce(new Error('caiu'))
    db.listDrawings.mockResolvedValueOnce([saved({ id: 'a' })])

    await expect(actions.eraseDrawings(['a'])).rejects.toThrow('caiu')
    expect(ids()).toEqual(['a'])
  })

  it('"apagar meus desenhos" tira só os meus e avisa os outros depois de apagar', async () => {
    useBoardStore.setState({
      drawings: [saved({ id: 'a', authorId: 'bruno' }), saved({ id: 'c', authorId: 'carla' })]
    })
    await actions.clearMyDrawings('bruno')

    expect(ids()).toEqual(['c'])
    expect(db.deleteMyDrawings).toHaveBeenCalledWith('m1', 'bruno')
    expect(broadcast).toHaveBeenCalledWith('drawings-cleared', { mapId: 'm1', authorId: 'bruno' })
  })

  it('"limpar todos" (mestre) leva os de todo mundo', async () => {
    useBoardStore.setState({
      drawings: [saved({ id: 'a', authorId: 'bruno' }), saved({ id: 'c', authorId: 'carla' })]
    })
    await actions.clearAllDrawings()

    expect(ids()).toEqual([])
    expect(db.deleteAllDrawings).toHaveBeenCalledWith('m1')
    expect(broadcast).toHaveBeenCalledWith('drawings-cleared', { mapId: 'm1', authorId: null })
  })
})

describe('traço ao vivo', () => {
  it('vai ~20 vezes por segundo, e o lápis longo só é simplificado quando o aviso sai', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000)
    const prepare = vi.fn((points: number[]) => points.slice(0, 4))
    const pencil: LiveStroke = { ...stroke, tool: 'pencil', points: [0, 0, 5, 5, 9, 9] }

    actions.broadcastStroke(pencil, prepare)
    actions.broadcastStroke(pencil, prepare)

    expect(prepare).toHaveBeenCalledTimes(1)
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast).toHaveBeenCalledWith(
      'draw-live',
      expect.objectContaining({ id: 'd1', points: [0, 0, 5, 5] })
    )
  })
})

describe('régua, ping e reação', () => {
  it('a régua vai no máximo ~20 vezes por segundo, mas o "soltei" sai sempre', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const from = { x: 0, y: 0 }

    actions.shareRuler('m1', 'bruno', from, { x: 10, y: 0 })
    actions.shareRuler('m1', 'bruno', from, { x: 20, y: 0 })
    expect(broadcast).toHaveBeenCalledTimes(1)

    actions.shareRuler('m1', 'bruno', from, null)
    expect(broadcast).toHaveBeenLastCalledWith('ruler', {
      userId: 'bruno',
      mapId: 'm1',
      from,
      to: null
    })

    now.mockReturnValue(1_000_100)
    actions.shareRuler('m1', 'bruno', from, { x: 30, y: 0 })
    expect(broadcast).toHaveBeenCalledTimes(3)
  })

  it('o ping aparece para mim também e vai para os outros', () => {
    actions.sendPing('m1', 'bruno', { x: 5, y: 6 })
    expect(useLiveStore.getState().pings.at(-1)?.point).toEqual({ x: 5, y: 6 })
    expect(broadcast).toHaveBeenCalledWith('ping', { userId: 'bruno', mapId: 'm1', x: 5, y: 6 })
  })

  it('reação em token oculto fica só na minha tela (6.3)', () => {
    const token = { id: 't1', mapId: 'm1', hidden: true } as BoardToken
    actions.sendReaction(token, 'ana', '💀')
    expect(useLiveStore.getState().reactions.at(-1)?.emoji).toBe('💀')
    expect(broadcast).not.toHaveBeenCalled()

    actions.sendReaction({ ...token, hidden: false }, 'ana', '🎉')
    expect(broadcast).toHaveBeenCalledWith('reaction', {
      userId: 'ana',
      mapId: 'm1',
      tokenId: 't1',
      emoji: '🎉'
    })
  })
})

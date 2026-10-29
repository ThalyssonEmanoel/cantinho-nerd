import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap, type FogShape, type FogState } from '@/lib/board'

/**
 * A névoa é gravada inteira a cada área: as gravações vão em fila, a tela não espera o
 * banco, e o eco atrasado do tempo real não pode apagar a área que o mestre acabou de fazer.
 */

const db = vi.hoisted(() => ({
  updateMapFog: vi.fn(async (_id: string, _fog: FogState) => {}),
  listMaps: vi.fn(async () => [])
}))

vi.mock('@/lib/db/maps', () => db)
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))

const actions = await import('./fog-actions')
const { useBoardStore } = await import('./board-store')

const map: BoardMap = {
  id: 'm1',
  sessionId: 's1',
  name: 'Cripta',
  imagePath: 'x',
  width: 1000,
  height: 800,
  grid: { ...DEFAULT_GRID, size: 50 },
  fog: { enabled: true, shapes: [] },
  sortOrder: 0
}

const area = (x: number): FogShape => ({
  mode: 'reveal',
  kind: 'rect',
  points: [x, 0, x + 100, 100],
  radius: 0
})

const fogNow = (): FogState => useBoardStore.getState().maps[0]?.fog as FogState

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  useBoardStore.setState({ maps: [map], openMapId: 'm1' })
})

afterEach(() => {
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

describe('gravar a névoa', () => {
  it('a área aparece na hora, e as gravações vão uma de cada vez, em ordem', async () => {
    const first = deferred()
    db.updateMapFog.mockReturnValueOnce(first.promise)

    const a = actions.addFogArea(map, area(0))
    const b = actions.addFogArea(map, area(200))
    expect(fogNow().shapes).toHaveLength(2)

    await Promise.resolve()
    expect(db.updateMapFog).toHaveBeenCalledTimes(1)
    first.resolve()
    await Promise.all([a, b])

    expect(db.updateMapFog).toHaveBeenCalledTimes(2)
    const last = db.updateMapFog.mock.calls[1]?.[1] as FogState
    expect(last.shapes).toHaveLength(2)
  })

  it('o banco recusou: a tela volta ao que estava', async () => {
    db.updateMapFog.mockRejectedValueOnce(new Error('caiu'))
    await expect(actions.setFogEnabled(map, false)).rejects.toThrow('caiu')
    expect(fogNow().enabled).toBe(true)
  })

  it('o eco de uma gravação velha não apaga a área nova da tela', async () => {
    const first = deferred()
    db.updateMapFog.mockReturnValueOnce(first.promise)
    const saving = actions.addFogArea(map, area(0))

    // Chega pelo tempo real a névoa antiga (de antes desta gravação).
    useBoardStore.getState().applyMapChange({
      event: 'UPDATE',
      row: {
        id: 'm1',
        session_id: 's1',
        name: 'Cripta renomeada',
        image_path: 'x',
        width: 1000,
        height: 800,
        grid: {},
        fog: { enabled: true, shapes: [] },
        sort_order: 0
      },
      old: {}
    })
    expect(fogNow().shapes).toHaveLength(1)
    expect(useBoardStore.getState().maps[0]?.name).toBe('Cripta renomeada')

    first.resolve()
    await saving
  })

  it('revelar tudo, cobrir tudo e desfazer', async () => {
    await actions.addFogArea(map, area(0))
    await actions.undoFogArea(map)
    expect(fogNow().shapes).toEqual([])
    await actions.revealWholeMap(map)
    expect(fogNow().shapes).toEqual([
      { mode: 'reveal', kind: 'rect', points: [0, 0, 1000, 800], radius: 0 }
    ])
    await actions.coverWholeMap(map)
    expect(fogNow().shapes).toEqual([])
  })

  it('névoa grande demais para o banco é recusada antes de sair', async () => {
    const huge: FogState = {
      enabled: true,
      shapes: Array.from({ length: 300 }, () => ({
        mode: 'reveal' as const,
        kind: 'brush' as const,
        points: Array.from({ length: 400 }, (_, index) => index + 0.5),
        radius: 30
      }))
    }
    await expect(actions.saveFog(map, huge)).rejects.toThrow('detalhada demais')
    expect(db.updateMapFog).not.toHaveBeenCalled()
  })
})

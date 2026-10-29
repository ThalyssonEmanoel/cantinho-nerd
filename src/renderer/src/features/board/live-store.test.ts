import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PING_MS, REACTION_MS, RULER_TIMEOUT_MS, STROKE_TIMEOUT_MS, useLiveStore } from './live-store'

/**
 * Tudo que chega pelo canal sem passar pelo banco pode se perder no caminho. Aqui se garante
 * que nada fica na tela para sempre por causa disso.
 */

const stroke = {
  id: 'd1',
  mapId: 'm1',
  authorId: 'carla',
  tool: 'pencil' as const,
  points: [0, 0],
  color: '#ef4444',
  width: 4
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  useLiveStore.getState().reset()
  vi.useRealTimers()
})

describe('efeitos passageiros', () => {
  it('o traço de quem parou de mandar notícia some', () => {
    useLiveStore.getState().applyStroke(stroke)
    vi.advanceTimersByTime(STROKE_TIMEOUT_MS - 100)
    // Chegou mais um pedaço: o prazo recomeça.
    useLiveStore.getState().applyStroke({ ...stroke, points: [0, 0, 5, 5] })
    vi.advanceTimersByTime(STROKE_TIMEOUT_MS - 100)
    expect(useLiveStore.getState().strokes.d1?.points).toEqual([0, 0, 5, 5])

    vi.advanceTimersByTime(200)
    expect(useLiveStore.getState().strokes).toEqual({})
  })

  it('a régua some ao soltar, ou sozinha se o aviso se perder', () => {
    const from = { x: 0, y: 0 }
    useLiveStore.getState().applyRuler({ userId: 'carla', mapId: 'm1', from, to: { x: 9, y: 9 } })
    useLiveStore.getState().applyRuler({ userId: 'carla', mapId: 'm1', from, to: null })
    expect(useLiveStore.getState().rulers).toEqual({})

    useLiveStore.getState().applyRuler({ userId: 'davi', mapId: 'm1', from, to: { x: 9, y: 9 } })
    vi.advanceTimersByTime(RULER_TIMEOUT_MS)
    expect(useLiveStore.getState().rulers).toEqual({})
  })

  it('ping e reação duram o tempo da animação', () => {
    useLiveStore.getState().addPing({ userId: 'carla', mapId: 'm1', point: { x: 1, y: 2 } })
    useLiveStore
      .getState()
      .addReaction({ userId: 'carla', mapId: 'm1', tokenId: 't1', emoji: '👍' })

    vi.advanceTimersByTime(PING_MS)
    expect(useLiveStore.getState().pings).toEqual([])
    expect(useLiveStore.getState().reactions).toHaveLength(1)

    vi.advanceTimersByTime(REACTION_MS - PING_MS)
    expect(useLiveStore.getState().reactions).toEqual([])
  })

  it('alguém clicando sem parar não enche a tela dos outros', () => {
    for (let index = 0; index < 100; index += 1) {
      useLiveStore.getState().addPing({ userId: 'carla', mapId: 'm1', point: { x: index, y: 0 } })
    }
    expect(useLiveStore.getState().pings.length).toBeLessThanOrEqual(24)
    expect(useLiveStore.getState().pings.at(-1)?.point.x).toBe(99)
  })
})

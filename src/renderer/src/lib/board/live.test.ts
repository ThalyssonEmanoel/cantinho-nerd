import { describe, expect, it } from 'vitest'
import {
  isReaction,
  parseDrawingsCleared,
  parseLiveStroke,
  parsePing,
  parseReaction,
  parseRuler,
  REACTIONS
} from './live'

describe('traço ao vivo', () => {
  const stroke = {
    id: 'd1',
    mapId: 'm1',
    authorId: 'bruno',
    tool: 'pencil',
    points: [10, 20],
    color: '#ef4444',
    width: 4
  }

  it('aceita o traço de um ponto só (o primeiro evento)', () => {
    expect(parseLiveStroke(stroke)).toEqual(stroke)
  })

  it('recusa ferramenta, cor ou pontos estranhos', () => {
    expect(parseLiveStroke({ ...stroke, tool: 'spray' })).toBeNull()
    expect(parseLiveStroke({ ...stroke, color: 'url(javascript:1)' })).toBeNull()
    expect(parseLiveStroke({ ...stroke, points: [1, 2, 3] })).toBeNull()
    expect(parseLiveStroke({ ...stroke, id: undefined })).toBeNull()
  })

  it('espessura absurda é limitada, não derruba', () => {
    expect(parseLiveStroke({ ...stroke, width: 9999 })?.width).toBe(64)
  })
})

describe('régua', () => {
  it('com a ponta e sem ela (soltou o botão)', () => {
    const from = { x: 1, y: 2 }
    expect(parseRuler({ userId: 'u', mapId: 'm', from, to: { x: 3, y: 4 } })).toEqual({
      userId: 'u',
      mapId: 'm',
      from,
      to: { x: 3, y: 4 }
    })
    expect(parseRuler({ userId: 'u', mapId: 'm', from, to: null })?.to).toBeNull()
    expect(parseRuler({ userId: 'u', mapId: 'm', from, to: { x: 'a' } })).toBeNull()
    expect(parseRuler({ userId: 'u', mapId: 'm', from: null, to: null })).toBeNull()
  })
})

describe('ping e reação', () => {
  it('ping com o ponto do mapa', () => {
    expect(parsePing({ userId: 'u', mapId: 'm', x: 5, y: 6 })).toEqual({
      userId: 'u',
      mapId: 'm',
      point: { x: 5, y: 6 }
    })
    expect(parsePing({ userId: 'u', mapId: 'm', x: Infinity, y: 6 })).toBeNull()
  })

  it('só os emojis da lista', () => {
    expect(REACTIONS).toHaveLength(8)
    expect(isReaction('⚔️')).toBe(true)
    expect(isReaction('<b>')).toBe(false)
    expect(parseReaction({ userId: 'u', mapId: 'm', tokenId: 't', emoji: '🎉' })?.emoji).toBe('🎉')
    expect(parseReaction({ userId: 'u', mapId: 'm', tokenId: 't', emoji: '🍕' })).toBeNull()
  })
})

describe('desenhos apagados de uma vez', () => {
  it('"meus desenhos" leva o autor; "limpar todos", null', () => {
    expect(parseDrawingsCleared({ mapId: 'm', authorId: 'u' })).toEqual({ mapId: 'm', authorId: 'u' })
    expect(parseDrawingsCleared({ mapId: 'm', authorId: null })).toEqual({ mapId: 'm', authorId: null })
    expect(parseDrawingsCleared({ mapId: 'm' })).toBeNull()
  })
})

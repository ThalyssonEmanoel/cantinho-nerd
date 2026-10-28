import { describe, expect, it } from 'vitest'
import { createObjectContext } from '../formula'
import { detectOutcome, resolveCriticalRule } from './critical'
import type { RolledDie } from './types'

function die(sides: number, value: number, dropped = false): RolledDie {
  return { sides, value, dropped, exploded: false }
}

describe('detectOutcome — crítico natural', () => {
  const rule = { kind: 'natural' } as const

  it('d20 mantido 20 é crítico', () => {
    expect(detectOutcome([die(20, 20)], rule, true)).toBe('critical')
  })

  it('d20 mantido 19 não é crítico', () => {
    expect(detectOutcome([die(20, 19)], rule, true)).toBe('normal')
  })

  it('d20 mantido 1 é falha crítica quando a opção está ligada', () => {
    expect(detectOutcome([die(20, 1)], rule, true)).toBe('critical-failure')
    expect(detectOutcome([die(20, 1)], rule, false)).toBe('normal')
  })

  it('ignora o d20 descartado pela vantagem', () => {
    // 2d20kh1: o 20 foi descartado, vale o 7 que ficou.
    expect(detectOutcome([die(20, 20, true), die(20, 7)], rule, true)).toBe('normal')
    // 2d20kl1: o 1 descartado não vira falha crítica.
    expect(detectOutcome([die(20, 1, true), die(20, 12)], rule, true)).toBe('normal')
  })

  it('não olha dados que não são d20', () => {
    expect(detectOutcome([die(6, 6), die(6, 1)], rule, true)).toBe('normal')
    expect(detectOutcome([die(100, 100)], rule, true)).toBe('normal')
  })

  it('crítico ganha da falha crítica quando os dois caem juntos', () => {
    expect(detectOutcome([die(20, 20), die(20, 1)], rule, true)).toBe('critical')
  })
})

describe('detectOutcome — crítico por margem', () => {
  it('conta a partir do limiar', () => {
    const rule = { kind: 'margin', threshold: 19 } as const
    expect(detectOutcome([die(20, 19)], rule, false)).toBe('critical')
    expect(detectOutcome([die(20, 20)], rule, false)).toBe('critical')
    expect(detectOutcome([die(20, 18)], rule, false)).toBe('normal')
  })

  it('margem não resolvida não vira crítico', () => {
    const rule = { kind: 'margin', threshold: 'margem' } as const
    expect(detectOutcome([die(20, 20)], rule, false)).toBe('normal')
  })
})

describe('detectOutcome — sem regra', () => {
  it('nunca é crítico, mas a falha crítica continua valendo', () => {
    const rule = { kind: 'none' } as const
    expect(detectOutcome([die(20, 20)], rule, false)).toBe('normal')
    expect(detectOutcome([die(20, 20)], rule, true)).toBe('normal')
    expect(detectOutcome([die(20, 1)], rule, true)).toBe('critical-failure')
  })

  it('rolagem sem d20 é sempre normal', () => {
    expect(detectOutcome([], { kind: 'natural' }, true)).toBe('normal')
  })
})

describe('resolveCriticalRule', () => {
  const ficha = createObjectContext({ margem: 19, texto: 'abc' })

  it('calcula a margem que vem de um campo da ficha', () => {
    const result = resolveCriticalRule({ kind: 'margin', threshold: 'margem' }, ficha)
    expect(result).toEqual({ ok: true, value: { kind: 'margin', threshold: 19 } })
  })

  it('devolve a regra intacta quando já é número', () => {
    const rule = { kind: 'margin', threshold: 18 } as const
    expect(resolveCriticalRule(rule, ficha)).toEqual({ ok: true, value: rule })
  })

  it('reclama quando a margem não dá um número', () => {
    const result = resolveCriticalRule({ kind: 'margin', threshold: 'texto' }, ficha)
    expect(result.ok).toBe(false)
  })

  it('reclama quando o campo da margem não existe', () => {
    const result = resolveCriticalRule({ kind: 'margin', threshold: 'xyz' }, ficha)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown-reference')
  })
})

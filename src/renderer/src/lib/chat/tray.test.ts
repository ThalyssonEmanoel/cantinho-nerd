import { describe, expect, it } from 'vitest'
import {
  addDie,
  advantageNotation,
  DEFAULT_DICE_RULES,
  diceRulesFromSettings,
  isPoolEmpty,
  MAX_DICE_PER_KIND,
  poolNotation
} from './tray'

describe('bandeja', () => {
  it('dois cliques no d6 viram 2d6 (7.1)', () => {
    const pool = addDie(addDie({}, 6), 6)
    expect(poolNotation(pool)).toBe('2d6')
  })

  it('junta dados diferentes do menor para o maior, com o modificador no fim', () => {
    const pool = addDie(addDie(addDie({}, 20), 6), 6)
    expect(poolNotation(pool, 3)).toBe('2d6 + 1d20 + 3')
    expect(poolNotation(pool, -2)).toBe('2d6 + 1d20 - 2')
  })

  it('tirar até zerar remove o dado', () => {
    const pool = addDie(addDie({}, 8), 8, -1)
    expect(isPoolEmpty(pool)).toBe(true)
    expect(poolNotation(pool, 5)).toBe('')
  })

  it('tem teto por dado', () => {
    expect(addDie({}, 6, 500)[6]).toBe(MAX_DICE_PER_KIND)
  })

  it('o d100 sai como 1d100, que a biblioteca entende', () => {
    expect(poolNotation(addDie({}, 100))).toBe('1d100')
  })
})

describe('vantagem e desvantagem', () => {
  it('dois d20, fica com o maior ou o menor', () => {
    expect(advantageNotation('advantage')).toBe('2d20kh1')
    expect(advantageNotation('disadvantage', 4)).toBe('2d20kl1 + 4')
  })
})

describe('regra de crítico da mesa', () => {
  it('sem nada configurado: natural 20 e falha no 1', () => {
    expect(diceRulesFromSettings({})).toEqual(DEFAULT_DICE_RULES)
    expect(diceRulesFromSettings(null)).toEqual(DEFAULT_DICE_RULES)
  })

  it('lê margem e falha crítica desligada', () => {
    expect(
      diceRulesFromSettings({
        dice: { critical: { kind: 'margin', threshold: 19 }, criticalFailureOnOne: false }
      })
    ).toEqual({ critical: { kind: 'margin', threshold: 19 }, criticalFailureOnOne: false })
  })

  it('limiar absurdo é trazido para dentro do d20', () => {
    const rules = diceRulesFromSettings({ dice: { critical: { kind: 'margin', threshold: 99 } } })
    expect(rules.critical).toEqual({ kind: 'margin', threshold: 20 })
  })

  it('valor estranho volta ao padrão', () => {
    expect(diceRulesFromSettings({ dice: { critical: { kind: 'chute' } } }).critical).toEqual({
      kind: 'natural'
    })
  })
})

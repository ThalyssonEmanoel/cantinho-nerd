import { describe, expect, it } from 'vitest'
import {
  conditionKey,
  conditionListProblem,
  conditionsFromSettings,
  conditionsToSettings,
  DEFAULT_CONDITIONS,
  MAX_CONDITIONS,
  normalizeRounds,
  parseTokenConditions,
  setConditionRounds,
  tickConditions,
  toggleCondition,
  type TokenCondition
} from './conditions'

describe('lista da mesa', () => {
  it('sem lista salva, vale a padrão', () => {
    expect(conditionsFromSettings({})).toEqual(DEFAULT_CONDITIONS)
    expect(conditionsFromSettings(null)).toEqual(DEFAULT_CONDITIONS)
  })

  it('lista salva vazia é do mestre: nenhuma condição', () => {
    expect(conditionsFromSettings({ conditions: [] })).toEqual([])
  })

  it('descarta item torto, repetido e o que passa do teto', () => {
    const many = Array.from({ length: MAX_CONDITIONS + 5 }, (_, index) => ({
      name: `Cond ${index}`,
      icon: '⭐'
    }))
    expect(conditionsFromSettings({ conditions: many })).toHaveLength(MAX_CONDITIONS)

    const list = conditionsFromSettings({
      conditions: [
        { name: 'Caído', icon: '🔻' },
        { name: 'caido', icon: '⬇️' },
        { name: '', icon: '❓' },
        { name: 'Sem ícone', icon: '' },
        'texto solto'
      ]
    })
    expect(list).toEqual([{ key: 'caido', name: 'Caído', icon: '🔻' }])
  })

  it('a chave sai do nome, sem acento', () => {
    expect(conditionKey('Enfeitiçado')).toBe('enfeiticado')
    expect(conditionKey('  Sob Efeito de Magia! ')).toBe('sob_efeito_de_magia')
  })

  it('o editor avisa o que impede salvar', () => {
    expect(conditionListProblem([{ key: '', name: ' ', icon: '⭐' }])).toMatch(/nome/)
    expect(conditionListProblem([{ key: '', name: 'Caído', icon: '' }])).toMatch(/ícone/)
    expect(
      conditionListProblem([
        { key: '', name: 'Caído', icon: '🔻' },
        { key: '', name: 'caído', icon: '⬇️' }
      ])
    ).toMatch(/duas condições/)
    expect(conditionListProblem(DEFAULT_CONDITIONS)).toBeNull()
  })

  it('ao salvar, a chave é refeita a partir do nome', () => {
    expect(conditionsToSettings([{ key: 'velha', name: ' Sangrando ', icon: ' 🩸 ' }])).toEqual([
      { key: 'sangrando', name: 'Sangrando', icon: '🩸' }
    ])
  })
})

describe('condições no token', () => {
  const stunned = { key: 'atordoado', name: 'Atordoado', icon: '💫' }

  it('liga e desliga, entrando sem duração', () => {
    const on = toggleCondition([], stunned)
    expect(on).toEqual([{ ...stunned, rounds: null }])
    expect(toggleCondition(on, stunned)).toEqual([])
  })

  it('duração: inteiro de 1 a 99; o resto é "sem duração"', () => {
    expect(normalizeRounds(3)).toBe(3)
    expect(normalizeRounds('2,7')).toBe(2)
    expect(normalizeRounds(500)).toBe(99)
    expect(normalizeRounds(0)).toBeNull()
    expect(normalizeRounds('')).toBeNull()
    expect(normalizeRounds('abc')).toBeNull()

    const list = setConditionRounds([{ ...stunned, rounds: null }], 'atordoado', '2')
    expect(list[0]?.rounds).toBe(2)
  })

  it('lê o jsonb do banco sem confiar nele', () => {
    expect(
      parseTokenConditions([
        { key: 'atordoado', name: 'Atordoado', icon: '💫', rounds: 2 },
        { key: 'x', name: '', icon: '?' },
        { name: 'Caído', icon: '🔻', rounds: 'muitas' }
      ])
    ).toEqual([
      { key: 'atordoado', name: 'Atordoado', icon: '💫', rounds: 2 },
      { key: 'caido', name: 'Caído', icon: '🔻', rounds: null }
    ])
    expect(parseTokenConditions('lixo')).toEqual([])
  })

  it('no fim do turno, cada duração perde uma rodada e a de 1 sai (como no banco)', () => {
    const list: TokenCondition[] = [
      { ...stunned, rounds: 1 },
      { key: 'caido', name: 'Caído', icon: '🔻', rounds: null },
      { key: 'envenenado', name: 'Envenenado', icon: '🤢', rounds: 3 }
    ]
    expect(tickConditions(list).map((item) => [item.key, item.rounds])).toEqual([
      ['caido', null],
      ['envenenado', 2]
    ])
  })
})

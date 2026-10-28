import { describe, expect, it, vi } from 'vitest'
import { createObjectContext } from '../formula'
import { diceEngines } from './rng'
import { rollFormula } from './roll'
import type { RollOptions, RollSummary } from './types'

const ficha = createObjectContext({
  agilidade: 0,
  forca: { value: 15, mod: 2 },
  margem: 19,
  pericias: [{ key: 'furtividade', total: 7 }]
})

function rollOf(source: string, options: RollOptions = {}): RollSummary {
  const result = rollFormula(source, options)
  if (!result.ok) throw new Error(`esperava sucesso, veio: ${result.error.message}`)
  return result.roll
}

describe('rollFormula — dados e descartes', () => {
  it('rola 1d20 e devolve o dado, o total e o detalhe', () => {
    const roll = rollOf('1d20', { engine: diceEngines.max })
    expect(roll.total).toBe(20)
    expect(roll.dice).toEqual([{ sides: 20, value: 20, dropped: false, exploded: false }])
    expect(roll.notation).toBe('1d20')
    expect(roll.detail).toContain('1d20')
  })

  it('soma o modificador fixo', () => {
    expect(rollOf('1d20+5', { engine: diceEngines.max }).total).toBe(25)
    expect(rollOf('2d6+3', { engine: diceEngines.min }).total).toBe(5)
  })

  it('marca os dados descartados em 4d6kh3', () => {
    const roll = rollOf('4d6kh3', { engine: diceEngines.max })
    expect(roll.dice).toHaveLength(4)
    expect(roll.dice.filter((die) => die.dropped)).toHaveLength(1)
    expect(roll.total).toBe(18)
  })

  it('marca o descartado em 2d20kl1', () => {
    const roll = rollOf('2d20kl1', { engine: diceEngines.max })
    expect(roll.dice).toHaveLength(2)
    expect(roll.dice.filter((die) => die.dropped)).toHaveLength(1)
    expect(roll.total).toBe(20)
  })

  it('guarda os lados certos quando há grupos diferentes', () => {
    const roll = rollOf('1d20+2d4kh1', { engine: diceEngines.max })
    expect(roll.dice.map((die) => die.sides)).toEqual([20, 4, 4])
  })

  it('aceita d20 sem quantidade e d100', () => {
    expect(rollOf('d20', { engine: diceEngines.max }).total).toBe(20)
    expect(rollOf('1d100', { engine: diceEngines.max }).total).toBe(100)
  })

  it('rola dado explosivo sem travar', () => {
    const roll = rollOf('3d6!', { engine: diceEngines.seeded(42) })
    expect(roll.dice.length).toBeGreaterThanOrEqual(3)
    expect(roll.total).toBeGreaterThanOrEqual(3)
  })
})

describe('rollFormula — fórmulas com {…}', () => {
  it('calcula as chaves antes de rolar', () => {
    const roll = rollOf('1d20 + {forca.mod} + {pericias.furtividade.total}', {
      engine: diceEngines.max,
      context: ficha
    })
    expect(roll.notation).toBe('1d20 + 2 + 7')
    expect(roll.total).toBe(29)
    expect(roll.source).toBe('1d20 + {forca.mod} + {pericias.furtividade.total}')
  })

  it('monta 3d20kh1 a partir do atributo', () => {
    const agil = createObjectContext({ agilidade: 3 })
    const roll = rollOf('{agilidade}d20kh1', { engine: diceEngines.max, context: agil })
    expect(roll.notation).toBe('3d20kh1')
    expect(roll.dice).toHaveLength(3)
    expect(roll.dice.filter((die) => die.dropped)).toHaveLength(2)
  })

  it('atributo 0 rola 2d20 e fica com o pior', () => {
    const source = '{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}'
    const roll = rollOf(source, { engine: diceEngines.min, context: ficha })
    expect(roll.notation).toBe('2d20kl1')
    expect(roll.total).toBe(1)
  })

  it('erro na chave não lança, volta como resultado', () => {
    expect(() => rollFormula('1d20 + {xyz}', { context: ficha })).not.toThrow()
    const result = rollFormula('1d20 + {xyz}', { context: ficha })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown-reference')
  })
})

describe('rollFormula — crítico', () => {
  it('natural 20 é crítico e natural 1 é falha crítica', () => {
    const options = { critical: { kind: 'natural' } as const, criticalFailureOnOne: true }
    expect(rollOf('1d20', { ...options, engine: diceEngines.max }).outcome).toBe('critical')
    expect(rollOf('1d20', { ...options, engine: diceEngines.min }).outcome).toBe('critical-failure')
  })

  it('sem regra de crítico, 20 é resultado normal', () => {
    expect(rollOf('1d20', { engine: diceEngines.max }).outcome).toBe('normal')
  })

  it('margem vinda de um campo da ficha', () => {
    const roll = rollOf('1d20', {
      engine: diceEngines.max,
      critical: { kind: 'margin', threshold: 'margem' },
      context: ficha
    })
    expect(roll.outcome).toBe('critical')
  })

  it('margem que não existe na ficha volta como erro', () => {
    const result = rollFormula('1d20', {
      engine: diceEngines.max,
      critical: { kind: 'margin', threshold: 'nao_existe' },
      context: ficha
    })
    expect(result.ok).toBe(false)
  })
})

describe('rollFormula — erros e geradores', () => {
  it('notação inválida volta como erro, sem lançar', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const bad of ['2d', 'abc', '1d20++', '1d20 + ']) {
      expect(() => rollFormula(bad)).not.toThrow()
      const result = rollFormula(bad)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('notation')
    }
    spy.mockRestore()
  })

  it('leva o rótulo adiante, para o chat', () => {
    const roll = rollOf('1d20', { engine: diceEngines.max, label: 'Furtividade' })
    expect(roll.label).toBe('Furtividade')
  })

  it('gerador com semente repete a mesma sequência', () => {
    // Uma sequência de dez rolagens, e não um total só: dois totais iguais por coincidência
    // acontecem, dez rolagens iguais não.
    const sequence = (seed: number): string => {
      const engine = diceEngines.seeded(seed)
      return Array.from({ length: 10 }, () => rollOf('1d20', { engine }).total).join(',')
    }

    expect(sequence(123)).toBe(sequence(123))
    expect(sequence(999)).not.toBe(sequence(123))
  })

  it('o gerador padrão é o criptográfico e devolve valores válidos', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const roll = rollOf('1d20')
      expect(roll.total).toBeGreaterThanOrEqual(1)
      expect(roll.total).toBeLessThanOrEqual(20)
    }
  })

  it('não vaza o gerador de teste para a rolagem seguinte', () => {
    rollOf('1d20', { engine: diceEngines.max })
    const totals = new Set<number>()
    for (let attempt = 0; attempt < 30; attempt += 1) totals.add(rollOf('1d20').total)
    // Se o gerador 'max' tivesse ficado, todos os totais seriam 20.
    expect(totals.size).toBeGreaterThan(1)
  })
})

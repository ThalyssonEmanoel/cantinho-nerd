import { describe, expect, it } from 'vitest'
import { createObjectContext } from './context'
import {
  collectComputedValues,
  collectReferencedKeys,
  evaluateEntries,
  planEvaluation,
  type FormulaEntry
} from './dependencies'
import { parseFormula } from './parser'

function keysOf(formula: string): string[] {
  const parsed = parseFormula(formula)
  if (!parsed.ok) throw new Error('fórmula de teste inválida')
  return collectReferencedKeys(parsed.value)
}

describe('collectReferencedKeys', () => {
  it('pega a chave do componente, não o caminho inteiro', () => {
    expect(keysOf('=forca.mod + vida.max')).toEqual(['forca', 'vida'])
    expect(keysOf('=pericias.furtividade.total')).toEqual(['pericias'])
  })

  it('entra em funções e operadores', () => {
    expect(keysOf('=se(treinado, soma(inventario.peso), nivel)')).toEqual([
      'treinado',
      'inventario',
      'nivel'
    ])
  })

  it('não repete chave', () => {
    expect(keysOf('=forca + forca.mod')).toEqual(['forca'])
  })
})

describe('planEvaluation', () => {
  it('ordena do que não depende de nada para o que depende', () => {
    const entries: FormulaEntry[] = [
      { key: 'ataque', formula: '=bonus + 1' },
      { key: 'bonus', formula: '=base * 2' },
      { key: 'base', formula: '=3' }
    ]
    const plan = planEvaluation(entries)
    expect(plan.order).toEqual(['base', 'bonus', 'ataque'])
    expect(plan.cyclic).toEqual([])
    expect(plan.cycle).toBeNull()
  })

  it('ignora referências a campos que não são calculados (são entradas da ficha)', () => {
    const plan = planEvaluation([{ key: 'defesa', formula: '=10 + agilidade.mod' }])
    expect(plan.order).toEqual(['defesa'])
    expect(plan.cyclic).toEqual([])
  })

  it('detecta o ciclo a = b + 1, b = a + 1', () => {
    const plan = planEvaluation([
      { key: 'a', formula: '=b + 1' },
      { key: 'b', formula: '=a + 1' }
    ])
    expect(plan.order).toEqual([])
    expect(plan.cyclic).toEqual(['a', 'b'])
    expect(plan.cycle).toEqual(['a', 'b', 'a'])
  })

  it('detecta campo que depende de si mesmo', () => {
    const plan = planEvaluation([{ key: 'a', formula: '=a + 1' }])
    expect(plan.cyclic).toEqual(['a'])
    expect(plan.cycle).toEqual(['a', 'a'])
  })

  it('separa o que está em ciclo do que ainda dá para calcular', () => {
    const plan = planEvaluation([
      { key: 'a', formula: '=b' },
      { key: 'b', formula: '=a' },
      { key: 'livre', formula: '=1 + 1' }
    ])
    expect(plan.order).toEqual(['livre'])
    expect(plan.cyclic).toEqual(['a', 'b'])
  })
})

describe('evaluateEntries', () => {
  const ficha = createObjectContext({
    forca: { value: 15, mod: 2 },
    nivel: 3,
    inventario: [{ peso: 2 }, { peso: 3 }]
  })

  it('deixa um campo calculado ver o resultado de outro', () => {
    const results = evaluateEntries(
      [
        { key: 'ataque', formula: '=bonus + forca.mod' },
        { key: 'bonus', formula: '=nivel * 2' }
      ],
      ficha
    )

    expect(results.get('bonus')).toEqual({ ok: true, value: 6 })
    expect(results.get('ataque')).toEqual({ ok: true, value: 8 })
  })

  it('devolve erro de ciclo para os campos envolvidos', () => {
    const results = evaluateEntries(
      [
        { key: 'a', formula: '=b + 1' },
        { key: 'b', formula: '=a + 1' }
      ],
      ficha
    )

    const a = results.get('a')
    expect(a?.ok).toBe(false)
    if (a !== undefined && !a.ok) {
      expect(a.error.code).toBe('cycle')
      expect(a.error.message).toContain('a → b → a')
    }
    expect(results.get('b')?.ok).toBe(false)
  })

  it('avisa quem só depende de um campo em ciclo', () => {
    const results = evaluateEntries(
      [
        { key: 'a', formula: '=b' },
        { key: 'b', formula: '=a' },
        { key: 'depende', formula: '=a + 1' }
      ],
      ficha
    )

    const depende = results.get('depende')
    expect(depende?.ok).toBe(false)
    if (depende !== undefined && !depende.ok) {
      expect(depende.error.code).toBe('cycle')
      expect(depende.error.message).toContain('Depende de um campo')
    }
  })

  it('um campo com erro não derruba os outros', () => {
    const results = evaluateEntries(
      [
        { key: 'quebrado', formula: '=1 +' },
        { key: 'inteiro', formula: '=soma(inventario.peso)' }
      ],
      ficha
    )

    expect(results.get('quebrado')?.ok).toBe(false)
    expect(results.get('inteiro')).toEqual({ ok: true, value: 5 })
  })

  it('collectComputedValues entrega só o que calculou', () => {
    const results = evaluateEntries(
      [
        { key: 'ok', formula: '=2 + 2' },
        { key: 'ruim', formula: '=1 / 0' }
      ],
      ficha
    )

    expect([...collectComputedValues(results)]).toEqual([['ok', 4]])
  })
})

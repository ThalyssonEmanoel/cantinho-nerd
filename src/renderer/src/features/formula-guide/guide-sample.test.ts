import { describe, expect, it } from 'vitest'
import { validateSchema } from '@/lib/sheet'
import {
  ARITHMETIC_EXAMPLES,
  ATTRIBUTE_EXAMPLES,
  BAR_EXAMPLES,
  describeValue,
  ERROR_EXAMPLES,
  evaluateExample,
  evaluateGuideFormula,
  FUNCTION_EXAMPLES,
  GUIDE_SCHEMA,
  interpolateGuideRoll,
  LOGIC_EXAMPLES,
  RECIPE_EXAMPLES,
  REFERENCE_EXAMPLES,
  ROLL_EXAMPLES,
  TABLE_EXAMPLES,
  VISIBILITY_EXAMPLES
} from './guide-sample'

/**
 * O guia promete um resultado ao lado de cada fórmula. Este teste roda todas no motor de
 * verdade: se o motor mudar e o texto do guia ficar errado, quebra aqui, e não na mão do
 * mestre.
 */

const FORMULA_EXAMPLES = [
  ...ARITHMETIC_EXAMPLES,
  ...REFERENCE_EXAMPLES,
  ...FUNCTION_EXAMPLES,
  ...LOGIC_EXAMPLES,
  ...RECIPE_EXAMPLES,
  ...ATTRIBUTE_EXAMPLES,
  ...BAR_EXAMPLES,
  ...TABLE_EXAMPLES,
  ...VISIBILITY_EXAMPLES
]

describe('ficha de exemplo do guia', () => {
  it('é um modelo válido, sem erros de validação', () => {
    expect(validateSchema(GUIDE_SCHEMA).errors).toEqual([])
  })
})

describe('exemplos de fórmula', () => {
  it.each(FORMULA_EXAMPLES.map((example) => [example.formula, example] as const))(
    '%s',
    (_formula, example) => {
      const result = evaluateExample(example)
      expect(result).toEqual({ ok: true, value: example.expected })
    }
  )
})

describe('exemplos de rolagem', () => {
  it.each(ROLL_EXAMPLES.map((example) => [example.formula, example] as const))(
    '%s',
    (_formula, example) => {
      const result = interpolateGuideRoll(example.formula, {
        overrides: example.overrides,
        row: example.row
      })
      expect(result).toEqual({ ok: true, value: example.expected })
    }
  )
})

describe('exemplos de erro', () => {
  it.each(ERROR_EXAMPLES.map((example) => [example.formula, example] as const))(
    '%s',
    (_formula, example) => {
      const result = evaluateGuideFormula(example.formula)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain(example.expectedMessage)
    }
  )
})

describe('describeValue', () => {
  it('mostra os valores do jeito que o guia explica', () => {
    expect(describeValue(2.5)).toBe('2,5')
    expect(describeValue(true)).toBe('verdadeiro (vale 1)')
    expect(describeValue('Ocultista')).toBe('"Ocultista"')
    expect(describeValue(0.1 + 0.2)).toBe('0,3')
  })
})

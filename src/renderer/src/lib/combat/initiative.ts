import { rollFormula, type DiceEngine } from '@/lib/dice'
import { allComponents, createSheetContext, type SheetSchema, type SheetValues } from '@/lib/sheet'

/**
 * Iniciativa pelo papel `initiative` da ficha (5.6, 7.3). O app não sabe a regra de
 * nenhum sistema: o modelo diz como se rola.
 *
 * - Botão de rolagem com o papel: rola a fórmula dele (`1d20 + {destreza.mod}`).
 * - Número ou campo calculado com o papel: é o bônus, e rola `1d20 + bônus`.
 * - Sem ficha, ou ficha sem o papel: `1d20`.
 */

export const DEFAULT_INITIATIVE_FORMULA = '1d20'

export function initiativeFormula(schema: SheetSchema | null): string {
  if (schema === null) return DEFAULT_INITIATIVE_FORMULA
  const component = allComponents(schema).find((item) => item.role === 'initiative')
  if (component === undefined) return DEFAULT_INITIATIVE_FORMULA

  switch (component.type) {
    case 'rollButton':
      return component.formula.trim() === '' ? DEFAULT_INITIATIVE_FORMULA : component.formula
    case 'number':
    case 'computed':
      return `1d20 + {${component.key}}`
    default:
      return DEFAULT_INITIATIVE_FORMULA
  }
}

export type InitiativeRoll =
  | { ok: true; value: number; notation: string }
  | { ok: false; error: string }

/** Rola a iniciativa de uma ficha (ou de quem não tem ficha, com `schema` null). */
export function rollInitiative(
  schema: SheetSchema | null,
  values: SheetValues,
  engine?: DiceEngine
): InitiativeRoll {
  const formula = initiativeFormula(schema)
  const context = schema === null ? undefined : createSheetContext(schema, values).context
  const result = rollFormula(formula, {
    label: 'Iniciativa',
    ...(context === undefined ? {} : { context }),
    ...(engine === undefined ? {} : { engine })
  })
  if (!result.ok) return { ok: false, error: result.error.message }
  return { ok: true, value: result.roll.total, notation: result.roll.notation }
}

import { evaluateFormula, toNumber, type FormulaContext, type FormulaResult } from '../formula'
import type { CriticalRule, RollOutcome, RolledDie } from './types'

/** O crítico é sempre decidido no d20, como manda a especificação (5.5). */
export const CRITICAL_DIE_SIDES = 20

/**
 * Decide crítico / falha crítica olhando só os **d20 mantidos**: num `2d20kh1` o dado
 * descartado pela vantagem não vale. Função pura, para dar para testar sem rolar nada.
 *
 * Quando os dois acontecem na mesma rolagem (ex.: `2d20` sem descarte, com um 20 e um 1),
 * o crítico ganha — é o resultado mais notável da jogada.
 */
export function detectOutcome(
  dice: readonly RolledDie[],
  rule: CriticalRule,
  criticalFailureOnOne: boolean
): RollOutcome {
  const kept = dice.filter((die) => !die.dropped && die.sides === CRITICAL_DIE_SIDES)
  if (kept.length === 0) return 'normal'

  const threshold = criticalThreshold(rule)
  if (threshold !== null && kept.some((die) => die.value >= threshold)) return 'critical'
  if (criticalFailureOnOne && kept.some((die) => die.value === 1)) return 'critical-failure'

  return 'normal'
}

/** Valor a partir do qual o d20 é crítico, ou null quando não há regra. */
function criticalThreshold(rule: CriticalRule): number | null {
  switch (rule.kind) {
    case 'none':
      return null
    case 'natural':
      return CRITICAL_DIE_SIDES
    case 'margin':
      return typeof rule.threshold === 'number' ? rule.threshold : null
  }
}

/**
 * Troca o limiar de margem escrito como fórmula (ex.: `margem`) pelo número da ficha.
 * A rolagem chama isto antes de `detectOutcome`, que já espera o limiar resolvido.
 */
export function resolveCriticalRule(
  rule: CriticalRule,
  context: FormulaContext
): FormulaResult<CriticalRule> {
  if (rule.kind !== 'margin' || typeof rule.threshold === 'number') {
    return { ok: true, value: rule }
  }

  const evaluated = evaluateFormula(rule.threshold, context)
  if (!evaluated.ok) return evaluated

  try {
    return { ok: true, value: { kind: 'margin', threshold: toNumber(evaluated.value) } }
  } catch {
    return {
      ok: false,
      error: { code: 'type', message: 'A margem de crítico não é um número.' }
    }
  }
}

import { evaluateFormula, toNumber, type FormulaContext } from '../formula'
import { canEditComponent, type SheetAudience } from './permissions'
import { findComponentByKey, type RollCost, type SheetSchema } from './types'
import { isResourceValue, type SheetValue, type SheetValues } from './values'

/**
 * O que um botão de rolagem desconta da ficha ao ser usado (`RollCost`): a energia de uma
 * habilidade, uma poção da mochila.
 *
 * Faltou recurso, a rolagem acontece do mesmo jeito e o alvo vai a 0 — decisão do Thalysson:
 * quem decide o que vale é o mestre, que vê no chat que faltou. Por isso a conta devolve
 * quanto faltou, para o rótulo da rolagem contar.
 */

export interface RollCharge {
  /** Componente que muda (a barra ou o número). */
  componentId: string
  /** Valor novo, no formato que o campo guarda. */
  value: SheetValue
  /** Quanto a rolagem pedia. */
  amount: number
  /** Quanto faltou (0 quando havia o bastante). */
  missing: number
  /** Rótulo do alvo, para o aviso no chat ("Energia (PE)"). */
  targetLabel: string
}

/** Chave do alvo, aceitando o `=` que o mestre pode ter digitado por hábito. */
export function rollCostTargetKey(cost: RollCost): string {
  return cost.target.trim().replace(/^=/, '').trim()
}

/**
 * Calcula o desconto. Devolve `null` quando não há o que fazer: alvo que não existe ou não é
 * barra/número, quem rola não pode editar o alvo, fórmula com erro, ou quantidade 0 ou
 * negativa (uma habilidade não escolhida, por exemplo, pode valer 0 de propósito).
 *
 * `context` é o da linha quando o botão está numa tabela: é ele que deixa `=pe` funcionar.
 */
export function planRollCost(
  schema: SheetSchema,
  values: SheetValues,
  cost: RollCost,
  context: FormulaContext,
  audience: SheetAudience
): RollCharge | null {
  const target = findComponentByKey(schema, rollCostTargetKey(cost))
  if (target === undefined || (target.type !== 'resource' && target.type !== 'number')) return null
  if (!canEditComponent(target, audience)) return null

  const result = evaluateFormula(cost.amount, context)
  if (!result.ok) return null
  let amount: number
  try {
    amount = toNumber(result.value)
  } catch {
    return null
  }
  if (!Number.isFinite(amount) || amount <= 0) return null

  const raw = values[target.id]

  if (target.type === 'resource') {
    const current = isResourceValue(raw) ? raw.current : 0
    const next = Math.max(0, current - amount)
    const value = isResourceValue(raw)
      ? { ...raw, current: next }
      : { current: next, ...(target.maxValue === undefined ? {} : { max: target.maxValue }) }
    return { componentId: target.id, value, amount, missing: Math.max(0, amount - current), targetLabel: target.label }
  }

  const current = typeof raw === 'number' && Number.isFinite(raw) ? raw : (target.defaultValue ?? 0)
  return {
    componentId: target.id,
    value: Math.max(0, current - amount),
    amount,
    missing: Math.max(0, amount - current),
    targetLabel: target.label
  }
}

/** Rótulo da rolagem quando faltou recurso: o mestre vê no chat e decide. */
export function labelWithMissing(label: string, charge: RollCharge): string {
  if (charge.missing <= 0) return label
  const verb = charge.missing === 1 ? 'faltou' : 'faltaram'
  return `${label} (${verb} ${charge.missing} de ${charge.targetLabel})`
}

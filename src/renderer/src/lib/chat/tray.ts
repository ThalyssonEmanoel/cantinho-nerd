import {
  DEFAULT_CRITICAL_FAILURE_ON_ONE,
  DEFAULT_CRITICAL_RULE,
  type CriticalRule
} from '@/lib/dice'

/**
 * Bandeja de dados (seção 7.1). Clicar num dado monta a rolagem: dois cliques no d6 viram
 * `2d6`, e o modificador entra no fim. Funções puras: a tela só guarda o estado.
 */

export const TRAY_DICE = [4, 6, 8, 10, 12, 20, 100] as const
export type TrayDie = (typeof TRAY_DICE)[number]

/** Quantos de cada dado estão na bandeja. */
export type DicePool = Partial<Record<TrayDie, number>>

/** Limite por dado: mais que isso é clique sem querer, e a biblioteca rola devagar. */
export const MAX_DICE_PER_KIND = 99

export function addDie(pool: DicePool, sides: TrayDie, amount = 1): DicePool {
  const next = Math.min(MAX_DICE_PER_KIND, Math.max(0, (pool[sides] ?? 0) + amount))
  const copy = { ...pool }
  if (next === 0) delete copy[sides]
  else copy[sides] = next
  return copy
}

export function isPoolEmpty(pool: DicePool): boolean {
  return Object.values(pool).every((count) => (count ?? 0) === 0)
}

function modifierText(modifier: number): string {
  if (!Number.isFinite(modifier) || modifier === 0) return ''
  return modifier > 0 ? ` + ${Math.trunc(modifier)}` : ` - ${Math.abs(Math.trunc(modifier))}`
}

/** `{ 6: 2, 20: 1 }` + 3 → `2d6 + 1d20 + 3`. Vazia (e sem modificador) → `''`. */
export function poolNotation(pool: DicePool, modifier = 0): string {
  const parts = TRAY_DICE.flatMap((sides) => {
    const count = pool[sides] ?? 0
    return count > 0 ? [`${count}d${sides}`] : []
  })
  if (parts.length === 0) return ''
  return parts.join(' + ') + modifierText(modifier)
}

/**
 * Vantagem e desvantagem rápidas (7.1): dois d20, fica com o maior (ou o menor), mais o
 * modificador da bandeja.
 */
export function advantageNotation(kind: 'advantage' | 'disadvantage', modifier = 0): string {
  return `2d20${kind === 'advantage' ? 'kh1' : 'kl1'}${modifierText(modifier)}`
}

export interface DiceRules {
  critical: CriticalRule
  criticalFailureOnOne: boolean
}

/** Padrão da bandeja: natural 20 e falha crítica no 1, configurável na sessão (5.5). */
export const DEFAULT_DICE_RULES: DiceRules = {
  critical: DEFAULT_CRITICAL_RULE,
  criticalFailureOnOne: DEFAULT_CRITICAL_FAILURE_ON_ONE
}

/**
 * Regra de crítico da bandeja guardada em `sessions.settings.dice`. Dado estranho volta ao
 * padrão em vez de quebrar a mesa.
 */
export function diceRulesFromSettings(settings: unknown): DiceRules {
  if (typeof settings !== 'object' || settings === null) return DEFAULT_DICE_RULES
  const dice = (settings as Record<string, unknown>).dice
  if (typeof dice !== 'object' || dice === null) return DEFAULT_DICE_RULES

  const raw = dice as Record<string, unknown>
  const failure =
    typeof raw.criticalFailureOnOne === 'boolean'
      ? raw.criticalFailureOnOne
      : DEFAULT_DICE_RULES.criticalFailureOnOne

  const critical = raw.critical as { kind?: unknown; threshold?: unknown } | undefined
  if (critical?.kind === 'none')
    return { critical: { kind: 'none' }, criticalFailureOnOne: failure }
  if (critical?.kind === 'margin' && typeof critical.threshold === 'number') {
    const threshold = Math.min(20, Math.max(2, Math.trunc(critical.threshold)))
    return { critical: { kind: 'margin', threshold }, criticalFailureOnOne: failure }
  }
  return { critical: { kind: 'natural' }, criticalFailureOnOne: failure }
}

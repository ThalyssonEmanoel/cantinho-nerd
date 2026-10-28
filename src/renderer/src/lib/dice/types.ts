import type { FormulaContext, FormulaError } from '../formula'
import type { DiceEngine } from './rng'

/**
 * Regra de crítico do botão de rolagem (seção 5.5). Olha sempre o **d20 mantido**: num
 * `2d20kh1` o dado descartado não conta.
 */
export type CriticalRule =
  | { kind: 'none' }
  /** Natural: d20 mantido igual a 20. */
  | { kind: 'natural' }
  /**
   * Margem: d20 mantido maior ou igual ao limiar. O limiar pode ser um número ou uma
   * fórmula (ex.: `margem`), porque em alguns sistemas ele vem de um campo da ficha.
   */
  | { kind: 'margin'; threshold: number | string }

export interface RolledDie {
  /** Lados do dado: 20, 6, '%' (percentual), 'F' (fudge). */
  sides: number | string
  value: number
  /** Descartado por kh/kl/dh/dl — a interface mostra riscado. */
  dropped: boolean
  /** Resultado que veio de explosão (`3d6!`). */
  exploded: boolean
}

export type RollOutcome = 'critical' | 'critical-failure' | 'normal'

export interface RollSummary {
  /** Rótulo do botão, para o chat: "Furtividade: 17". */
  label?: string
  /** Notação como o mestre escreveu, com os `{…}`. */
  source: string
  /** Notação depois de calcular os `{…}` — é essa que foi rolada. */
  notation: string
  total: number
  dice: RolledDie[]
  outcome: RollOutcome
  /** Detalhe legível da biblioteca: `4d6kh3: [2d, 3, 4, 5] = 12`. */
  detail: string
}

export type DiceRollResult = { ok: true; roll: RollSummary } | { ok: false; error: FormulaError }

export interface RollOptions {
  label?: string
  /** Padrão: nenhuma regra de crítico. A bandeja de dados usa o padrão da sessão. */
  critical?: CriticalRule
  /** Falha crítica quando o d20 mantido é 1. */
  criticalFailureOnOne?: boolean
  /** Valores da ficha, para calcular os `{…}`. */
  context?: FormulaContext
  /** Gerador aleatório. Padrão: criptográfico. Nos testes, injete um determinístico. */
  engine?: DiceEngine
}

/** Padrão da bandeja de dados livre: natural 20 e falha crítica no 1 (seção 5.5). */
export const DEFAULT_CRITICAL_RULE: CriticalRule = { kind: 'natural' }
export const DEFAULT_CRITICAL_FAILURE_ON_ONE = true

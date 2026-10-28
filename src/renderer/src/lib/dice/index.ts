/**
 * Motor de dados (seção 5.5). Ponto único de entrada: o resto do app importa daqui.
 */
export type {
  CriticalRule,
  DiceRollResult,
  RollOptions,
  RollOutcome,
  RollSummary,
  RolledDie
} from './types'
export { DEFAULT_CRITICAL_FAILURE_ON_ONE, DEFAULT_CRITICAL_RULE } from './types'

export type { DiceEngine } from './rng'
export { createCryptoEngine, createSeededEngine, diceEngines, withEngine } from './rng'

export { CRITICAL_DIE_SIDES, detectOutcome, resolveCriticalRule } from './critical'
export { interpolateRollFormula } from './interpolate'
export { rollFormula, validateRollNotation } from './roll'

/**
 * Combate (seção 7.3). Ponto único de entrada: o resto do app importa daqui.
 */
export * from './types'
export { byTurnOrder, currentEntry, entryLabel, isMyTurn, moveEntry } from './order'
export type { InitiativeRoll } from './initiative'
export { DEFAULT_INITIATIVE_FORMULA, initiativeFormula, rollInitiative } from './initiative'
export { describeHpChange, formatHp, hpTargets, MAX_HP_CHANGE, parseHpAmount } from './hp'

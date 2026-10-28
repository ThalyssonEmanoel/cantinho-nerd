/**
 * Motor de fórmulas (seção 5.4). Ponto único de entrada: o resto do app importa daqui.
 */
export type {
  FormulaContext,
  FormulaError,
  FormulaErrorCode,
  FormulaResult,
  FormulaValue
} from './types'
export { FormulaException } from './types'

export type { BinaryOperator, FormulaNode } from './parser'
export { parseFormula, stripFormulaPrefix } from './parser'
export type { Token, TokenType } from './tokenizer'
export { tokenize } from './tokenizer'

export {
  evaluateAst,
  evaluateFormula,
  FUNCTION_NAMES,
  toBoolean,
  toNumber,
  toText
} from './evaluate'

export type { SheetLikeRecord, SheetLikeValue } from './context'
export { createObjectContext, emptyContext, withValues } from './context'

export type { DependencyEntry, EvaluationPlan, FormulaEntry } from './dependencies'
export {
  collectComputedValues,
  collectReferencedKeys,
  collectReferencePaths,
  evaluateEntries,
  planEvaluation,
  planFromDependencies
} from './dependencies'

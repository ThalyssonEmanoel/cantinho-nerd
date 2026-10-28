import { parseFormulaOrThrow, type BinaryOperator, type FormulaNode } from './parser'
import {
  fail,
  toFailure,
  type FormulaContext,
  type FormulaResult,
  type FormulaValue
} from './types'

const MAX_DEPTH = 64

/** Texto que é número: aceita vírgula como separador decimal, que é o que se digita aqui. */
const NUMERIC_TEXT = /^-?\d+(?:[.,]\d+)?$/

/** Nunca lança. Fórmula inválida ou campo inexistente viram `{ ok: false, error }`. */
export function evaluateFormula(source: string, context: FormulaContext): FormulaResult {
  try {
    return { ok: true, value: evaluateNode(parseFormulaOrThrow(source), context, 0) }
  } catch (error) {
    return toFailure(error)
  }
}

/** Mesma coisa, para quem já tem a árvore pronta (recálculo em lote). */
export function evaluateAst(node: FormulaNode, context: FormulaContext): FormulaResult {
  try {
    return { ok: true, value: evaluateNode(node, context, 0) }
  } catch (error) {
    return toFailure(error)
  }
}

function evaluateNode(node: FormulaNode, context: FormulaContext, depth: number): FormulaValue {
  if (depth > MAX_DEPTH) fail('depth', 'Fórmula aninhada demais.', node.position)

  switch (node.kind) {
    case 'number':
      return node.value
    case 'string':
      return node.value
    case 'reference':
      return resolveReference(node, context)
    case 'call':
      return callFunction(node, context, depth)
    case 'unary':
      return evaluateUnary(node, context, depth)
    case 'binary':
      return evaluateBinary(node, context, depth)
  }
}

function resolveReference(
  node: Extract<FormulaNode, { kind: 'reference' }>,
  context: FormulaContext
): FormulaValue {
  const value = context.resolve(node.path)
  if (value === undefined) {
    fail('unknown-reference', `O campo "${node.path.join('.')}" não existe.`, node.position)
  }
  return value
}

function evaluateUnary(
  node: Extract<FormulaNode, { kind: 'unary' }>,
  context: FormulaContext,
  depth: number
): FormulaValue {
  const value = evaluateNode(node.operand, context, depth + 1)
  if (node.operator === 'neg') return -toNumber(value, node.position)
  return !toBoolean(value)
}

function evaluateBinary(
  node: Extract<FormulaNode, { kind: 'binary' }>,
  context: FormulaContext,
  depth: number
): FormulaValue {
  // `e`/`ou` com curto-circuito: `vida > 0 e vida.max / vida > 2` não explode com vida 0.
  if (node.operator === 'e' || node.operator === 'ou') {
    const left = toBoolean(evaluateNode(node.left, context, depth + 1))
    if (node.operator === 'e' && !left) return false
    if (node.operator === 'ou' && left) return true
    return toBoolean(evaluateNode(node.right, context, depth + 1))
  }

  const left = evaluateNode(node.left, context, depth + 1)
  const right = evaluateNode(node.right, context, depth + 1)

  switch (node.operator) {
    case '==':
      return looseEquals(left, right)
    case '!=':
      return !looseEquals(left, right)
    default:
      return arithmeticOrComparison(node.operator, left, right, node.position)
  }
}

function arithmeticOrComparison(
  operator: BinaryOperator,
  leftValue: FormulaValue,
  rightValue: FormulaValue,
  position: number
): FormulaValue {
  const left = toNumber(leftValue, position)
  const right = toNumber(rightValue, position)

  switch (operator) {
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '+':
      return finite(left + right, position)
    case '-':
      return finite(left - right, position)
    case '*':
      return finite(left * right, position)
    case '/':
      if (right === 0) fail('division-by-zero', 'Divisão por zero.', position)
      return finite(left / right, position)
    case '%':
      if (right === 0) fail('division-by-zero', 'Resto de divisão por zero.', position)
      return finite(left % right, position)
    case '^':
      return finite(left ** right, position)
    default:
      fail('internal', `Operador não tratado: ${operator}`, position)
  }
}

// ---------------------------------------------------------------------------
// Funções (português com alias em inglês, seção 5.4)
// ---------------------------------------------------------------------------

/**
 * `arred` arredonda meio para longe do zero (-1,5 vira -2), que é o arredondamento que se
 * aprende na escola. O Math.round do JS arredonda -1,5 para -1, o que surpreende.
 */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

const SINGLE_NUMBER_FUNCTIONS: Record<string, (value: number) => number> = {
  piso: Math.floor,
  floor: Math.floor,
  teto: Math.ceil,
  ceil: Math.ceil,
  arred: roundHalfAwayFromZero,
  round: roundHalfAwayFromZero,
  abs: Math.abs
}

const CONDITIONAL_NAMES = new Set(['se', 'if'])
const SUM_NAMES = new Set(['soma', 'sum'])
const COUNT_NAMES = new Set(['contar', 'count'])
const MIN_MAX_NAMES = new Set(['min', 'max'])

/** Usado pela validação do construtor (Fase 2) para sugerir nomes. */
export const FUNCTION_NAMES: readonly string[] = [
  ...Object.keys(SINGLE_NUMBER_FUNCTIONS),
  ...CONDITIONAL_NAMES,
  ...SUM_NAMES,
  ...COUNT_NAMES,
  ...MIN_MAX_NAMES
]

function callFunction(
  node: Extract<FormulaNode, { kind: 'call' }>,
  context: FormulaContext,
  depth: number
): FormulaValue {
  const name = node.name.toLowerCase()
  const { args, position } = node

  if (CONDITIONAL_NAMES.has(name)) {
    requireArity(name, args, 3, position)
    // Só o ramo escolhido é avaliado: `se(vida == 0, 0, 100 / vida)` não dá erro com vida 0.
    const condition = toBoolean(evaluateNode(args[0] as FormulaNode, context, depth + 1))
    return evaluateNode((condition ? args[1] : args[2]) as FormulaNode, context, depth + 1)
  }

  const singleNumber = SINGLE_NUMBER_FUNCTIONS[name]
  if (singleNumber !== undefined) {
    requireArity(name, args, 1, position)
    const value = toNumber(evaluateNode(args[0] as FormulaNode, context, depth + 1), position)
    return finite(singleNumber(value), position)
  }

  if (MIN_MAX_NAMES.has(name)) {
    if (args.length === 0) {
      fail('arity', `A função ${name} precisa de pelo menos um valor.`, position)
    }
    const numbers = args.map((arg) => toNumber(evaluateNode(arg, context, depth + 1), arg.position))
    return name === 'min' ? Math.min(...numbers) : Math.max(...numbers)
  }

  if (SUM_NAMES.has(name)) {
    if (args.length === 0) {
      fail('arity', `A função ${name} precisa de pelo menos um valor.`, position)
    }
    return sumArguments(args, context, depth, position)
  }

  if (COUNT_NAMES.has(name)) {
    requireArity(name, args, 1, position)
    return countArgument(args[0] as FormulaNode, context, position)
  }

  fail('unknown-function', `Não conheço a função "${node.name}".`, position)
}

function requireArity(
  name: string,
  args: readonly FormulaNode[],
  expected: number,
  position: number
): void {
  if (args.length !== expected) {
    const plural = expected === 1 ? 'argumento' : 'argumentos'
    fail(
      'arity',
      `A função ${name} precisa de ${expected} ${plural}, mas recebeu ${args.length}.`,
      position
    )
  }
}

/** `soma(inventario.peso)` soma a coluna da tabela; `soma(a, b)` soma os valores. */
function sumArguments(
  args: readonly FormulaNode[],
  context: FormulaContext,
  depth: number,
  position: number
): number {
  if (args.length === 1) {
    const only = args[0] as FormulaNode
    if (only.kind === 'reference') {
      const list = context.resolveList(only.path)
      if (list !== undefined) {
        const total = list.reduce<number>((sum, value) => sum + toNumber(value, position), 0)
        return finite(total, position)
      }
    }
  }

  const total = args.reduce(
    (sum, arg) => sum + toNumber(evaluateNode(arg, context, depth + 1), arg.position),
    0
  )
  return finite(total, position)
}

/** `contar(inventario)` conta as linhas da tabela. */
function countArgument(arg: FormulaNode, context: FormulaContext, position: number): number {
  if (arg.kind === 'reference') {
    const list = context.resolveList(arg.path)
    if (list !== undefined) return list.length
    if (context.resolve(arg.path) === undefined) {
      fail('unknown-reference', `O campo "${arg.path.join('.')}" não existe.`, arg.position)
    }
  }

  fail('type', 'contar(...) espera uma tabela, como contar(inventario).', position)
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

export function toNumber(value: FormulaValue, position?: number): number {
  if (typeof value === 'number') return finite(value, position)
  if (typeof value === 'boolean') return value ? 1 : 0

  const text = value.trim()
  // Campo de texto vazio vale 0: um atributo em branco não pode estragar a ficha toda.
  if (text === '') return 0
  if (!NUMERIC_TEXT.test(text)) {
    fail('type', `"${value}" não é um número.`, position)
  }
  return Number(text.replace(',', '.'))
}

export function toBoolean(value: FormulaValue): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return value.trim() !== ''
}

/** Texto de um valor: usado na comparação com textos e na interpolação das rolagens. */
export function toText(value: FormulaValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

function isNumericValue(value: FormulaValue): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true
  return NUMERIC_TEXT.test(value.trim())
}

/**
 * Igualdade tolerante: números comparam como números (`agilidade == 0`) e o resto como
 * texto (`classe == "Ocultista"`), ignorando espaços nas pontas. Maiúsculas contam, porque
 * o valor vem de uma lista de opções e a comparação exata é mais previsível.
 */
function looseEquals(left: FormulaValue, right: FormulaValue): boolean {
  if (isNumericValue(left) && isNumericValue(right)) {
    return toNumber(left) === toNumber(right)
  }
  return toText(left).trim() === toText(right).trim()
}

function finite(value: number, position?: number): number {
  if (!Number.isFinite(value)) {
    fail('type', 'O cálculo deu um número inválido.', position)
  }
  return value
}

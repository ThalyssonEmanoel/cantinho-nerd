import { tokenize, type Token } from './tokenizer'
import { fail, toFailure, type FormulaResult } from './types'

export type BinaryOperator =
  'ou' | 'e' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%' | '^'

export type FormulaNode =
  | { kind: 'number'; value: number; position: number }
  | { kind: 'string'; value: string; position: number }
  /** `forca`, `forca.mod`, `pericias.furtividade.total` */
  | { kind: 'reference'; path: string[]; position: number }
  | { kind: 'call'; name: string; args: FormulaNode[]; position: number }
  | { kind: 'unary'; operator: 'neg' | 'nao'; operand: FormulaNode; position: number }
  | {
      kind: 'binary'
      operator: BinaryOperator
      left: FormulaNode
      right: FormulaNode
      position: number
    }

/**
 * Precedência dos operadores binários (maior = mais forte). Parser de Pratt: cada nível
 * só consome operadores com precedência maior que a do nível de cima.
 */
const BINARY_PRECEDENCE: Record<string, number> = {
  ou: 1,
  e: 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '^': 7
}

/** Entre `-` unário e `^`: `-2^2` é `-(2^2)`, como em matemática. */
const UNARY_PRECEDENCE = 6

/** `^` é associativo à direita: `2^3^2` é `2^(3^2)`. */
const RIGHT_ASSOCIATIVE = new Set(['^'])

/** Teto de aninhamento, para um texto absurdo não estourar a pilha. */
const MAX_DEPTH = 64

/** Remove o `=` inicial do campo calculado e devolve também quanto foi cortado. */
export function stripFormulaPrefix(source: string): { text: string; offset: number } {
  const leading = source.length - source.trimStart().length
  const trimmed = source.trim()
  if (!trimmed.startsWith('=')) return { text: trimmed, offset: leading }

  const withoutEqual = trimmed.slice(1)
  const afterEqual = withoutEqual.length - withoutEqual.trimStart().length
  return { text: withoutEqual.trim(), offset: leading + 1 + afterEqual }
}

/** Nunca lança: fórmula inválida vira `{ ok: false, error }`. */
export function parseFormula(source: string): FormulaResult<FormulaNode> {
  try {
    return { ok: true, value: parseFormulaOrThrow(source) }
  } catch (error) {
    return toFailure(error)
  }
}

export function parseFormulaOrThrow(source: string): FormulaNode {
  const { text, offset } = stripFormulaPrefix(source)
  if (text === '') fail('syntax', 'Fórmula vazia.', offset)

  const parser = new Parser(tokenize(text, offset))
  const node = parser.parseExpression(0, 0)
  parser.expectEnd()
  return node
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  private get current(): Token {
    // O tokenizer sempre fecha com 'end', então nunca fica sem token.
    return this.tokens[this.index] as Token
  }

  private advance(): Token {
    const token = this.current
    if (token.type !== 'end') this.index += 1
    return token
  }

  expectEnd(): void {
    const token = this.current
    if (token.type !== 'end') {
      fail('syntax', `Sobrou "${token.text}" no fim da fórmula.`, token.position)
    }
  }

  parseExpression(minPrecedence: number, depth: number): FormulaNode {
    if (depth > MAX_DEPTH) fail('depth', 'Fórmula aninhada demais.', this.current.position)

    let left = this.parseUnary(depth)

    for (;;) {
      const token = this.current
      if (token.type !== 'operator') break

      const precedence = BINARY_PRECEDENCE[token.text]
      if (precedence === undefined || precedence < minPrecedence) break

      this.advance()
      const nextMinimum = RIGHT_ASSOCIATIVE.has(token.text) ? precedence : precedence + 1
      const right = this.parseExpression(nextMinimum, depth + 1)
      left = {
        kind: 'binary',
        operator: token.text as BinaryOperator,
        left,
        right,
        position: token.position
      }
    }

    return left
  }

  private parseUnary(depth: number): FormulaNode {
    const token = this.current

    if (token.type === 'operator' && (token.text === '-' || token.text === 'nao')) {
      this.advance()
      const operand = this.parseExpression(UNARY_PRECEDENCE, depth + 1)
      return {
        kind: 'unary',
        operator: token.text === '-' ? 'neg' : 'nao',
        operand,
        position: token.position
      }
    }

    // `+5` é inofensivo e as pessoas escrevem; aceitamos e ignoramos o sinal.
    if (token.type === 'operator' && token.text === '+') {
      this.advance()
      return this.parseUnary(depth + 1)
    }

    return this.parsePrimary(depth)
  }

  private parsePrimary(depth: number): FormulaNode {
    const token = this.advance()

    if (token.type === 'number') {
      return { kind: 'number', value: token.value ?? Number(token.text), position: token.position }
    }

    if (token.type === 'string') {
      return { kind: 'string', value: token.text, position: token.position }
    }

    if (token.type === 'lparen') {
      const node = this.parseExpression(0, depth + 1)
      const closing = this.advance()
      if (closing.type !== 'rparen') {
        fail('syntax', 'Falta fechar o parêntese.', closing.position)
      }
      return node
    }

    if (token.type === 'identifier') {
      if (this.current.type === 'lparen') return this.parseCall(token, depth)
      return this.parseReference(token)
    }

    if (token.type === 'end') {
      fail('syntax', 'A fórmula terminou antes do esperado.', token.position)
    }

    fail('syntax', `Não esperava "${token.text}" aqui.`, token.position)
  }

  private parseCall(name: Token, depth: number): FormulaNode {
    this.advance() // consome o '('
    const args: FormulaNode[] = []

    if (this.current.type !== 'rparen') {
      for (;;) {
        args.push(this.parseExpression(0, depth + 1))
        if (this.current.type !== 'comma') break
        this.advance()
      }
    }

    const closing = this.advance()
    if (closing.type !== 'rparen') {
      fail('syntax', `Falta fechar o parêntese de ${name.text}.`, closing.position)
    }

    return { kind: 'call', name: name.text, args, position: name.position }
  }

  private parseReference(first: Token): FormulaNode {
    const path = [first.text]

    while (this.current.type === 'dot') {
      this.advance()
      const segment = this.advance()
      if (segment.type !== 'identifier') {
        fail('syntax', 'Depois do ponto esperava um nome de campo.', segment.position)
      }
      path.push(segment.text)
    }

    return { kind: 'reference', path, position: first.position }
  }
}

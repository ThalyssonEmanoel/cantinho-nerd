import { fail } from './types'

export type TokenType =
  'number' | 'string' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'comma' | 'dot' | 'end'

export interface Token {
  type: TokenType
  /** Operador, nome do identificador ou conteúdo do texto (já sem as aspas). */
  text: string
  /** Preenchido só em 'number'. */
  value?: number
  /** Posição no texto original (contando o deslocamento do `=` inicial). */
  position: number
}

/**
 * Operadores escritos como palavra. Só os três do português, como manda a especificação:
 * cada palavra reservada aqui é uma chave de componente que o mestre não pode usar, então
 * a lista fica curta de propósito (`and`/`or`/`not` não entram).
 */
const WORD_OPERATORS = new Set(['e', 'ou', 'nao'])

const TWO_CHAR_OPERATORS = new Set(['==', '!=', '<=', '>='])
const ONE_CHAR_OPERATORS = new Set(['+', '-', '*', '/', '%', '^', '<', '>'])

/** Erros de digitação comuns, com a dica pronta em português. */
const COMMON_MISTAKES: Record<string, string> = {
  '&&': 'Use "e" em vez de &&.',
  '||': 'Use "ou" em vez de ||.',
  '!': 'Use "nao" em vez de !.',
  '=': 'Use == para comparar (um só = não compara).'
}

const IDENTIFIER_START = /[\p{L}_]/u
const IDENTIFIER_PART = /[\p{L}\p{N}_]/u
const DIGIT = /[0-9]/

/**
 * Quebra a fórmula em tokens. O `offset` existe porque o `=` inicial é removido antes:
 * assim as posições dos erros continuam apontando para o texto que o mestre digitou.
 */
export function tokenize(source: string, offset = 0): Token[] {
  const tokens: Token[] = []
  let index = 0

  const push = (type: TokenType, text: string, position: number, value?: number): void => {
    tokens.push(value === undefined ? { type, text, position } : { type, text, position, value })
  }

  while (index < source.length) {
    const char = source[index] as string
    const position = index + offset

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1
      continue
    }

    if (char === '(') {
      push('lparen', char, position)
      index += 1
      continue
    }

    if (char === ')') {
      push('rparen', char, position)
      index += 1
      continue
    }

    if (char === ',') {
      push('comma', char, position)
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      index = readString(source, index, position, push)
      continue
    }

    if (DIGIT.test(char)) {
      index = readNumber(source, index, position, push)
      continue
    }

    if (char === '.') {
      push('dot', char, position)
      index += 1
      continue
    }

    const twoChars = source.slice(index, index + 2)
    if (TWO_CHAR_OPERATORS.has(twoChars)) {
      push('operator', twoChars, position)
      index += 2
      continue
    }

    const mistake = COMMON_MISTAKES[twoChars] ?? COMMON_MISTAKES[char]
    if (mistake !== undefined) {
      fail('syntax', mistake, position)
    }

    if (ONE_CHAR_OPERATORS.has(char)) {
      push('operator', char, position)
      index += 1
      continue
    }

    if (IDENTIFIER_START.test(char)) {
      index = readIdentifier(source, index, position, push)
      continue
    }

    fail('syntax', `Não entendi o caractere "${char}".`, position)
  }

  push('end', '', source.length + offset)
  return tokens
}

type Push = (type: TokenType, text: string, position: number, value?: number) => void

function readString(source: string, start: number, position: number, push: Push): number {
  const quote = source[start] as string
  let index = start + 1
  let text = ''

  while (index < source.length) {
    const char = source[index] as string
    // Escape: a barra invertida passa o próximo caractere direto (\" dentro do texto).
    if (char === '\\') {
      const next = source[index + 1]
      if (next === undefined) break
      text += next
      index += 2
      continue
    }
    if (char === quote) {
      push('string', text, position)
      return index + 1
    }
    text += char
    index += 1
  }

  fail('syntax', 'Texto sem fechar as aspas.', position)
}

function readNumber(source: string, start: number, position: number, push: Push): number {
  let index = start
  while (index < source.length && DIGIT.test(source[index] as string)) index += 1

  // Só é parte decimal se vier dígito depois do ponto: em `forca.mod` o ponto é acesso.
  if (source[index] === '.' && DIGIT.test(source[index + 1] ?? '')) {
    index += 1
    while (index < source.length && DIGIT.test(source[index] as string)) index += 1
  }

  const text = source.slice(start, index)
  push('number', text, position, Number(text))
  return index
}

function readIdentifier(source: string, start: number, position: number, push: Push): number {
  let index = start
  while (index < source.length && IDENTIFIER_PART.test(source[index] as string)) index += 1

  const text = source.slice(start, index)
  push(WORD_OPERATORS.has(text) ? 'operator' : 'identifier', text, position)
  return index
}

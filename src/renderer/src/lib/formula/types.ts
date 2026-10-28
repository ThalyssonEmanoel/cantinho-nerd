/**
 * Tipos do motor de fórmulas (seção 5.4 da especificação).
 *
 * O motor é TypeScript puro: nada de `eval` nem `new Function`, porque fórmula é texto
 * escrito pelo mestre e seria um buraco de segurança executá-la como código.
 */

/** Tudo que uma fórmula consegue produzir. Caixa de seleção vira booleano (vale 1/0). */
export type FormulaValue = number | string | boolean

export type FormulaErrorCode =
  /** Erro de escrita: parêntese sem fechar, operador solto, fórmula vazia. */
  | 'syntax'
  /** Função chamada com o número errado de argumentos. */
  | 'arity'
  | 'unknown-function'
  /** Referência a uma chave que o contexto não conhece. */
  | 'unknown-reference'
  /** Operação com o tipo errado, por exemplo somar um texto que não é número. */
  | 'type'
  | 'division-by-zero'
  /** Dependência circular entre campos calculados. */
  | 'cycle'
  /** Fórmula aninhada fundo demais — proteção contra entrada maliciosa. */
  | 'depth'
  /** Notação de rolagem que a biblioteca de dados não entende. */
  | 'notation'
  /** Falha inesperada do motor (bug nosso). Nunca deveria aparecer. */
  | 'internal'

export interface FormulaError {
  code: FormulaErrorCode
  /** Mensagem em português, mostrada no tooltip do campo com `#ERRO`. */
  message: string
  /** Posição no texto original da fórmula, para destacar no editor. */
  position?: number
}

export type FormulaResult<T = FormulaValue> =
  { ok: true; value: T } | { ok: false; error: FormulaError }

/**
 * Ponte entre a fórmula e os valores da ficha.
 *
 * Quem implementa (Fase 3) decide o que cada caminho significa. Regra importante:
 * um campo que existe mas está vazio deve devolver o padrão dele (0 ou ""), **não**
 * `undefined` — `undefined` significa "essa chave não existe" e vira erro na ficha.
 */
export interface FormulaContext {
  /**
   * Valor de uma referência: `['forca']`, `['forca','mod']`, `['vida','max']`,
   * `['pericias','furtividade','total']`.
   */
  resolve: (path: readonly string[]) => FormulaValue | undefined

  /**
   * Lista de valores para agregação: `['inventario','peso']` devolve o peso de cada linha
   * e `['inventario']` devolve uma entrada por linha (usado por `contar`).
   */
  resolveList: (path: readonly string[]) => readonly FormulaValue[] | undefined
}

/** Erro interno do motor. Nunca escapa da API pública: virá sempre como FormulaResult. */
export class FormulaException extends Error {
  readonly error: FormulaError

  constructor(error: FormulaError) {
    super(error.message)
    this.name = 'FormulaException'
    this.error = error
  }
}

export function fail(code: FormulaErrorCode, message: string, position?: number): never {
  throw new FormulaException({ code, message, position })
}

/** Converte qualquer exceção numa falha de resultado, mantendo a promessa de não lançar. */
export function toFailure(error: unknown): { ok: false; error: FormulaError } {
  if (error instanceof FormulaException) return { ok: false, error: error.error }

  // Chegar aqui é bug do motor. Logamos para não sumir com o problema, mas a ficha segue viva.
  console.error('Erro inesperado no motor de fórmulas:', error)
  return {
    ok: false,
    error: {
      code: 'internal',
      message: 'Erro inesperado no motor de fórmulas.'
    }
  }
}

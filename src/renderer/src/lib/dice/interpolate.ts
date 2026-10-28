import { evaluateFormula, toText, type FormulaContext, type FormulaResult } from '../formula'

/**
 * Calcula os trechos entre chaves de uma fórmula de rolagem (seção 5.5).
 *
 * `1d20 + {forca.mod}` vira `1d20 + 3`, e `{se(agilidade == 0, 2, agilidade)}d20{se(agilidade
 * == 0, "kl1", "kh1")}` vira `2d20kl1` — é o que permite expressar regras do sistema sem o
 * app conhecer o sistema.
 */
export function interpolateRollFormula(
  source: string,
  context: FormulaContext
): FormulaResult<string> {
  let result = ''
  let index = 0

  while (index < source.length) {
    const open = source.indexOf('{', index)
    if (open === -1) {
      result += source.slice(index)
      break
    }

    const close = source.indexOf('}', open)
    if (close === -1) {
      return {
        ok: false,
        error: { code: 'syntax', message: 'Falta fechar a chave } na fórmula.', position: open }
      }
    }

    result += source.slice(index, open)

    const inner = source.slice(open + 1, close)
    if (inner.trim() === '') {
      return {
        ok: false,
        error: { code: 'syntax', message: 'Chave {} vazia na fórmula.', position: open }
      }
    }

    const evaluated = evaluateFormula(inner, context)
    if (!evaluated.ok) {
      // A posição é do trecho dentro da notação, não da fórmula interna.
      return { ok: false, error: { ...evaluated.error, position: open + 1 } }
    }

    result += toText(evaluated.value)
    index = close + 1
  }

  const notation = normalizeSigns(result).trim()
  if (notation === '') {
    return { ok: false, error: { code: 'notation', message: 'Fórmula de rolagem vazia.' } }
  }

  return { ok: true, value: notation }
}

/**
 * Um modificador negativo deixaria a notação como `1d20 + -1`. A biblioteca até aceita,
 * mas o texto que vai para o chat fica feio, então arrumamos os sinais.
 */
function normalizeSigns(notation: string): string {
  return notation.replace(/\+\s*-\s*/g, '- ').replace(/-\s*-\s*/g, '+ ')
}

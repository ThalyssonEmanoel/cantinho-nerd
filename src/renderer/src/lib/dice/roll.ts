import { Dice, DiceRoll, Parser, Results } from '@dice-roller/rpg-dice-roller'
import { emptyContext, type FormulaError, type FormulaResult } from '../formula'
import { detectOutcome, resolveCriticalRule } from './critical'
import { interpolateRollFormula } from './interpolate'
import { withEngine } from './rng'
import type { DiceRollResult, RollOptions, RolledDie } from './types'

/**
 * Rola uma fórmula de rolagem (seção 5.5): calcula os `{…}` com os valores da ficha, rola
 * com a biblioteca de dados e devolve cada dado, o total e o resultado de crítico.
 *
 * Nunca lança: notação errada ou campo inexistente voltam como `{ ok: false, error }`,
 * porque uma fórmula mal escrita não pode derrubar a mesa.
 */
export function rollFormula(source: string, options: RollOptions = {}): DiceRollResult {
  const context = options.context ?? emptyContext

  const interpolated = interpolateRollFormula(source, context)
  if (!interpolated.ok) return interpolated

  const rule = resolveCriticalRule(options.critical ?? { kind: 'none' }, context)
  if (!rule.ok) return rule

  const notation = interpolated.value

  try {
    // `Parser.parse` é o único jeito de saber quantos lados tem cada grupo de dados — o
    // resultado da rolagem não carrega essa informação, e sem ela não há como detectar
    // crítico (que vale só para o d20).
    const groups = Parser.parse(notation).filter(isDie)
    const roll = withEngine(options.engine, () => new DiceRoll(notation))
    const dice = collectDice(roll, groups)

    return {
      ok: true,
      roll: {
        ...(options.label === undefined ? {} : { label: options.label }),
        source,
        notation,
        total: roll.total,
        dice,
        outcome: detectOutcome(dice, rule.value, options.criticalFailureOnOne ?? false),
        detail: roll.output
      }
    }
  } catch (error) {
    return { ok: false, error: notationError(notation, error) }
  }
}

type AnyDie = InstanceType<typeof Dice.StandardDice>

function isDie(item: unknown): item is AnyDie {
  // PercentileDice e FudgeDice herdam de StandardDice, então o instanceof cobre as três.
  return item instanceof Dice.StandardDice
}

/**
 * Junta os dados rolados com os lados de cada grupo.
 *
 * Os dois vêm da mesma notação e na mesma ordem (`1d20+2d4kh1` → d20, d4), então basta
 * casar sequencialmente os grupos de resultado com os grupos de dados.
 */
function collectDice(roll: DiceRoll, groups: readonly AnyDie[]): RolledDie[] {
  const dice: RolledDie[] = []
  let groupIndex = 0

  for (const item of roll.rolls) {
    if (!(item instanceof Results.RollResults)) continue

    const group = groups[groupIndex]
    groupIndex += 1
    const sides: number | string = group === undefined ? '?' : group.sides

    for (const result of item.rolls) {
      dice.push({
        sides,
        value: result.value,
        // `useInTotal` é falso quando um modificador descartou o dado (kh/kl/dh/dl).
        dropped: !result.useInTotal,
        exploded: result.modifiers.has('explode')
      })
    }
  }

  return dice
}

function notationError(notation: string, error: unknown): FormulaError {
  const detail = error instanceof Error ? error.message : String(error)
  // A mensagem da biblioteca é em inglês e técnica; guardamos só no console.
  console.error(`Notação de rolagem inválida: ${notation}`, detail)
  return {
    code: 'notation',
    message: `Não entendi a rolagem "${notation}".`
  }
}

/**
 * Confere se a notação é válida, sem rolar nada. A validação do construtor usa isto para
 * avisar de `1d20++` antes de publicar o modelo.
 */
export function validateRollNotation(notation: string): FormulaResult<true> {
  const text = notation.trim()
  if (text === '') {
    return { ok: false, error: { code: 'notation', message: 'Fórmula de rolagem vazia.' } }
  }

  try {
    Parser.parse(text)
    return { ok: true, value: true }
  } catch {
    return { ok: false, error: { code: 'notation', message: `Não entendi a rolagem "${text}".` } }
  }
}

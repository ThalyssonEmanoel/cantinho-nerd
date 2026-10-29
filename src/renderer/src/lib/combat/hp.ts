import type { BoardToken } from '@/lib/board'
import type { CombatLogEntry, HpChangeKind } from './types'

/** O mesmo teto do banco (`apply_hp_change`). */
export const MAX_HP_CHANGE = 100000

/**
 * Valor digitado de dano/cura: número de 0 a 100000, com vírgula ou ponto. Null se não dá
 * para usar (vazio, letra, negativo).
 */
export function parseHpAmount(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > MAX_HP_CHANGE) return null
  return value
}

/**
 * Em quais dos tokens selecionados esta pessoa pode aplicar dano/cura (7.3): o mestre em
 * todos; o jogador só nos próprios. Token sem vida (sem barra e sem ficha) fica de fora —
 * o banco também o pularia.
 */
export function hpTargets(
  tokens: readonly BoardToken[],
  selection: readonly string[],
  role: 'gm' | 'player',
  userId: string | null
): BoardToken[] {
  return tokens.filter(
    (token) =>
      selection.includes(token.id) &&
      (role === 'gm' || (userId !== null && token.ownerId === userId && !token.hidden)) &&
      (token.bars.hp !== undefined || token.sheetId !== null)
  )
}

/** "7", "2,5": números do log no jeito brasileiro. */
export function formatHp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

const VERBS: Record<HpChangeKind, string> = { damage: 'de dano em', heal: 'de cura em' }

/**
 * Uma linha do log de combate: "Ana: 7 de dano em Goblin 1 (12 → 5)". O nome do token
 * escondido aparece como "???" para o jogador, como no próprio token.
 */
export function describeHpChange(
  entry: CombatLogEntry,
  actorName: string,
  isGm: boolean
): string {
  const target = entry.nameHidden && !isGm ? '???' : entry.tokenName.trim() || 'um token'
  const actor = actorName.trim() || 'Alguém'
  return `${actor}: ${formatHp(entry.amount)} ${VERBS[entry.kind]} ${target} (${formatHp(entry.before)} → ${formatHp(entry.after)})`
}

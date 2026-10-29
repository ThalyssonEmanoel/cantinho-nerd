import type { FeedMessage, FeedRoll } from '@/lib/chat/feed'
import type { RollOutcome, RolledDie, RollSummary } from '@/lib/dice'
import type { Json } from './database.types'

/**
 * Conversão entre as linhas de `messages`/`rolls` e os itens da linha do tempo. Separado do
 * acesso ao banco para ser testado sem rede. O `result` da rolagem é jsonb escrito pelo app
 * de outra pessoa: cada dado é conferido antes de ir para a tela.
 */

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

function asOutcome(value: unknown): RollOutcome {
  return value === 'critical' || value === 'critical-failure' ? value : 'normal'
}

function asDice(value: unknown): RolledDie[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const die = asObject(entry)
    const sides = die.sides
    if (typeof die.value !== 'number' || (typeof sides !== 'number' && typeof sides !== 'string')) {
      return []
    }
    return [
      { sides, value: die.value, dropped: die.dropped === true, exploded: die.exploded === true }
    ]
  })
}

export function messageFromRow(row: Record<string, unknown>): FeedMessage | null {
  if (typeof row.id !== 'string' || typeof row.author_id !== 'string') return null
  return {
    kind: 'message',
    id: row.id,
    authorId: row.author_id,
    recipientId: typeof row.recipient_id === 'string' ? row.recipient_id : null,
    body: text(row.body),
    createdAt: text(row.created_at)
  }
}

export function rollFromRow(row: Record<string, unknown>): FeedRoll | null {
  if (typeof row.id !== 'string' || typeof row.author_id !== 'string') return null
  const result = asObject(row.result)
  // `numeric` pode chegar como texto, conforme o caminho (REST ou tempo real).
  const total = typeof row.total === 'number' ? row.total : Number(row.total)
  return {
    kind: 'roll',
    id: row.id,
    authorId: row.author_id,
    label: text(row.label),
    formula: text(row.formula),
    notation: text(result.notation),
    detail: text(result.detail),
    dice: asDice(result.dice),
    total: Number.isFinite(total) ? total : 0,
    outcome: asOutcome(row.outcome),
    secret: row.secret === true,
    createdAt: text(row.created_at)
  }
}

/** O que vai para a coluna `result`: o suficiente para redesenhar a rolagem em qualquer tela. */
export function rollResultJson(roll: RollSummary): Json {
  return {
    notation: roll.notation,
    detail: roll.detail,
    dice: roll.dice.map((die) => ({
      sides: die.sides,
      value: die.value,
      dropped: die.dropped,
      exploded: die.exploded
    }))
  }
}

import type { RollOutcome, RolledDie } from '@/lib/dice'

/**
 * A linha do tempo da mesa (seção 7.2): mensagens e rolagens juntas, em ordem — "as
 * rolagens também aparecem no chat". Funções puras; o store só guarda o resultado.
 */

export interface FeedMessage {
  kind: 'message'
  id: string
  authorId: string
  /** Preenchido = sussurro. */
  recipientId: string | null
  body: string
  createdAt: string
}

export interface FeedRoll {
  kind: 'roll'
  id: string
  authorId: string
  label: string
  formula: string
  notation: string
  detail: string
  dice: RolledDie[]
  total: number
  outcome: RollOutcome
  secret: boolean
  createdAt: string
}

export type FeedItem = FeedMessage | FeedRoll

/** Quanto do histórico fica na tela: o que é mais velho continua no banco. */
export const FEED_LIMIT = 300

const keyOf = (item: FeedItem): string => `${item.kind}:${item.id}`

/**
 * Junta, tira repetidos e ordena. O repetido mais comum é o eco: a própria pessoa grava, o
 * item já entra na tela, e depois o tempo real manda o mesmo de volta.
 */
export function mergeFeed(...lists: readonly (readonly FeedItem[])[]): FeedItem[] {
  const byKey = new Map<string, FeedItem>()
  for (const list of lists) for (const item of list) byKey.set(keyOf(item), item)
  return [...byKey.values()]
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? keyOf(a).localeCompare(keyOf(b))
        : a.createdAt.localeCompare(b.createdAt)
    )
    .slice(-FEED_LIMIT)
}

export function removeFromFeed(
  feed: readonly FeedItem[],
  kind: FeedItem['kind'],
  id: string
): FeedItem[] {
  return feed.filter((item) => !(item.kind === kind && item.id === id))
}

/** O mestre limpou o chat (mensagens) ou o histórico (rolagens). */
export function clearFromFeed(feed: readonly FeedItem[], kind: FeedItem['kind']): FeedItem[] {
  return feed.filter((item) => item.kind !== kind)
}

/** O que chegou de outra pessoa conta como "não lido" quando o chat não está à vista. */
export function countsAsUnread(item: FeedItem, myUserId: string): boolean {
  return item.authorId !== myUserId
}

/** Sussurro para mim, vindo de outra pessoa: é o que toca o som (7.2). */
export function isWhisperToMe(item: FeedItem, myUserId: string): boolean {
  return item.kind === 'message' && item.recipientId === myUserId && item.authorId !== myUserId
}

import type { TokenKind } from '@/lib/board'

/**
 * Combate (seção 7.3): o tracker de iniciativa, o dano/cura e o log.
 *
 * Quem decide de quem é a vez, quanto de vida sobra e quem vê o quê é o banco (as RPCs
 * `combat_*` e `apply_hp_change`, e o RLS). Aqui fica o que a tela precisa para mostrar.
 */

export interface CombatState {
  active: boolean
  round: number
  /** De quem é a vez. Null antes do primeiro turno, ou se quem tinha a vez saiu. */
  turnEntryId: string | null
}

export const IDLE_COMBAT: CombatState = { active: false, round: 0, turnEntryId: null }

/** Um participante do combate. Nome, imagem e visibilidade acompanham o token. */
export interface CombatEntry {
  id: string
  sessionId: string
  tokenId: string
  name: string
  imagePath: string | null
  ownerId: string
  kind: TokenKind
  /** Oculto: só o mestre vê (o RLS nem manda para o jogador). */
  hidden: boolean
  /** Nome escondido dos jogadores ("???"), como no token. */
  showName: boolean
  /** Null = ainda não rolou. */
  initiative: number | null
  sortOrder: number
}

export type HpChangeKind = 'damage' | 'heal'

/** Uma linha do log de combate (7.3). */
export interface CombatLogEntry {
  id: string
  actorId: string
  tokenId: string | null
  tokenName: string
  tokenOwnerId: string | null
  kind: HpChangeKind
  amount: number
  before: number
  after: number
  tokenHidden: boolean
  barsHidden: boolean
  nameHidden: boolean
  createdAt: string
}

/** O que `apply_hp_change` devolve para cada token. */
export type HpChangeResult =
  | { tokenId: string; skipped: true }
  | { tokenId: string; skipped: false; before: number; after: number }

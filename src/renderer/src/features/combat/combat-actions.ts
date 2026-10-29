import {
  rollInitiative,
  type CombatEntry,
  type HpChangeKind,
  type HpChangeResult
} from '@/lib/combat'
import * as db from '@/lib/db/combat'
import { FriendlyError } from '@/lib/db/errors'
import { listTokensByIds } from '@/lib/db/tokens'
import type { DiceEngine } from '@/lib/dice'
import { mergedValues, type SheetSchema, type SheetValues } from '@/lib/sheet'
import { useSessionStore } from '@/features/session/session-store'
import { sheetRepository } from '@/features/sheets/repository'
import { useCombatStore } from './combat-store'

/**
 * As ações do combate (7.3). Cada uma grava pelo banco (as RPCs conferem quem pode) e
 * depois relê o combate: várias mudam muitas linhas de uma vez (reordenar, encerrar), e
 * reler garante a tela certa mesmo se algum evento do tempo real se atrasar.
 */

function sessionId(): string {
  const id = useCombatStore.getState().sessionId
  if (id === null) throw new FriendlyError('Nenhuma mesa aberta.')
  return id
}

async function reload(): Promise<void> {
  await useCombatStore.getState().reload()
}

export async function startCombat(): Promise<void> {
  await db.startCombat(sessionId())
  await reload()
}

/** Encerrar limpa o tracker (7.3). */
export async function endCombat(): Promise<void> {
  await db.endCombat(sessionId())
  await reload()
}

/** Põe tokens no combate (liga o combate, se precisar). Devolve quantos entraram. */
export async function addTokensToCombat(tokenIds: readonly string[]): Promise<number> {
  if (tokenIds.length === 0) return 0
  const added = await db.addToCombat(sessionId(), tokenIds)
  await reload()
  return added
}

export async function removeParticipant(entryId: string): Promise<void> {
  const store = useCombatStore.getState()
  store.applyEntryChange({ event: 'DELETE', row: {}, old: { id: entryId } })
  try {
    await db.removeFromCombat(entryId)
  } finally {
    await reload()
  }
}

/** A ficha de quem tem uma; null para o token sem ficha (que rola 1d20). */
async function sheetFor(
  sheetId: string | null
): Promise<{ schema: SheetSchema | null; values: SheetValues }> {
  if (sheetId === null) return { schema: null, values: {} }
  try {
    const sheet = await sheetRepository.get(sheetId)
    if (sheet === null) return { schema: null, values: {} }
    return { schema: await sheetRepository.schemaOf(sheet), values: mergedValues(sheet) }
  } catch {
    // Ficha ilegível agora (rede, modelo apagado): o participante rola 1d20 mesmo.
    return { schema: null, values: {} }
  }
}

/**
 * Rola a iniciativa dos participantes pelo papel `initiative` da ficha (7.3). Quem não
 * tem ficha rola 1d20. Fórmula quebrada no modelo também cai no 1d20, e a mensagem volta
 * para a tela avisar o mestre. Só o mestre: é ele quem vê todas as fichas.
 */
export async function rollInitiatives(
  entries: readonly CombatEntry[],
  engine?: DiceEngine
): Promise<string[]> {
  if (entries.length === 0) return []
  const tokens = await listTokensByIds(entries.map((entry) => entry.tokenId))
  const sheetOfToken = new Map(tokens.map((token) => [token.id, token.sheetId]))

  const values: Record<string, number | null> = {}
  const problems: string[] = []
  for (const entry of entries) {
    const { schema, values: sheetValues } = await sheetFor(sheetOfToken.get(entry.tokenId) ?? null)
    let rolled = rollInitiative(schema, sheetValues, engine)
    if (!rolled.ok) {
      problems.push(`${entry.name || 'Sem nome'}: ${rolled.error}`)
      rolled = rollInitiative(null, {}, engine)
    }
    if (rolled.ok) values[entry.id] = rolled.value
  }

  useCombatStore.getState().setLocalInitiatives(values)
  await db.setInitiatives(sessionId(), values)
  await reload()
  return problems
}

/** O mestre digitou a iniciativa (null apaga). O banco reordena a fila. */
export async function setInitiative(entryId: string, value: number | null): Promise<void> {
  useCombatStore.getState().setLocalInitiatives({ [entryId]: value })
  try {
    await db.setInitiatives(sessionId(), { [entryId]: value })
  } finally {
    await reload()
  }
}

/** Ordem arrastada pelo mestre (7.3). */
export async function reorderParticipants(ids: readonly string[]): Promise<void> {
  useCombatStore.getState().setLocalOrder(ids)
  try {
    await db.reorderCombat(sessionId(), ids)
  } finally {
    await reload()
  }
}

export async function nextTurn(): Promise<void> {
  await db.nextTurn(sessionId())
  await reload()
}

export async function endMyTurn(): Promise<void> {
  await db.endMyTurn(sessionId())
  await reload()
}

/**
 * Dano ou cura nos tokens (7.3). A vida nova chega à tela pelo tempo real (a ficha e os
 * tokens mudam no banco); o que volta daqui é para avisar quem não tinha vida.
 */
export async function applyHp(
  tokenIds: readonly string[],
  kind: HpChangeKind,
  amount: number
): Promise<HpChangeResult[]> {
  if (tokenIds.length === 0) return []
  return db.applyHpChange(sessionId(), tokenIds, kind, amount)
}

/** O mestre limpa o log; o aviso pelo canal esvazia a tela de todos de uma vez. */
export async function clearCombatLog(): Promise<void> {
  await db.clearCombatLog(sessionId())
  useCombatStore.getState().applyLogCleared()
  useSessionStore.getState().broadcast('combat-log-cleared', {})
}

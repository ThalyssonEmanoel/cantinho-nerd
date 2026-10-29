import type { CombatEntry, CombatState } from './types'

/** A ordem dos turnos: a do banco (`sort_order`), com o id desempatando como lá. */
export function byTurnOrder(a: CombatEntry, b: CombatEntry): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** O participante da vez, se esta pessoa o enxerga. */
export function currentEntry(
  entries: readonly CombatEntry[],
  state: CombatState
): CombatEntry | null {
  if (!state.active || state.turnEntryId === null) return null
  return entries.find((entry) => entry.id === state.turnEntryId) ?? null
}

/** É a vez de um token meu? É o que libera "Encerrar meu turno" e o aviso "Sua vez!". */
export function isMyTurn(
  entries: readonly CombatEntry[],
  state: CombatState,
  userId: string | null
): boolean {
  const entry = currentEntry(entries, state)
  return entry !== null && userId !== null && entry.ownerId === userId && !entry.hidden
}

/** O nome que esta pessoa vê: o mestre sempre vê o de verdade (6.3). */
export function entryLabel(entry: Pick<CombatEntry, 'name' | 'showName'>, isGm: boolean): string {
  if (!entry.showName && !isGm) return '???'
  return entry.name.trim() === '' ? 'Sem nome' : entry.name
}

/**
 * Nova ordem depois de arrastar `id` para a posição de `overId` — a mesma conta do dnd-kit
 * (`arrayMove`), feita aqui para ser testada sem a tela.
 */
export function moveEntry(ids: readonly string[], id: string, overId: string): string[] {
  const from = ids.indexOf(id)
  const to = ids.indexOf(overId)
  if (from === -1 || to === -1 || from === to) return [...ids]
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

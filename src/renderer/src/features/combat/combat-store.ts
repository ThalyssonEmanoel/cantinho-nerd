import { create } from 'zustand'
import {
  byTurnOrder,
  IDLE_COMBAT,
  type CombatEntry,
  type CombatLogEntry,
  type CombatState
} from '@/lib/combat'
import { fetchCombat, fetchCombatLog } from '@/lib/db/combat'
import { combatEntryFromRow, combatLogFromRow, combatStateFromRow } from '@/lib/db/combat-rows'
import { errorMessage } from '@/lib/db/errors'
import type { TableChange } from '@/lib/db/realtime'

/**
 * O combate da mesa aberta (7.3): estado, participantes e log, com o tempo real por cima.
 *
 * Abre junto com a sessão e usa o mesmo canal: o tracker continua certo enquanto a pessoa
 * vai da mesa para a ficha e volta, e o "Sua vez!" chega em qualquer tela da sessão.
 */

/** Quanto do log fica na tela. */
const LOG_LIMIT = 100

interface CombatStoreState {
  sessionId: string | null
  state: CombatState
  /** Na ordem dos turnos. O jogador não recebe os ocultos (RLS). */
  entries: CombatEntry[]
  /** Do mais novo para o mais antigo. */
  log: CombatLogEntry[]
  loading: boolean

  open: (sessionId: string) => Promise<void>
  close: () => void
  /** Snapshot de novo (ao reconectar, ou depois de uma ação que mexe em muita coisa). */
  reload: () => Promise<void>

  applyStateChange: (change: TableChange) => void
  applyEntryChange: (change: TableChange) => void
  applyLogChange: (change: TableChange) => void
  /** O token passou a oculto: o UPDATE não chega ao jogador, o aviso do canal sim. */
  removeEntriesOfToken: (tokenId: string) => void
  /** O mestre limpou o log (aviso pelo canal). */
  applyLogCleared: () => void
  /** Ordem otimista enquanto o banco confirma (arrastar não pode "pular" de volta). */
  setLocalOrder: (ids: readonly string[]) => void
  /** Iniciativa otimista: o valor fica na tela enquanto o banco reordena. */
  setLocalInitiatives: (values: Readonly<Record<string, number | null>>) => void
}

const emptyState = {
  sessionId: null,
  state: IDLE_COMBAT,
  entries: [],
  log: [],
  loading: false
}

export const useCombatStore = create<CombatStoreState>()((set, get) => {
  async function load(sessionId: string): Promise<void> {
    const [snapshot, log] = await Promise.all([fetchCombat(sessionId), fetchCombatLog(sessionId)])
    if (get().sessionId !== sessionId) return
    set({ state: snapshot.state, entries: snapshot.entries, log, loading: false })
  }

  return {
    ...emptyState,

    open: async (sessionId) => {
      set({ ...emptyState, sessionId, loading: true })
      try {
        await load(sessionId)
      } catch (error) {
        console.warn('Não consegui carregar o combate:', errorMessage(error))
        if (get().sessionId === sessionId) set({ loading: false })
      }
    },

    close: () => set({ ...emptyState }),

    reload: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        await load(sessionId)
      } catch (error) {
        console.warn('Não consegui recarregar o combate:', errorMessage(error))
      }
    },

    applyStateChange: (change) => {
      set({ state: change.event === 'DELETE' ? IDLE_COMBAT : combatStateFromRow(change.row) })
    },

    applyEntryChange: (change) => {
      if (change.event === 'DELETE') {
        // O DELETE chega só com o id (10.3).
        const id = String(change.old.id ?? '')
        set({ entries: get().entries.filter((entry) => entry.id !== id) })
        return
      }
      const entry = combatEntryFromRow(change.row)
      if (entry === null || entry.sessionId !== get().sessionId) return
      const others = get().entries.filter((item) => item.id !== entry.id)
      set({ entries: [...others, entry].sort(byTurnOrder) })
    },

    applyLogChange: (change) => {
      if (change.event === 'DELETE') {
        const id = String(change.old.id ?? '')
        set({ log: get().log.filter((item) => item.id !== id) })
        return
      }
      const item = combatLogFromRow(change.row)
      if (item === null || get().log.some((existing) => existing.id === item.id)) return
      set({ log: [item, ...get().log].slice(0, LOG_LIMIT) })
    },

    removeEntriesOfToken: (tokenId) => {
      const entries = get().entries
      if (!entries.some((entry) => entry.tokenId === tokenId)) return
      set({ entries: entries.filter((entry) => entry.tokenId !== tokenId) })
    },

    applyLogCleared: () => set({ log: [] }),

    setLocalOrder: (ids) => {
      const position = new Map(ids.map((id, index) => [id, index + 1]))
      set({
        entries: get()
          .entries.map((entry) => ({ ...entry, sortOrder: position.get(entry.id) ?? entry.sortOrder }))
          .sort(byTurnOrder)
      })
    },

    setLocalInitiatives: (values) => {
      set({
        entries: get().entries.map((entry) =>
          entry.id in values ? { ...entry, initiative: values[entry.id] ?? null } : entry
        )
      })
    }
  }
})

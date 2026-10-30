import { create } from 'zustand'
import { clueFromUnknown } from '@/lib/db/clue-rows'
import { listClues } from '@/lib/db/clues'
import { errorMessage } from '@/lib/db/errors'
import { fetchNotes, saveNotes } from '@/lib/db/notes'
import type { TableChange } from '@/lib/db/realtime'
import { isRevealed, sortClues, type Clue } from '@/lib/session/clues'

/**
 * Notas do mestre e pistas da mesa aberta (Fase 13).
 *
 * Abre junto com a sessão. O jogador recebe só as pistas reveladas para ele — isso é o
 * RLS que decide, aqui não há filtro nenhum: a tela mostra o que chegou.
 *
 * As notas são do mestre e salvam sozinhas, como o rascunho do construtor: digitar não
 * pode exigir um botão.
 */

/** Espera antes de gravar as notas, para não mandar um patch por tecla. */
const NOTES_DELAY_MS = 800

export type NotesState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface CluesStoreState {
  sessionId: string | null
  /** Só o mestre carrega: para o jogador fica vazio. */
  notes: string
  notesState: NotesState
  clues: Clue[]
  loading: boolean
  /** Pistas que acabaram de ser reveladas e o jogador ainda não viu. */
  unseen: string[]

  open: (sessionId: string, isGm: boolean) => Promise<void>
  close: () => void
  reload: () => Promise<void>

  setNotes: (body: string) => void
  flushNotes: () => Promise<void>

  /** Põe (ou troca) uma pista que já veio pronta do banco. */
  upsertClue: (clue: Clue) => void
  applyChange: (change: TableChange) => void
  /** A pista deixou de estar revelada para mim (aviso pelo canal). */
  removeClue: (clueId: string) => void
  markSeen: () => void
}

let notesTimer: ReturnType<typeof setTimeout> | undefined
let isGmHere = false

function clearNotesTimer(): void {
  if (notesTimer !== undefined) clearTimeout(notesTimer)
  notesTimer = undefined
}

const emptyState = {
  sessionId: null,
  notes: '',
  notesState: 'idle' as NotesState,
  clues: [],
  loading: false,
  unseen: []
}

export const useCluesStore = create<CluesStoreState>()((set, get) => {
  function scheduleNotes(): void {
    clearNotesTimer()
    notesTimer = setTimeout(() => void get().flushNotes(), NOTES_DELAY_MS)
  }

  async function load(sessionId: string, isGm: boolean): Promise<void> {
    const [clues, notes] = await Promise.all([
      listClues(sessionId),
      isGm ? fetchNotes(sessionId) : Promise.resolve('')
    ])
    if (get().sessionId !== sessionId) return
    set({ clues: sortClues(clues), notes, loading: false })
  }

  return {
    ...emptyState,

    open: async (sessionId, isGm) => {
      clearNotesTimer()
      isGmHere = isGm
      set({ ...emptyState, sessionId, loading: true })

      try {
        await load(sessionId, isGm)
      } catch (error) {
        if (get().sessionId === sessionId) set({ loading: false })
        console.warn('Não consegui carregar as pistas:', errorMessage(error))
      }
    },

    close: () => {
      clearNotesTimer()
      isGmHere = false
      set({ ...emptyState })
    },

    reload: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        await load(sessionId, isGmHere)
      } catch (error) {
        console.warn('Não consegui recarregar as pistas:', errorMessage(error))
      }
    },

    setNotes: (notes) => {
      set({ notes, notesState: 'dirty' })
      scheduleNotes()
    },

    flushNotes: async () => {
      clearNotesTimer()
      const { sessionId, notes, notesState } = get()
      if (sessionId === null || !isGmHere) return
      if (notesState !== 'dirty') return

      set({ notesState: 'saving' })
      try {
        await saveNotes(sessionId, notes)
        // Digitou enquanto gravava: continua sujo, e a próxima gravação pega o resto.
        if (get().sessionId === sessionId && get().notesState === 'saving') {
          set({ notesState: 'saved' })
        }
      } catch (error) {
        if (get().sessionId === sessionId) set({ notesState: 'error' })
        console.warn('Não consegui salvar as notas:', errorMessage(error))
      }
    },

    upsertClue: (clue) => {
      const { clues, unseen } = get()
      const previous = clues.find((item) => item.id === clue.id)
      const next = previous === undefined ? [...clues, clue] : clues.map((item) => (item.id === clue.id ? clue : item))

      // Para o jogador, a pista chega já revelada (o RLS só manda o que ele pode ver):
      // se é nova para ele, vale um aviso na aba.
      const isNew = previous === undefined && !isGmHere && isRevealed(clue)

      set({
        clues: sortClues(next),
        unseen: isNew && !unseen.includes(clue.id) ? [...unseen, clue.id] : unseen
      })
    },

    applyChange: (change) => {
      if (change.event === 'DELETE') {
        // O DELETE chega só com o id (10.3).
        get().removeClue(String(change.old.id ?? ''))
        return
      }

      const clue = clueFromUnknown(change.row)
      if (clue !== null) get().upsertClue(clue)
    },

    removeClue: (clueId) => {
      if (clueId === '') return
      set({
        clues: get().clues.filter((clue) => clue.id !== clueId),
        unseen: get().unseen.filter((id) => id !== clueId)
      })
    },

    markSeen: () => {
      if (get().unseen.length > 0) set({ unseen: [] })
    }
  }
})

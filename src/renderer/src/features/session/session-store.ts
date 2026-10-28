import { create } from 'zustand'
import { errorMessage } from '@/lib/db/errors'
import {
  openSessionChannel,
  type ChannelStatus,
  type PresenceMember,
  type TableChange
} from '@/lib/db/realtime'
import { fetchSession, type SessionDetail } from '@/lib/db/sessions'
import { remoteChangeFromGmRow, remoteChangeFromSheetRow } from '@/lib/db/sheet-rows'
import { migrateOutdatedSheets } from '@/lib/db/sheets'
import type { SheetSummaryRow } from '@/lib/sheet'
import { sheetRepository } from '@/features/sheets/repository'
import { useSheetStore } from '@/features/sheets/sheet-store'

/**
 * A sessão aberta (seção 10.3): o snapshot (sessão, membros e fichas) e o canal de tempo
 * real por cima dele.
 *
 * O canal vive aqui, e não numa tela, para continuar aberto enquanto a pessoa vai da mesa
 * para a ficha e volta — a presença não pisca e nenhum evento se perde no caminho.
 */

export type SessionLoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface SessionViewer {
  userId: string
  displayName: string
  avatarPath: string | null
}

interface SessionState {
  sessionId: string | null
  session: SessionDetail | null
  sheets: SheetSummaryRow[]
  presence: PresenceMember[]
  loadState: SessionLoadState
  /** Por que a sessão não abriu (ou deixou de estar disponível). */
  problem: string | null
  connection: ChannelStatus

  open: (sessionId: string, viewer: SessionViewer) => Promise<void>
  close: () => void
  /** Recarrega sessão e fichas (depois de mudar algo, ou ao reconectar). */
  reload: () => Promise<void>
  refreshSheets: () => Promise<void>
}

let closeChannel: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let viewer: SessionViewer | null = null

const emptyState = {
  sessionId: null,
  session: null,
  sheets: [],
  presence: [],
  loadState: 'idle' as SessionLoadState,
  problem: null,
  connection: 'connecting' as ChannelStatus
}

export const useSessionStore = create<SessionState>()((set, get) => {
  /** Sessão + fichas. Devolve false se a pessoa não está (mais) na sessão. */
  async function loadSnapshot(sessionId: string): Promise<boolean> {
    if (viewer === null) return false
    const [session, sheets] = await Promise.all([
      fetchSession(sessionId, viewer.userId),
      sheetRepository.list(sessionId)
    ])
    if (get().sessionId !== sessionId) return false

    if (session === null) {
      set({
        session: null,
        loadState: 'missing',
        problem: 'Esta mesa não existe mais, ou você não está nela.'
      })
      return false
    }

    set({ session, sheets, loadState: 'ready', problem: null })

    // O mestre é quem leva as fichas para a versão nova do sistema (só ele vê tudo, 5.7).
    if (session.role === 'gm') {
      void migrateOutdatedSheets(sheetRepository, sheets).then((count) => {
        if (count > 0 && get().sessionId === sessionId) void get().refreshSheets()
      })
    }
    return true
  }

  function scheduleSheetsRefresh(): void {
    // Uma gravação gera um ou dois eventos; a lista recarrega uma vez só.
    if (refreshTimer !== undefined) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void get().refreshSheets(), 300)
  }

  function handleSheetChange(change: TableChange): void {
    if (change.event === 'UPDATE') {
      const remote = remoteChangeFromSheetRow(change.row)
      if (remote !== null) useSheetStore.getState().applyRemote(remote)
    }
    scheduleSheetsRefresh()
  }

  function handleGmDataChange(change: TableChange): void {
    if (change.event !== 'UPDATE') return
    const remote = remoteChangeFromGmRow(change.row)
    if (remote !== null) useSheetStore.getState().applyRemote(remote)
  }

  return {
    ...emptyState,

    open: async (sessionId, who) => {
      get().close()
      viewer = who
      set({ ...emptyState, sessionId, loadState: 'loading' })

      try {
        if (!(await loadSnapshot(sessionId))) return
      } catch (error) {
        if (get().sessionId === sessionId) set({ loadState: 'error', problem: errorMessage(error) })
        return
      }

      const role = get().session?.role ?? 'player'
      let wasLive = false
      closeChannel = openSessionChannel(
        sessionId,
        { ...who, role },
        {
          onStatus: (connection) => {
            if (get().sessionId !== sessionId) return
            set({ connection })
            // Voltou depois de cair: o que aconteceu no meio-tempo vem pelo snapshot (10.3).
            if (connection === 'live' && wasLive) void get().reload()
            if (connection === 'live') wasLive = true
          },
          onPresence: (presence) => {
            if (get().sessionId === sessionId) set({ presence })
          },
          onSessionChange: (change) => {
            if (change.event === 'DELETE') {
              set({ loadState: 'missing', problem: 'O mestre excluiu esta mesa.' })
              return
            }
            void get().reload()
          },
          onMembersChange: () => void get().reload(),
          onSheetChange: handleSheetChange,
          onGmDataChange: handleGmDataChange
        }
      )
    },

    close: () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      closeChannel?.()
      closeChannel = null
      set({ ...emptyState })
    },

    reload: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        await loadSnapshot(sessionId)
      } catch (error) {
        console.warn('Não consegui recarregar a sessão:', errorMessage(error))
      }
    },

    refreshSheets: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        const sheets = await sheetRepository.list(sessionId)
        if (get().sessionId === sessionId) set({ sheets })
      } catch (error) {
        console.warn('Não consegui recarregar as fichas:', errorMessage(error))
      }
    }
  }
})

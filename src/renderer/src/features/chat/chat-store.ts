import { create } from 'zustand'
import { parseChatInput, type ChatMember } from '@/lib/chat/commands'
import {
  clearFromFeed,
  countsAsUnread,
  isWhisperToMe,
  mergeFeed,
  removeFromFeed,
  type FeedItem
} from '@/lib/chat/feed'
import { playWhisperChime } from '@/lib/chat/sound'
import type { DiceRules } from '@/lib/chat/tray'
import {
  addMacro,
  clearChat,
  clearRolls,
  fetchFeed,
  listMacros,
  postRoll,
  removeMacro,
  sendMessage,
  type DiceMacro
} from '@/lib/db/chat'
import { messageFromRow, rollFromRow } from '@/lib/db/chat-rows'
import { errorMessage } from '@/lib/db/errors'
import type { BroadcastEvent, TableChange } from '@/lib/db/realtime'
import { rollFormula, type CriticalRule } from '@/lib/dice'
import type { FormulaContext } from '@/lib/formula'
import { useAppStore } from '@/stores/app-store'

/**
 * Chat e dados da mesa aberta (seções 7.1 e 7.2).
 *
 * O canal é o da sessão: o store da sessão repassa para cá as mudanças de `messages` e
 * `rolls`. Quem não pode ver um sussurro ou uma rolagem secreta nem recebe o evento — o RLS
 * filtra no servidor —, então aqui não há filtro de privacidade nenhum, de propósito.
 */

export type ActionResult = { ok: true } | { ok: false; message: string }

export interface RollInput {
  formula: string
  label?: string
  critical: CriticalRule
  criticalFailureOnOne: boolean
  /** Valores da ficha, para os `{…}` dos botões de rolagem. */
  context?: FormulaContext
  secret?: boolean
}

type Broadcast = (event: BroadcastEvent, payload: Record<string, unknown>) => void

interface ChatState {
  sessionId: string | null
  userId: string | null
  feed: FeedItem[]
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  /** Itens de outras pessoas que chegaram com o chat fora da tela. */
  unread: number
  /**
   * Contador que sobe quando alguém pede o foco do chat (o Enter, Fase 13). A aba e o
   * campo olham só a mudança do número — assim o pedido funciona mesmo se o painel ainda
   * não estiver montado: ele foca ao aparecer.
   */
  focusRequest: number
  /** Quantos painéis de chat estão à vista agora (a mesa e a ficha têm cada uma o seu). */
  watchers: number
  macros: DiceMacro[]

  open: (sessionId: string, userId: string, broadcast: Broadcast) => Promise<void>
  close: () => void
  reload: () => Promise<void>
  /** Um painel de chat apareceu (true) ou saiu (false) da tela. */
  watch: (visible: boolean) => void
  /** Pede o foco do campo de mensagem (abre a aba Chat se preciso). */
  requestFocus: () => void
  applyChange: (kind: FeedItem['kind'], change: TableChange) => void
  applyCleared: (kind: FeedItem['kind']) => void
  sendInput: (
    input: string,
    members: readonly ChatMember[],
    rules: DiceRules
  ) => Promise<ActionResult>
  sendWhisperOrMessage: (body: string, recipientId: string | null) => Promise<ActionResult>
  roll: (input: RollInput) => Promise<ActionResult>
  clear: (kind: FeedItem['kind']) => Promise<ActionResult>
  saveMacro: (label: string, formula: string) => Promise<ActionResult>
  deleteMacro: (id: string) => Promise<ActionResult>
}

let broadcast: Broadcast = () => {}

const emptyState = {
  sessionId: null,
  userId: null,
  feed: [],
  loadState: 'idle' as const,
  unread: 0,
  focusRequest: 0,
  macros: []
}

export const useChatStore = create<ChatState>()((set, get) => {
  function add(item: FeedItem): void {
    set({ feed: mergeFeed(get().feed, [item]) })
  }

  async function load(sessionId: string): Promise<void> {
    const [feed, macros] = await Promise.all([fetchFeed(sessionId), listMacros(sessionId)])
    if (get().sessionId !== sessionId) return
    // O que chegou pelo canal enquanto o histórico vinha não pode sumir.
    set({ feed: mergeFeed(feed, get().feed), macros, loadState: 'ready' })
  }

  return {
    ...emptyState,
    watchers: 0,

    open: async (sessionId, userId, send) => {
      broadcast = send
      set({ ...emptyState, sessionId, userId, loadState: 'loading' })
      try {
        await load(sessionId)
      } catch (error) {
        console.warn('Não consegui carregar o chat:', errorMessage(error))
        if (get().sessionId === sessionId) set({ loadState: 'error' })
      }
    },

    close: () => {
      broadcast = () => {}
      set({ ...emptyState })
    },

    reload: async () => {
      const { sessionId } = get()
      if (sessionId === null) return
      try {
        await load(sessionId)
      } catch (error) {
        console.warn('Não consegui recarregar o chat:', errorMessage(error))
      }
    },

    requestFocus: () => set({ focusRequest: get().focusRequest + 1 }),

    watch: (visible) => {
      const watchers = Math.max(0, get().watchers + (visible ? 1 : -1))
      // Abrir o chat é ler o que estava esperando.
      set(watchers > 0 ? { watchers, unread: 0 } : { watchers })
    },

    applyChange: (kind, change) => {
      const { userId, watchers } = get()
      if (userId === null) return

      if (change.event === 'DELETE') {
        const id = change.old.id
        if (typeof id === 'string') set({ feed: removeFromFeed(get().feed, kind, id) })
        return
      }
      if (change.event !== 'INSERT') return

      const item = kind === 'message' ? messageFromRow(change.row) : rollFromRow(change.row)
      if (item === null) return
      const isNew = !get().feed.some(
        (existing) => existing.kind === kind && existing.id === item.id
      )
      add(item)
      if (!isNew) return

      if (watchers === 0 && countsAsUnread(item, userId)) set({ unread: get().unread + 1 })
      if (isWhisperToMe(item, userId) && useAppStore.getState().whisperSound) playWhisperChime()
    },

    applyCleared: (kind) => set({ feed: clearFromFeed(get().feed, kind) }),

    sendInput: async (input, members, rules) => {
      const { userId } = get()
      if (userId === null) return { ok: false, message: 'A mesa ainda não abriu.' }

      const command = parseChatInput(input, members, userId)
      switch (command.kind) {
        case 'empty':
          return { ok: true }
        case 'error':
          return { ok: false, message: command.message }
        case 'message':
          return get().sendWhisperOrMessage(command.body, null)
        case 'whisper':
          return get().sendWhisperOrMessage(command.body, command.recipientId)
        case 'roll':
          return get().roll({ formula: command.formula, ...rules })
      }
    },

    sendWhisperOrMessage: async (body, recipientId) => {
      const { sessionId } = get()
      if (sessionId === null) return { ok: false, message: 'A mesa ainda não abriu.' }
      try {
        add(await sendMessage(sessionId, body, recipientId))
        return { ok: true }
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
    },

    roll: async (input) => {
      const { sessionId } = get()
      if (sessionId === null) return { ok: false, message: 'A mesa ainda não abriu.' }

      // A rolagem é feita aqui, no app, por confiança entre amigos (10.4).
      const result = rollFormula(input.formula, {
        ...(input.label === undefined ? {} : { label: input.label }),
        critical: input.critical,
        criticalFailureOnOne: input.criticalFailureOnOne,
        ...(input.context === undefined ? {} : { context: input.context })
      })
      if (!result.ok) return { ok: false, message: result.error.message }

      try {
        add(await postRoll(sessionId, result.roll, { secret: input.secret === true }))
        return { ok: true }
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
    },

    clear: async (kind) => {
      const { sessionId } = get()
      if (sessionId === null) return { ok: false, message: 'A mesa ainda não abriu.' }
      try {
        await (kind === 'message' ? clearChat(sessionId) : clearRolls(sessionId))
        set({ feed: clearFromFeed(get().feed, kind) })
        broadcast('feed-cleared', { kind })
        return { ok: true }
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
    },

    saveMacro: async (label, formula) => {
      const { sessionId } = get()
      if (sessionId === null) return { ok: false, message: 'A mesa ainda não abriu.' }
      try {
        const macro = await addMacro(sessionId, label, formula)
        set({ macros: [...get().macros, macro] })
        return { ok: true }
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
    },

    deleteMacro: async (id) => {
      const before = get().macros
      // Otimista: some na hora e volta se o banco recusar.
      set({ macros: before.filter((macro) => macro.id !== id) })
      try {
        await removeMacro(id)
        return { ok: true }
      } catch (error) {
        set({ macros: before })
        return { ok: false, message: errorMessage(error) }
      }
    }
  }
})

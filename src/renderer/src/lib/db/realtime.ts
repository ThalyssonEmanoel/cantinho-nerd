import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from './client'

/**
 * Canal da sessão (seção 10.3): um canal **privado** por mesa (`session:<id>`). O banco só
 * deixa entrar quem é membro (política em `realtime.messages`).
 *
 * Pelo mesmo canal chegam a presença (quem está online) e as mudanças das tabelas
 * (`postgres_changes`), que o Realtime filtra pelo RLS de cada um: o jogador não recebe a
 * parte do mestre das fichas nem as fichas dos outros.
 */

export interface PresenceMember {
  userId: string
  displayName: string
  avatarPath: string | null
  role: 'gm' | 'player'
}

/** `reconnecting` aparece na tela como "Reconectando…" (10.3). */
export type ChannelStatus = 'connecting' | 'live' | 'reconnecting'

export interface TableChange {
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  /** Linha nova (INSERT/UPDATE). Em DELETE chega só o id, em `old`. */
  row: Record<string, unknown>
  old: Record<string, unknown>
}

export interface SessionChannelHandlers {
  onStatus: (status: ChannelStatus) => void
  onPresence: (members: PresenceMember[]) => void
  onSessionChange: (change: TableChange) => void
  onMembersChange: (change: TableChange) => void
  onSheetChange: (change: TableChange) => void
  onGmDataChange: (change: TableChange) => void
  onMapChange: (change: TableChange) => void
  onTokenChange: (change: TableChange) => void
  /** Desenhos salvos (6.5). O jogador só recebe os do mapa ativo. */
  onDrawingChange: (change: TableChange) => void
  /** Combate (7.3). Participante oculto e entrada do log escondida só chegam ao mestre. */
  onCombatStateChange: (change: TableChange) => void
  onCombatEntryChange: (change: TableChange) => void
  onCombatLogChange: (change: TableChange) => void
  /** Chat e rolagens (7.1, 7.2). Sussurro e rolagem secreta só chegam a quem pode ver. */
  onMessageChange: (change: TableChange) => void
  onRollChange: (change: TableChange) => void
  /** Mensagens efêmeras, que não passam pelo banco (10.3). */
  onBroadcast: (event: BroadcastEvent, payload: Record<string, unknown>) => void
}

/**
 * Eventos efêmeros do canal (10.3): não são salvos e podem se perder sem prejuízo.
 *
 * - `token-drag`: posição durante o arrasto, ~20 por segundo. **Nunca** de token oculto.
 * - `token-gone`: um token deixou de ser visível para o jogador. Precisa de broadcast
 *   porque um UPDATE que o RLS esconde simplesmente não chega a ele.
 * - `camera-focus`: o mestre leva a câmera de todos para um ponto (6.1).
 * - `feed-cleared`: o mestre limpou o chat ou o histórico de rolagens. Os DELETE de cada
 *   linha também chegam, mas um a um e só com o id; o aviso esvazia a tela de uma vez.
 * - `draw-live`: o traço sendo desenhado (6.5), ~20 por segundo. O id é o que ele terá no
 *   banco, então o INSERT que chega depois toma o lugar dele sem piscar.
 * - `draw-end`: o traço ao vivo não vai ser salvo (o banco recusou ou foi desfeito).
 * - `drawings-cleared`: "apagar meus desenhos" ou "limpar todos", de uma vez (como o
 *   `feed-cleared`).
 * - `ruler`: a régua de alguém, enquanto ela existe (6.5).
 * - `ping`: Alt+clique, um pulso no ponto para todos (6.5).
 * - `reaction`: emoji sobre um token (6.3). Nunca de token oculto.
 * - `combat-log-cleared`: o mestre limpou o log de combate (como o `feed-cleared`).
 */
export type BroadcastEvent =
  | 'token-drag'
  | 'token-gone'
  | 'camera-focus'
  | 'feed-cleared'
  | 'draw-live'
  | 'draw-end'
  | 'drawings-cleared'
  | 'ruler'
  | 'ping'
  | 'reaction'
  | 'combat-log-cleared'

const BROADCAST_EVENTS: readonly BroadcastEvent[] = [
  'token-drag',
  'token-gone',
  'camera-focus',
  'feed-cleared',
  'draw-live',
  'draw-end',
  'drawings-cleared',
  'ruler',
  'ping',
  'reaction',
  'combat-log-cleared'
]

export interface SessionChannel {
  close: () => void
  /** Manda um evento efêmero. Silencioso se o canal ainda não está de pé. */
  broadcast: (event: BroadcastEvent, payload: Record<string, unknown>) => void
}

function isPresenceMember(value: unknown): value is PresenceMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PresenceMember).userId === 'string'
  )
}

/** Abre o canal da sessão. */
export function openSessionChannel(
  sessionId: string,
  me: PresenceMember,
  handlers: SessionChannelHandlers
): SessionChannel {
  const supabase = getSupabase()
  let channel: RealtimeChannel | null = null
  let closed = false

  const toChange = (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: Record<string, unknown>
    old: Record<string, unknown>
  }): TableChange => ({ event: payload.eventType, row: payload.new, old: payload.old })

  async function connect(): Promise<void> {
    handlers.onStatus('connecting')
    // O canal privado precisa do token de quem está logado para o banco autorizar.
    await supabase.realtime.setAuth()
    if (closed) return

    channel = supabase.channel(`session:${sessionId}`, {
      config: { private: true, presence: { key: me.userId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (channel === null) return
        // Uma mesma pessoa com duas janelas aparece uma vez só.
        const byUser = new Map<string, PresenceMember>()
        for (const entries of Object.values(channel.presenceState())) {
          for (const entry of entries) {
            if (isPresenceMember(entry)) byUser.set(entry.userId, entry)
          }
        }
        handlers.onPresence([...byUser.values()])
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => handlers.onSessionChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_members',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onMembersChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sheets', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onSheetChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sheet_gm_data',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onGmDataChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maps', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onMapChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onTokenChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drawings',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onDrawingChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combat_state',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onCombatStateChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combat_entries',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onCombatEntryChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combat_log',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => handlers.onCombatLogChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onMessageChange(toChange(payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rolls', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onRollChange(toChange(payload))
      )

    for (const event of BROADCAST_EVENTS) {
      channel.on('broadcast', { event }, (message) => {
        const payload = (message as { payload?: unknown }).payload
        if (typeof payload === 'object' && payload !== null) {
          handlers.onBroadcast(event, payload as Record<string, unknown>)
        }
      })
    }

    channel.subscribe((status) => {
      if (closed) return
      if (status === 'SUBSCRIBED') {
        handlers.onStatus('live')
        void channel?.track(me)
      } else {
        // CHANNEL_ERROR, TIMED_OUT ou CLOSED: o realtime-js tenta de novo sozinho.
        handlers.onStatus('reconnecting')
      }
    })
  }

  void connect().catch((error: unknown) => {
    console.error('Não consegui abrir o canal da sessão:', error)
    if (!closed) handlers.onStatus('reconnecting')
  })

  return {
    close: () => {
      closed = true
      if (channel !== null) void supabase.removeChannel(channel)
    },

    broadcast: (event, payload) => {
      // Evento efêmero: se o canal caiu, perder não faz falta — o estado de verdade está
      // no banco e chega pelo postgres_changes.
      if (channel === null || closed) return
      void channel.send({ type: 'broadcast', event, payload })
    }
  }
}

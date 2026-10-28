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
}

function isPresenceMember(value: unknown): value is PresenceMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PresenceMember).userId === 'string'
  )
}

/** Abre o canal e devolve a função que fecha. */
export function openSessionChannel(
  sessionId: string,
  me: PresenceMember,
  handlers: SessionChannelHandlers
): () => void {
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
      .subscribe((status) => {
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

  return () => {
    closed = true
    if (channel !== null) void supabase.removeChannel(channel)
  }
}

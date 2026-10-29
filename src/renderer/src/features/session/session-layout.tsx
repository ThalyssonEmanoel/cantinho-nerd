import { useEffect, useState } from 'react'
import { ArrowLeft, Link2, Loader2, Settings, Wifi, WifiOff } from 'lucide-react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import type { ChannelStatus } from '@/lib/db/realtime'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { TurnNotifier } from '@/features/combat/turn-banner'
import { copyInvite } from './copy-invite'
import { ManageSessionDialog } from './manage-session-dialog'
import { useSessionStore } from './session-store'

/**
 * Casca da sessão: abre o snapshot e o canal de tempo real, mostra quem está online e
 * deixa as telas de dentro (a mesa e as fichas) trocarem sem derrubar a conexão.
 */
export function SessionLayout(): React.JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId)
  const profile = useAuthStore((state) => state.profile)
  const { session, presence, loadState, problem, connection } = useSessionStore()
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    if (sessionId === undefined || userId === null) return
    void useSessionStore.getState().open(sessionId, {
      userId,
      displayName: useAuthStore.getState().profile?.displayName ?? '',
      avatarPath: useAuthStore.getState().profile?.avatarPath ?? null
    })
    return () => useSessionStore.getState().close()
  }, [sessionId, userId])

  // "Voltar para <sessão>" na escolha de papel (4.2).
  useEffect(() => {
    if (session !== null)
      useAppStore.getState().rememberSession({ id: session.id, name: session.name })
  }, [session])

  const lobby = session?.role === 'gm' ? '/gm' : '/player'

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Abrindo a mesa…
      </div>
    )
  }

  if (loadState !== 'ready' || session === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground max-w-md text-sm">{problem}</p>
        <Button variant="outline" onClick={() => void navigate(lobby)}>
          <ArrowLeft className="size-4" />
          Voltar para o lobby
        </Button>
      </div>
    )
  }

  const online = new Set(presence.map((member) => member.userId))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate(lobby)}
          aria-label="Voltar para o lobby"
          title="Voltar para o lobby"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="min-w-0">
          <p className="truncate font-medium">{session.name}</p>
          <p className="text-muted-foreground text-xs">
            {session.role === 'gm' ? 'Você é o mestre' : `Mestre: ${session.gmName}`}
          </p>
        </div>

        <ConnectionBadge status={connection} />

        {/* Quem está online agora (presença do canal, 10.3). */}
        <div className="flex items-center -space-x-1.5" aria-label="Quem está online">
          {session.members
            .filter((member) => online.has(member.userId))
            .map((member) => (
              <span key={member.userId} title={`${member.displayName} (online)`}>
                <UserAvatar
                  displayName={member.displayName}
                  avatarPath={member.avatarPath}
                  className="ring-background size-7 text-[0.65rem] ring-2"
                />
              </span>
            ))}
          <span className="text-muted-foreground pl-3 text-xs">
            {online.size} de {session.members.length} online
          </span>
        </div>

        {session.role === 'gm' && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => void copyInvite(session)}>
              <Link2 className="size-4" />
              Copiar convite
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setManaging(true)}>
              <Settings className="size-4" />
              Gerenciar
            </Button>
          </div>
        )}

        {session.role === 'player' && profile !== null && (
          <span className="text-muted-foreground ml-auto text-xs">Você: {profile.displayName}</span>
        )}
      </header>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      {/* "Sua vez!" em qualquer tela da sessão, não só no tabuleiro (7.3). */}
      <TurnNotifier />

      {session.role === 'gm' && (
        <ManageSessionDialog open={managing} session={session} onClose={() => setManaging(false)} />
      )}
    </div>
  )
}

function ConnectionBadge({ status }: { status: ChannelStatus }): React.JSX.Element {
  if (status === 'live') {
    return (
      <Badge variant="outline" className="gap-1.5" title="Conectado: as mudanças chegam na hora.">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        ao vivo
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5', status === 'reconnecting' && 'border-amber-500/50 text-amber-300')}
    >
      {status === 'reconnecting' ? <WifiOff className="size-3" /> : <Wifi className="size-3" />}
      {status === 'reconnecting' ? 'Reconectando…' : 'conectando…'}
    </Badge>
  )
}

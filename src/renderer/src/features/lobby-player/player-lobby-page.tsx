import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogIn, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { extractInviteId } from '@shared/deep-link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/db/errors'
import { listMySessions, removeMember, type SessionSummary } from '@/lib/db/sessions'
import { useAuthStore } from '@/stores/auth-store'

/** Lobby do jogador (seção 4.4): entrar numa mesa nova e voltar às que já participa. */
export function PlayerLobbyPage(): React.JSX.Element {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId)
  const [invite, setInvite] = useState('')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState<SessionSummary | null>(null)

  const apply = useCallback((list: SessionSummary[]) => {
    setSessions(list.filter((session) => session.role === 'player'))
    setLoading(false)
  }, [])

  const fail = useCallback((error: unknown) => {
    setLoading(false)
    toast.error('Não consegui carregar suas mesas', { description: errorMessage(error) })
  }, [])

  useEffect(() => {
    if (userId === null) return
    void listMySessions(userId).then(apply, fail)
  }, [userId, apply, fail])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const inviteId = extractInviteId(invite)
    if (inviteId === null) {
      toast.error('Convite inválido', {
        description: 'Cole o link que o mestre enviou ou só o código da sessão.'
      })
      return
    }
    void navigate(`/join/${inviteId}`)
  }

  async function handleLeave(): Promise<void> {
    const target = leaving
    setLeaving(null)
    if (target === null || userId === null) return
    try {
      await removeMember(target.id, userId)
      setSessions((list) => list.filter((session) => session.id !== target.id))
      toast.success(`Você saiu de "${target.name}"`)
    } catch (error) {
      toast.error('Não consegui sair da sessão', { description: errorMessage(error) })
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader title="Entrar numa mesa" description="Cole o convite que o mestre mandou." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convite</CardTitle>
          <CardDescription>
            Aceita o link (<code>rpgmesa://join/…</code>) ou só o código da sessão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="rpgmesa://join/k3x9p2m7ab"
              aria-label="Link ou código do convite"
            />
            <Button type="submit">
              <LogIn className="size-4" />
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Mesas em que você joga</h2>

        {loading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </p>
        )}

        {!loading && sessions.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nenhuma ainda. Quando você entrar numa mesa, ela aparece aqui para voltar sem senha.
          </p>
        )}

        {sessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void navigate(`/session/${session.id}`)}
              >
                <p className="truncate font-medium">{session.name}</p>
                <p className="text-muted-foreground text-xs">Mestre: {session.gmName}</p>
              </button>
              <Button size="sm" onClick={() => void navigate(`/session/${session.id}`)}>
                <LogIn className="size-4" />
                Entrar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLeaving(session)}>
                <LogOut className="size-4" />
                Sair
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog
        open={leaving !== null}
        title={`Sair de "${leaving?.name ?? ''}"?`}
        description="Sua ficha fica com o mestre. Para voltar, você precisa do convite e da senha de novo."
        onClose={() => setLeaving(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaving(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleLeave()}>
              Sair da mesa
            </Button>
          </>
        }
      />
    </div>
  )
}

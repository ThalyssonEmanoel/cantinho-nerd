import { useEffect, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/db/errors'
import { invitePreview, joinSession, type InvitePreview } from '@/lib/db/sessions'

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; preview: InvitePreview }

/**
 * Tela de senha do convite (4.4 e 4.5). É aqui que o deep link `rpgmesa://join/<id>` cai —
 * inclusive quando o app abriu sem ninguém logado: o login devolve a pessoa para cá.
 */
export function JoinSessionPage(): React.JSX.Element {
  const { inviteId } = useParams<{ inviteId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<PreviewState>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (inviteId === undefined) return
    let active = true
    void invitePreview(inviteId).then(
      (preview) => {
        if (!active) return
        if (preview === null) {
          setState({ kind: 'not-found' })
        } else if (preview.isMember) {
          // Quem já está na mesa volta sem senha (4.4).
          void navigate(`/session/${preview.sessionId}`, { replace: true })
        } else {
          setState({ kind: 'ready', preview })
        }
      },
      (error: unknown) => {
        if (active) setState({ kind: 'error', message: errorMessage(error) })
      }
    )
    return () => {
      active = false
    }
  }, [inviteId, navigate])

  async function handleJoin(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (inviteId === undefined || password === '' || joining) return
    setJoining(true)
    try {
      const sessionId = await joinSession(inviteId, password)
      toast.success('Você entrou na mesa')
      void navigate(`/session/${sessionId}`, { replace: true })
    } catch (error) {
      toast.error('Não deu para entrar', { description: errorMessage(error) })
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="text-primary size-4" />
            {state.kind === 'ready' ? state.preview.name : 'Entrar na mesa'}
          </CardTitle>
          <CardDescription>
            {state.kind === 'ready' ? (
              `Mestre: ${state.preview.gmName}. Digite a senha que veio com o convite.`
            ) : (
              <>
                Convite: <code className="bg-muted rounded px-1">{inviteId}</code>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === 'loading' && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Procurando a mesa…
            </p>
          )}

          {state.kind === 'not-found' && (
            <p className="text-muted-foreground text-sm">
              Não achei nenhuma mesa com este convite. Talvez o mestre tenha gerado um novo — peça o
              link de novo.
            </p>
          )}

          {state.kind === 'error' && <p className="text-destructive text-sm">{state.message}</p>}

          {state.kind === 'ready' && (
            <form className="space-y-4" onSubmit={(event) => void handleJoin(event)}>
              <div className="space-y-2">
                <Label htmlFor="session-password">Senha da sessão</Label>
                <Input
                  id="session-password"
                  autoFocus
                  value={password}
                  placeholder="ex.: lobo-azul-42"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={password === '' || joining}>
                  {joining && <Loader2 className="size-4 animate-spin" />}
                  Entrar na mesa
                </Button>
                <Button type="button" variant="ghost" onClick={() => void navigate('/player')}>
                  Voltar
                </Button>
              </div>
            </form>
          )}

          {state.kind !== 'ready' && state.kind !== 'loading' && (
            <Button variant="outline" onClick={() => void navigate('/player')}>
              Voltar para o lobby
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

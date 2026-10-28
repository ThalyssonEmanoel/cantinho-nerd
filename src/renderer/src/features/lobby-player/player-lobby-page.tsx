import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { extractInviteId } from '@shared/deep-link'
import { PageHeader } from '@/components/page-header'
import { PhaseNotice } from '@/components/phase-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function PlayerLobbyPage(): React.JSX.Element {
  const [invite, setInvite] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const inviteId = extractInviteId(invite)
    if (inviteId === null) {
      toast.error('Convite inválido', {
        description: 'Cole o link que o mestre enviou ou só o ID da sessão.'
      })
      return
    }
    void navigate(`/join/${inviteId}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader title="Entrar numa mesa" description="Cole o convite que o mestre mandou." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convite</CardTitle>
          <CardDescription>
            Aceita o link (<code>rpgmesa://join/…</code>) ou só o ID da sessão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="rpgmesa://join/lobo-azul-42"
              aria-label="Link ou ID do convite"
            />
            <Button type="submit">
              <LogIn className="size-4" />
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>

      <PhaseNotice
        phase="Fase 5"
        title="Lobby do aventureiro"
        items={[
          'Lista das sessões de que você já participa, para voltar sem senha',
          'Senha da sessão verificada no servidor (RPC join_session)',
          'Sair de uma sessão',
          'Criar seu personagem a partir do modelo da sessão'
        ]}
      />
    </div>
  )
}

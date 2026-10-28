import { useNavigate, useParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { PhaseNotice } from '@/components/phase-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function JoinSessionPage(): React.JSX.Element {
  const { inviteId } = useParams<{ inviteId: string }>()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="text-primary size-4" />
            Senha da sessão
          </CardTitle>
          <CardDescription>
            Convite: <code className="bg-muted rounded px-1">{inviteId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-password">Senha</Label>
            <Input id="session-password" type="password" placeholder="senha da mesa" />
          </div>
          <div className="flex gap-2">
            <Button disabled>Entrar na mesa</Button>
            <Button variant="ghost" onClick={() => void navigate('/player')}>
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>

      <PhaseNotice
        phase="Fase 5"
        title="Entrada por convite"
        items={[
          'Senha conferida no servidor com bcrypt (pgcrypto), nunca no app',
          'Deep link rpgmesa://join/<id> abre direto nesta tela',
          'Convite guardado quando ainda não há login, e usado depois de entrar'
        ]}
      />
    </div>
  )
}

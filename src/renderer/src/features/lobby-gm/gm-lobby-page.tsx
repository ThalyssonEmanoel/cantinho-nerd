import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PhaseNotice } from '@/components/phase-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function GmLobbyPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Minhas sessões"
        description="As mesas que você mestra."
        actions={
          <Button disabled>
            <Plus className="size-4" />
            Nova sessão
          </Button>
        }
      />

      <Card className="border-dashed">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Nenhuma sessão ainda.
        </CardContent>
      </Card>

      <PhaseNotice
        phase="Fase 5"
        title="Lobby do mestre"
        items={[
          'Criar sessão com nome, senha e sistema (modelo de ficha)',
          'Copiar convite pronto para o WhatsApp, com link e senha',
          'Trocar a senha, gerar novo ID de convite e remover jogador',
          'Excluir sessão com confirmação, apagando também as imagens'
        ]}
      />
    </div>
  )
}

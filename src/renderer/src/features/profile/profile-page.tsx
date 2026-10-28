import { UserRound } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PhaseNotice } from '@/components/phase-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppInfo } from '@/hooks/use-app-info'

export function ProfilePage(): React.JSX.Element {
  const info = useAppInfo()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <PageHeader title="Perfil" description="Seu nome, avatar e bio." />

      <Card>
        <CardContent className="flex gap-6">
          <div className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center rounded-full">
            <UserRound className="size-8" />
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Nome de exibição</Label>
              <Input id="display-name" placeholder="como seus amigos te chamam" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Input id="bio" placeholder="uma linha sobre você" disabled />
            </div>
            <Button disabled>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>Versão: {info?.version ?? '…'}</p>
          <p>Plataforma: {info?.platform ?? '…'}</p>
          <p>Perfil de dados: {info?.profile ?? '…'}</p>
        </CardContent>
      </Card>

      <PhaseNotice
        phase="Fase 4"
        title="Perfil e conta"
        items={[
          'Editar nome de exibição, bio e avatar (upload com recorte circular)',
          'Excluir todas as minhas sessões (Fase 12)',
          'Excluir conta via Edge Function, com confirmação digitando o nome (Fase 12)'
        ]}
      />
    </div>
  )
}

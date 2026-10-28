import { Dices } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppInfo } from '@/hooks/use-app-info'

export function LoginPage(): React.JSX.Element {
  const navigate = useNavigate()
  const info = useAppInfo()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    // Fase 4 liga isto ao Supabase Auth. Por enquanto só segue para a escolha de papel.
    void navigate('/role')
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Dices className="text-primary size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">Cantinho Nerd</h1>
          <p className="text-muted-foreground text-sm">Mesa virtual de RPG</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrar</CardTitle>
            <CardDescription>Use seu nome de usuário e senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">Nome de usuário</Label>
                <Input id="username" autoComplete="username" placeholder="seu-nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="mínimo 8 caracteres"
                />
              </div>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Cadastro e login de verdade chegam na Fase 4.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          v{info?.version ?? '…'}
          {info !== null && info.profile !== 'default' && ` · perfil ${info.profile}`}
        </p>
      </div>
    </div>
  )
}

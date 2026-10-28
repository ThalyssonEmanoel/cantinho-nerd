import { Swords, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore, type Role } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const roles = [
  {
    role: 'gm' as Role,
    to: '/gm',
    icon: Swords,
    title: 'Mestre',
    description: 'Criar sessões, montar modelos de ficha, preparar mapas e encontros.'
  },
  {
    role: 'player' as Role,
    to: '/player',
    icon: UserRound,
    title: 'Aventureiro',
    description: 'Entrar numa sessão com link e senha, e cuidar da sua ficha.'
  }
]

export function RoleChoicePage(): React.JSX.Element {
  const navigate = useNavigate()
  const setRole = useAppStore((state) => state.setRole)
  const lastSession = useAppStore((state) => state.lastSession)
  const displayName = useAuthStore((state) => state.profile?.displayName)

  function choose(role: Role, to: string): void {
    setRole(role)
    void navigate(to)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {displayName === undefined
            ? 'Como você vai jogar hoje?'
            : `Como você vai jogar hoje, ${displayName}?`}
        </h1>
        <p className="text-muted-foreground text-sm">
          O papel não é fixo: você pode mestrar uma sessão e jogar em outra.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map(({ role, to, icon: Icon, title, description }) => (
          <Card
            key={role}
            className="hover:border-primary/60 cursor-pointer transition-colors"
            onClick={() => choose(role, to)}
          >
            <CardHeader>
              <Icon className="text-primary size-6" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {lastSession !== null && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Voltar para {lastSession.name}</p>
              <p className="text-muted-foreground text-xs">Sua última sessão aberta.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate(`/session/${lastSession.id}`)}
            >
              Abrir
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { Dices, LogOut, Swords, User, UserRound, Wrench } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppInfo } from '@/hooks/use-app-info'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/gm', label: 'Mestre', icon: Swords },
  { to: '/player', label: 'Aventureiro', icon: UserRound },
  { to: '/templates', label: 'Modelos de ficha', icon: Wrench },
  { to: '/profile', label: 'Perfil', icon: User }
]

export function AppLayout(): React.JSX.Element {
  const info = useAppInfo()
  const navigate = useNavigate()
  const clear = useAppStore((state) => state.clear)

  function handleExit(): void {
    clear()
    void navigate('/login')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-card/60 flex items-center gap-4 border-b px-4 py-2.5 backdrop-blur">
        <NavLink to="/role" className="flex items-center gap-2 font-semibold">
          <Dices className="text-primary size-5" />
          <span>Cantinho Nerd</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'text-muted-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground'
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/*
            O aviso do perfil é essencial ao testar com duas instâncias (`npm run dev:p2`):
            sem ele é fácil confundir qual janela é o mestre e qual é o jogador.
          */}
          {info !== null && info.profile !== 'default' && (
            <Badge variant="destructive">perfil {info.profile}</Badge>
          )}
          <span className="text-muted-foreground text-xs">v{info?.version ?? '…'}</span>
          <Button variant="ghost" size="sm" onClick={handleExit}>
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

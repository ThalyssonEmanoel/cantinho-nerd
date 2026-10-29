import {
  BookOpen,
  Dices,
  Loader2,
  LogOut,
  PawPrint,
  ScrollText,
  Settings,
  Swords,
  User,
  UserRound,
  Wrench
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { useAppInfo } from '@/hooks/use-app-info'
import { useSignOut } from '@/hooks/use-sign-out'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/gm', label: 'Mestre', icon: Swords },
  { to: '/player', label: 'Aventureiro', icon: UserRound },
  { to: '/templates', label: 'Modelos de ficha', icon: Wrench },
  { to: '/bestiary', label: 'Bestiário', icon: PawPrint },
  { to: '/guide', label: 'Guia de fórmulas', icon: BookOpen },
  { to: '/sheets', label: 'Fichas', icon: ScrollText },
  { to: '/profile', label: 'Perfil', icon: User },
  { to: '/settings', label: 'Configurações', icon: Settings }
]

export function AppLayout(): React.JSX.Element {
  const info = useAppInfo()
  const profile = useAuthStore((state) => state.profile)
  const { leaving, leave } = useSignOut()

  return (
    <div className="flex h-full flex-col">
      <header className="bg-card/60 flex items-center gap-4 border-b px-4 py-2.5 backdrop-blur">
        <NavLink to="/role" className="flex items-center gap-2 font-semibold">
          <Dices className="text-primary size-5" />
          <span>Cantinho Nerd</span>
        </NavLink>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground'
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/*
            O aviso do perfil é essencial ao testar com duas instâncias (`npm run dev:p2`):
            sem ele é fácil confundir qual janela é o mestre e qual é o jogador.
          */}
          {info !== null && info.profile !== 'default' && (
            <Badge variant="destructive">perfil {info.profile}</Badge>
          )}
          <span className="text-muted-foreground text-xs">v{info?.version ?? '…'}</span>

          {profile !== null && (
            <NavLink
              to="/profile"
              className="hover:bg-accent flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors"
              title={`@${profile.username}`}
            >
              <UserAvatar
                displayName={profile.displayName}
                avatarPath={profile.avatarPath}
                className="size-7 text-xs"
              />
              <span className="max-w-32 truncate text-sm">{profile.displayName}</span>
            </NavLink>
          )}

          <Button variant="ghost" size="sm" disabled={leaving} onClick={() => void leave()}>
            {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
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

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

/** Liga o app ao Supabase Auth uma vez, na raiz das rotas. */
export function AuthBootstrap(): null {
  useEffect(() => useAuthStore.getState().start(), [])
  return null
}

/** Para onde voltar depois do login (ex.: o convite que abriu o app sem ninguém logado). */
export interface LoginRedirectState {
  from?: string
}

/**
 * Portão das telas que precisam de conta. Sem login, manda para a tela de entrada levando
 * junto o endereço de onde a pessoa veio, para voltar a ele depois de entrar.
 */
export function RequireAuth(): React.JSX.Element {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') return <SplashScreen />

  if (status !== 'signed-in') {
    const state: LoginRedirectState = { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}

export function SplashScreen({ message = 'Entrando…' }: { message?: string }): React.JSX.Element {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" />
      {message}
    </div>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { Dices, Loader2, LogIn, Settings, UserPlus } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppInfo } from '@/hooks/use-app-info'
import {
  DISPLAY_NAME_MAX_LENGTH,
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  validateSignUp,
  validateUsername,
  type SignUpField
} from '@/lib/account/credentials'
import { signIn, signUp } from '@/lib/db/auth'
import { authStorage } from '@/lib/db/auth-storage'
import { SplashScreen, type LoginRedirectState } from '@/app/require-auth'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type Mode = 'sign-in' | 'sign-up'
type FieldErrors = Partial<Record<SignUpField, string>>

/** Entrar ou criar conta só com nome de usuário + senha (seção 4.1). */
export function LoginPage(): React.JSX.Element {
  const info = useAppInfo()
  const location = useLocation()
  const status = useAuthStore((state) => state.status)

  const [mode, setMode] = useState<Mode>('sign-in')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(() => authStorage.remembers())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as LoginRedirectState | null)?.from
  const target = from !== undefined && from !== '/login' ? from : '/role'

  if (status === 'unconfigured') return <MissingConfig />
  if (status === 'signed-in') return <Navigate to={target} replace />
  // Lendo a sessão guardada, ou buscando o perfil logo depois de entrar.
  if (status === 'loading' && !submitting) return <SplashScreen message="Carregando…" />

  function switchMode(next: Mode): void {
    setMode(next)
    setErrors({})
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submitting) return

    const found =
      mode === 'sign-up'
        ? validateSignUp({ username, displayName, password, confirmPassword })
        : validateSignIn(username, password)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    const result =
      mode === 'sign-up'
        ? await signUp({ username, displayName, password, remember })
        : await signIn({ username, password, remember })
    setSubmitting(false)

    if (!result.ok) {
      toast.error(mode === 'sign-up' ? 'Não deu para criar a conta' : 'Não deu para entrar', {
        description: result.message
      })
      return
    }

    // Não espera o aviso do Supabase: o perfil já começa a carregar e a tela segue.
    useAuthStore.getState().acceptSession(result.userId)
  }

  const normalized = normalizeUsername(username)
  const showLoginPreview =
    mode === 'sign-up' &&
    normalized !== '' &&
    normalized !== username &&
    validateUsername(username) === null

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Dices className="text-primary size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">Cantinho Nerd</h1>
          <p className="text-muted-foreground text-sm">Mesa virtual de RPG</p>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="tablist">
              <ModeTab active={mode === 'sign-in'} onClick={() => switchMode('sign-in')}>
                Entrar
              </ModeTab>
              <ModeTab active={mode === 'sign-up'} onClick={() => switchMode('sign-up')}>
                Criar conta
              </ModeTab>
            </div>
            <div>
              <CardTitle className="text-base">
                {mode === 'sign-in' ? 'Bem-vindo de volta' : 'Conta nova'}
              </CardTitle>
              <CardDescription>
                {mode === 'sign-in'
                  ? 'Use seu nome de usuário e senha.'
                  : 'Escolha um nome de usuário e uma senha.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
              <Field id="username" label="Nome de usuário" error={errors.username}>
                <Input
                  id="username"
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={USERNAME_MAX_LENGTH + 10}
                  placeholder="ex.: thalysson"
                  value={username}
                  aria-invalid={errors.username !== undefined}
                  onChange={(event) => setUsername(event.target.value)}
                />
                {mode === 'sign-up' && errors.username === undefined && (
                  <p className="text-muted-foreground text-xs">
                    {showLoginPreview ? (
                      <>
                        Você vai entrar como{' '}
                        <strong className="text-foreground">{normalized}</strong>.
                      </>
                    ) : (
                      '3 a 20 caracteres: letras sem acento, números, ponto, hífen e sublinhado.'
                    )}
                  </p>
                )}
              </Field>

              {mode === 'sign-up' && (
                <Field id="display-name" label="Nome de exibição" error={errors.displayName}>
                  <Input
                    id="display-name"
                    autoComplete="nickname"
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    placeholder="como os amigos te chamam (opcional)"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </Field>
              )}

              <Field id="password" label="Senha" error={errors.password}>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  maxLength={PASSWORD_MAX_LENGTH}
                  placeholder="mínimo 8 caracteres"
                  value={password}
                  aria-invalid={errors.password !== undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>

              {mode === 'sign-up' && (
                <Field id="confirm-password" label="Repita a senha" error={errors.confirmPassword}>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    value={confirmPassword}
                    aria-invalid={errors.confirmPassword !== undefined}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </Field>
              )}

              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Continuar conectado
              </label>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : mode === 'sign-in' ? (
                  <LogIn className="size-4" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {mode === 'sign-in' ? 'Entrar' : 'Criar conta e entrar'}
              </Button>

              {mode === 'sign-in' && (
                <p className="text-muted-foreground text-center text-xs">
                  Esqueceu a senha? Peça para quem cuida do app redefinir.
                </p>
              )}
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

function validateSignIn(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (username.trim() === '') errors.username = 'Digite seu nome de usuário.'
  if (password === '') errors.password = 'Digite sua senha.'
  return errors
}

function ModeTab({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function Field({
  id,
  label,
  error,
  children
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error !== undefined && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

/** O `.env` sem as chaves do Supabase: explica o que fazer em vez de falhar calado. */
function MissingConfig(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="text-primary size-4" />
            Falta configurar o Supabase
          </CardTitle>
          <CardDescription>
            O app não encontrou o endereço e a chave pública do banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Copie o <code>.env.example</code> para <code>.env</code>, preencha{' '}
            <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> e reinicie o app.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

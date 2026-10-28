import { internalEmail, normalizeUsername } from '@/lib/account/credentials'
import { authStorage } from './auth-storage'
import { getSupabase } from './client'
import { describeAuthError } from './errors'

/**
 * Cadastro, login e logout por nome de usuário + senha (seção 4.1), por cima do Supabase
 * Auth. Nada aqui lança: as telas recebem `{ ok: false, message }` já em português.
 */

export type AuthOutcome = { ok: true; userId: string } | { ok: false; message: string }

export interface SignUpRequest {
  username: string
  displayName: string
  password: string
  remember: boolean
}

export interface SignInRequest {
  username: string
  password: string
  remember: boolean
}

export async function signUp(request: SignUpRequest): Promise<AuthOutcome> {
  authStorage.setRemember(request.remember)
  try {
    const { data, error } = await getSupabase().auth.signUp({
      email: internalEmail(request.username),
      password: request.password,
      options: {
        // O gatilho do banco usa isto para o nome de exibição; vazio vira o nome de usuário.
        data: { display_name: request.displayName.trim() }
      }
    })
    if (error !== null) return { ok: false, message: describeAuthError(error) }

    // Sem sessão = o projeto está com "Confirm email" ligado; o cadastro ficou pendente.
    if (data.session === null || data.user === null) {
      return { ok: false, message: describeAuthError({ code: 'email_not_confirmed' }) }
    }
    return { ok: true, userId: data.user.id }
  } catch (error) {
    return { ok: false, message: describeAuthError(asAuthError(error)) }
  }
}

export async function signIn(request: SignInRequest): Promise<AuthOutcome> {
  authStorage.setRemember(request.remember)
  try {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: internalEmail(normalizeUsername(request.username)),
      password: request.password
    })
    if (error !== null) return { ok: false, message: describeAuthError(error) }
    return { ok: true, userId: data.user.id }
  } catch (error) {
    return { ok: false, message: describeAuthError(asAuthError(error)) }
  }
}

/** Sai da conta. Sem internet também funciona: a sessão local é apagada de qualquer jeito. */
export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut()
  } catch (error) {
    console.error('Falha ao sair da conta:', error)
  }
}

/**
 * Avisa quem está logado: na abertura do app (sessão guardada) e a cada login/logout.
 *
 * O callback do Supabase é síncrono e o aviso sai num `setTimeout`: quem ouve costuma
 * buscar o perfil logo em seguida, e chamar o Supabase de dentro do callback dele pode
 * travar a renovação do token.
 */
export function onAuthChange(callback: (userId: string | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null
    setTimeout(() => callback(userId), 0)
  })
  return () => data.subscription.unsubscribe()
}

function asAuthError(error: unknown): { message?: string; name?: string } {
  return error instanceof Error ? { message: error.message, name: error.name } : {}
}

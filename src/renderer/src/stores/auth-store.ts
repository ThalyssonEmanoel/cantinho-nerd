import { create } from 'zustand'
import { onAuthChange } from '@/lib/db/auth'
import { isSupabaseConfigured } from '@/lib/db/client'
import { errorMessage } from '@/lib/db/errors'
import { fetchProfile, type Profile } from '@/lib/db/profiles'

/**
 * Quem está logado (seção 4.1).
 *
 * `loading` cobre a abertura do app (o Supabase ainda está lendo a sessão guardada) e o
 * intervalo entre o login e o perfil chegar. As rotas protegidas esperam esse estado passar
 * em vez de mandar a pessoa de volta para o login à toa.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unconfigured'

interface AuthState {
  status: AuthStatus
  userId: string | null
  profile: Profile | null
  /** Falha ao buscar o perfil (o login vale, mas o nome e a foto não chegaram). */
  profileError: string | null

  /** Liga o app ao Supabase Auth. Devolve a função que desliga. */
  start: () => () => void
  /**
   * Aceita a sessão de um usuário (ou `null` ao sair). Chamado pelo ouvinte do Auth e pela
   * tela de login, que não espera o aviso do Supabase para seguir adiante.
   */
  acceptSession: (userId: string | null) => void
  setProfile: (profile: Profile) => void
}

/** Evita buscar o mesmo perfil duas vezes quando login e ouvinte avisam juntos. */
let loadingProfileFor: string | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  async function loadProfile(userId: string): Promise<void> {
    if (loadingProfileFor === userId) return
    loadingProfileFor = userId
    try {
      const profile = await fetchProfile(userId)
      // Saiu (ou trocou de conta) enquanto o perfil vinha: descarta.
      if (get().userId !== userId) return
      set({ profile, profileError: null, status: 'signed-in' })
    } catch (error) {
      if (get().userId !== userId) return
      set({ profile: null, profileError: errorMessage(error), status: 'signed-in' })
    } finally {
      if (loadingProfileFor === userId) loadingProfileFor = null
    }
  }

  return {
    status: 'loading',
    userId: null,
    profile: null,
    profileError: null,

    start: () => {
      if (!isSupabaseConfigured()) {
        set({ status: 'unconfigured' })
        return () => {}
      }
      return onAuthChange((userId) => get().acceptSession(userId))
    },

    acceptSession: (userId) => {
      if (userId === null) {
        loadingProfileFor = null
        set({ status: 'signed-out', userId: null, profile: null, profileError: null })
        return
      }

      const current = get()
      // Renovação de token: mesmo usuário, perfil já carregado — nada a fazer.
      if (current.userId === userId && current.status === 'signed-in') return

      if (current.userId !== userId) set({ userId, profile: null, profileError: null })
      set({ status: 'loading' })
      void loadProfile(userId)
    },

    setProfile: (profile) => set({ profile })
  }
})

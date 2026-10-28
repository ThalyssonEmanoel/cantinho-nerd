import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'gm' | 'player'

export interface LastSession {
  id: string
  name: string
}

interface AppState {
  /** O papel não é fixo na conta (seção 4.2): é só a última escolha nesta máquina. */
  role: Role | null
  /** Para oferecer "Voltar para <sessão>" no lobby. */
  lastSession: LastSession | null
  setRole: (role: Role) => void
  rememberSession: (session: LastSession) => void
  clear: () => void
}

/**
 * Preferências locais da máquina (um store por área, conforme as regras do projeto).
 * Persistido no localStorage, que é separado por perfil de dados — então a instância
 * `dev:p2` tem as suas próprias preferências.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      role: null,
      lastSession: null,
      setRole: (role) => set({ role }),
      rememberSession: (lastSession) => set({ lastSession }),
      clear: () => set({ role: null, lastSession: null })
    }),
    { name: 'cantinho-nerd:app' }
  )
)

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@/lib/db/auth'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Sair da conta: o botão do topo, a tela de Configurações e o fim da exclusão de conta.
 *
 * Vai para a entrada sem "voltar para onde estava": quem entrar depois pode ser outra conta,
 * e a tela anterior (um modelo, uma ficha) não seria dela.
 */
export function useSignOut(): { leaving: boolean; leave: () => Promise<void> } {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  async function leave(): Promise<void> {
    setLeaving(true)
    await signOut()
    useAppStore.getState().clear()
    useAuthStore.getState().acceptSession(null)
    void navigate('/login', { replace: true })
  }

  return { leaving, leave }
}

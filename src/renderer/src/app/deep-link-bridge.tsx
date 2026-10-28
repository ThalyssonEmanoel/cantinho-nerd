import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Liga o deep link `rpgmesa://join/<inviteId>` à rota interna `/join/:inviteId`.
 *
 * Dois caminhos: o link que abriu o app (fica pendente no processo principal até o
 * renderer pedir) e o link recebido com o app já aberto (instância única repassa o evento).
 */
export function DeepLinkBridge(): null {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    // Se a ponte do preload falhar, o convite por link para de funcionar — mas o app
    // inteiro não pode cair por causa disso (sem isto, a tela fica branca).
    try {
      void window.api.takePendingDeepLink().then((link) => {
        if (active && link !== null) void navigate(`/join/${link.inviteId}`)
      })

      const unsubscribe = window.api.onDeepLink((link) => {
        void navigate(`/join/${link.inviteId}`)
      })

      return () => {
        active = false
        unsubscribe()
      }
    } catch (error) {
      console.error('Ponte do deep link indisponível:', error)
      return () => {
        active = false
      }
    }
  }, [navigate])

  return null
}

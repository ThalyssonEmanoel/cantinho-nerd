import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useUpdateStatus } from './use-update-status'

/** Id fixo do aviso: o sonner troca o aviso com o mesmo id em vez de empilhar outro. */
const TOAST_ID = 'update-ready'

/**
 * "Nova versão pronta" (decisão 80). Fica na raiz do app, e não só nas telas de dentro, para
 * aparecer também na tela de entrada.
 *
 * A versão já foi baixada; o aviso só oferece reiniciar agora. Quem estiver no meio da
 * sessão fecha o aviso e continua jogando: a versão entra sozinha quando o app for fechado.
 */
export function UpdateNotifier(): null {
  const status = useUpdateStatus()
  const { pathname } = useLocation()
  const announced = useRef<string | null>(null)
  // A janela separada da ficha (Fase 13) não avisa: o aviso é da janela principal.
  const isSheetWindow = pathname.startsWith('/window/')

  useEffect(() => {
    if (isSheetWindow || status?.state !== 'ready') return
    if (announced.current === status.version) return
    announced.current = status.version

    toast.success(`Nova versão ${status.version} pronta`, {
      id: TOAST_ID,
      description:
        'Ela entra sozinha quando você fechar o app. Se quiser usar agora, reinicie (quem estiver numa mesa sai dela por alguns segundos).',
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: 'Reiniciar agora',
        onClick: () => void window.api.installUpdate()
      },
      cancel: {
        label: 'Depois',
        onClick: () => {}
      }
    })
  }, [status, isSheetWindow])

  return null
}

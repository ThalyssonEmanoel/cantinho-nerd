import { ExternalLink } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChatPanel } from '@/features/chat/chat-panel'
import { useChatStore } from '@/features/chat/chat-store'
import type { RollRequest } from '@/features/sheet-render/types'
import { SheetFillPage } from '@/features/sheets/sheet-fill-page'
import { useSessionStore } from './session-store'

interface SessionSheetPageProps {
  /**
   * A ficha já está na janela separada (Fase 13): sem voltar para a mesa, sem o chat ao
   * lado (a janela é estreita) e sem oferecer abrir outra janela da mesma ficha.
   */
  bare?: boolean
}

/**
 * Uma ficha dentro da sessão. Quem olha vem do login: o mestre da mesa vê e edita tudo,
 * o jogador vê só o que é dele (5.7). Os botões de rolagem mandam o resultado para o chat
 * da mesa, com o rótulo ("Furtividade: 17", 5.7), e o chat fica ao lado da ficha.
 */
export function SessionSheetPage({ bare = false }: SessionSheetPageProps): React.JSX.Element | null {
  const { sessionId, sheetId } = useParams<{ sessionId: string; sheetId: string }>()
  const navigate = useNavigate()
  const role = useSessionStore((state) => state.session?.role)

  if (sessionId === undefined || sheetId === undefined || role === undefined) return null

  function rollToTable(request: RollRequest): void {
    void useChatStore
      .getState()
      .roll({
        formula: request.formula,
        label: request.label,
        critical: request.critical,
        criticalFailureOnOne: request.criticalFailureOnOne,
        context: request.context
      })
      .then((result) => {
        if (!result.ok) toast.error('Não consegui rolar', { description: result.message })
      })
  }

  /** Abre esta ficha numa janela à parte, para o segundo monitor (Fase 13). */
  async function openInWindow(): Promise<void> {
    if (sessionId === undefined || sheetId === undefined) return
    const opened = await window.api?.openSheetWindow(sessionId, sheetId)
    if (opened !== true) {
      toast.error('Não consegui abrir a janela da ficha')
      return
    }
    // A mesa volta a aparecer aqui: ficar com a ficha nas duas janelas não ajuda ninguém.
    void navigate(`/session/${sessionId}`)
  }

  return (
    <SheetFillPage
      sheetId={sheetId}
      audience={role}
      backLabel={bare ? undefined : 'Voltar para a mesa'}
      onBack={bare ? undefined : () => void navigate(`/session/${sessionId}`)}
      onRoll={rollToTable}
      sidePanel={bare ? undefined : <ChatPanel />}
      headerActions={
        bare ? undefined : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openInWindow()}
            title="Abrir esta ficha numa janela separada (segundo monitor)"
          >
            <ExternalLink className="size-4" />
            Outra janela
          </Button>
        )
      }
    />
  )
}

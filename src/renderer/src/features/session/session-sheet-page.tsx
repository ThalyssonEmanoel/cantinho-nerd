import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChatPanel } from '@/features/chat/chat-panel'
import { useChatStore } from '@/features/chat/chat-store'
import type { RollRequest } from '@/features/sheet-render/types'
import { SheetFillPage } from '@/features/sheets/sheet-fill-page'
import { useSessionStore } from './session-store'

/**
 * Uma ficha dentro da sessão. Quem olha vem do login: o mestre da mesa vê e edita tudo,
 * o jogador vê só o que é dele (5.7). Os botões de rolagem mandam o resultado para o chat
 * da mesa, com o rótulo ("Furtividade: 17", 5.7), e o chat fica ao lado da ficha.
 */
export function SessionSheetPage(): React.JSX.Element | null {
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

  return (
    <SheetFillPage
      sheetId={sheetId}
      audience={role}
      backLabel="Voltar para a mesa"
      onBack={() => void navigate(`/session/${sessionId}`)}
      onRoll={rollToTable}
      sidePanel={<ChatPanel />}
    />
  )
}

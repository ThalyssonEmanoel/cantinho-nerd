import { useNavigate, useParams } from 'react-router-dom'
import { SheetFillPage } from '@/features/sheets/sheet-fill-page'
import { useSessionStore } from './session-store'

/**
 * Uma ficha dentro da sessão. Quem olha vem do login: o mestre da mesa vê e edita tudo,
 * o jogador vê só o que é dele (5.7). As mudanças dos outros chegam pelo canal da sessão,
 * que continua aberto no layout.
 */
export function SessionSheetPage(): React.JSX.Element | null {
  const { sessionId, sheetId } = useParams<{ sessionId: string; sheetId: string }>()
  const navigate = useNavigate()
  const role = useSessionStore((state) => state.session?.role)

  if (sessionId === undefined || sheetId === undefined || role === undefined) return null

  return (
    <SheetFillPage
      sheetId={sheetId}
      audience={role}
      backLabel="Voltar para a mesa"
      onBack={() => void navigate(`/session/${sessionId}`)}
    />
  )
}

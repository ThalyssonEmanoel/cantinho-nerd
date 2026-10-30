import { useEffect } from 'react'
import { toast } from 'sonner'
import { isMyTurn } from '@/lib/combat'
import { errorMessage } from '@/lib/db/errors'
import { isTypingTarget, shortcutFor, ZOOM_STEP, type BoardTool } from '@/lib/board'
import { useChatStore } from '@/features/chat/chat-store'
import { useCombatStore } from '@/features/combat/combat-store'
import { endMyTurn, nextTurn } from '@/features/combat/combat-actions'
import { removeTokens } from './board-actions'
import { useBoardStore } from './board-store'
import { undoLastDrawing } from './drawing-actions'
import { useLiveStore } from './live-store'

/**
 * Atalhos de teclado da mesa (Fase 13).
 *
 * Um ouvinte só, num lugar só: antes a mesa tinha teclado em três componentes diferentes,
 * e cada tela nova corria o risco de reagir a uma tecla que não era dela. O que cada tecla
 * significa está em `lib/board/shortcuts` (puro, testado); aqui só se executa.
 */
export function useBoardShortcuts(options: {
  /** Quem está olhando: o jogador mexe só nos próprios tokens. */
  role: 'gm' | 'player'
  userId: string | null
  /**
   * O tabuleiro está à vista? As teclas de ferramenta, zoom e Del valem só nele; Enter
   * (chat) e N (turno) valem em qualquer tela da mesa — inclusive na ficha.
   */
  onBoard: boolean
}): void {
  const { role, userId, onBoard } = options

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = shortcutFor(event, {
        typing: isTypingTarget(event.target),
        // Com uma janela aberta o tabuleiro não reage: o diálogo cuida do teclado dele.
        modal: document.querySelector('[role="dialog"]') !== null
      })
      if (action === null) return

      // Fora do tabuleiro, só o que é da mesa inteira.
      const boardOnly = action.kind !== 'chat' && action.kind !== 'turn' && action.kind !== 'help'
      if (!onBoard && boardOnly) return

      const board = useBoardStore.getState()

      switch (action.kind) {
        case 'tool':
          event.preventDefault()
          applyTool(action.tool)
          return

        case 'zoom':
          event.preventDefault()
          board.zoomStep(action.in ? ZOOM_STEP : 1 / ZOOM_STEP)
          return

        case 'fit':
          event.preventDefault()
          board.fit()
          return

        case 'escape': {
          // Esc larga o que está na mão: a seleção, a régua e o traço começado.
          board.clearSelection()
          const live = useLiveStore.getState()
          live.setDraft(null)
          live.setMyRuler(null)
          live.setFogDraft(null)
          return
        }

        case 'delete': {
          const mine = board.tokens.filter(
            (token) =>
              board.selection.includes(token.id) && (role === 'gm' || token.ownerId === userId)
          )
          if (mine.length === 0) return
          event.preventDefault()
          void removeTokens(mine).catch((error: unknown) => {
            toast.error('Não consegui excluir', { description: errorMessage(error) })
          })
          return
        }

        case 'undo':
          event.preventDefault()
          void undoLastDrawing(userId).catch((error: unknown) => {
            toast.error('Não consegui desfazer', { description: errorMessage(error) })
          })
          return

        case 'chat':
          event.preventDefault()
          useChatStore.getState().requestFocus()
          return

        case 'turn':
          event.preventDefault()
          void passTurn(role, userId)
          return

        case 'help':
          // A ajuda tem o próprio ouvinte, na casca do app (ele também fecha com F1).
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [role, userId, onBoard])
}

/** A ferramenta de desenho e a borracha são a mesma ferramenta com modos diferentes. */
function applyTool(tool: BoardTool): void {
  const board = useBoardStore.getState()
  if (tool === 'draw') board.setDrawTool(board.drawTool)
  else board.setTool(tool)
}

/** N passa o turno: o mestre avança a fila, o jogador encerra o dele (7.3). */
async function passTurn(role: 'gm' | 'player', userId: string | null): Promise<void> {
  const combat = useCombatStore.getState()
  if (!combat.state.active) return

  try {
    if (role === 'gm') {
      await nextTurn()
      return
    }
    if (isMyTurn(combat.entries, combat.state, userId)) await endMyTurn()
  } catch (error) {
    toast.error('Não consegui passar o turno', { description: errorMessage(error) })
  }
}

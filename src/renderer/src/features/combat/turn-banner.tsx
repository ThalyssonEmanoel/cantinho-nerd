import { useEffect, useRef, useState } from 'react'
import { Play, SkipForward, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { currentEntry, entryLabel, isMyTurn } from '@/lib/combat'
import { playTurnChime } from '@/lib/chat/sound'
import { errorMessage } from '@/lib/db/errors'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSessionStore } from '@/features/session/session-store'
import { endMyTurn, nextTurn } from './combat-actions'
import { useCombatStore } from './combat-store'

/**
 * A faixa do turno por cima do tabuleiro (7.3): rodada, de quem é a vez e o botão de passar.
 * Fica no mapa para ninguém precisar abrir a aba do combate no meio da cena.
 */
export function TurnBanner(): React.JSX.Element | null {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const userId = useAuthStore((state) => state.userId)
  const state = useCombatStore((state) => state.state)
  const entries = useCombatStore((state) => state.entries)
  const [busy, setBusy] = useState(false)

  if (!state.active) return null

  const isGm = role === 'gm'
  const current = currentEntry(entries, state)
  const mine = isMyTurn(entries, state, userId)

  async function pass(): Promise<void> {
    setBusy(true)
    try {
      await (isGm ? nextTurn() : endMyTurn())
    } catch (error) {
      toast.error('Não consegui passar o turno', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  let who: string
  if (current !== null) who = mine ? 'Sua vez!' : `Vez de ${entryLabel(current, isGm)}`
  else if (state.turnEntryId === null) who = isGm ? 'Pronto para começar' : 'Esperando o mestre'
  // A vez é de alguém que este jogador não vê (um participante oculto).
  else who = 'Vez de alguém'

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'bg-card/90 pointer-events-auto flex items-center gap-2 rounded-full border py-1 pr-1 pl-3 text-sm shadow-lg backdrop-blur',
          mine && 'border-amber-400/80'
        )}
      >
        <Swords className="text-muted-foreground size-4" />
        <span className="text-muted-foreground tabular-nums">Rodada {state.round}</span>
        <span className="font-medium">{who}</span>
        {(isGm && entries.length > 0) || mine ? (
          <Button size="sm" className="h-7 rounded-full" disabled={busy} onClick={() => void pass()}>
            {isGm && state.turnEntryId === null ? (
              <>
                <Play className="size-3.5" />
                Começar
              </>
            ) : (
              <>
                <SkipForward className="size-3.5" />
                {isGm ? 'Próximo turno' : 'Encerrar meu turno'}
              </>
            )}
          </Button>
        ) : (
          <span className="pr-2" />
        )}
      </div>
    </div>
  )
}

/**
 * "Sua vez!" (7.3): o dono do participante da vez recebe o aviso e um som, em qualquer tela
 * da sessão (fica montado na casca da sessão, não no tabuleiro). O mestre não recebe: ele é
 * dono de todos os monstros e seria avisado a cada turno.
 */
export function TurnNotifier(): null {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const userId = useAuthStore((state) => state.userId)
  const myTurnId = useCombatStore((state) =>
    isMyTurn(state.entries, state.state, userId) ? state.state.turnEntryId : null
  )
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (role === 'player' && myTurnId !== null && myTurnId !== last.current) {
      toast.success('Sua vez!', { description: 'Quando terminar, clique em "Encerrar meu turno".' })
      // O som se desliga em Configurações; o aviso na tela fica sempre.
      if (useAppStore.getState().turnSound) playTurnChime()
    }
    last.current = myTurnId
  }, [myTurnId, role])

  return null
}

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { clueHeadline } from '@/lib/session/clues'
import { useSessionStore } from '@/features/session/session-store'
import { useCluesStore } from './clues-store'

/**
 * Avisa o jogador quando o mestre revela uma pista (Fase 13).
 *
 * Fica na casca da sessão, como o "Sua vez!": a pista pode ser revelada enquanto a pessoa
 * está na ficha, e aí ela precisa saber que tem coisa nova na aba Pistas.
 */
export function ClueNotifier(): null {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const unseen = useCluesStore((state) => state.unseen)
  const announced = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (role === 'gm') return

    for (const id of unseen) {
      if (announced.current.has(id)) continue
      announced.current.add(id)

      const clue = useCluesStore.getState().clues.find((item) => item.id === id)
      toast.success('O mestre revelou uma pista', {
        description: clue === undefined ? undefined : clueHeadline(clue)
      })
    }
  }, [unseen, role])

  return null
}

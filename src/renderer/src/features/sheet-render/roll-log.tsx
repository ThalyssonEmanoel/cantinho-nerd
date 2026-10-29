import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RollOutcome, RolledDie } from '@/lib/dice'
import { RollResult } from '@/features/chat/roll-result'

export interface RollLogEntry {
  id: string
  label: string
  notation: string
  detail: string
  total: number
  dice: RolledDie[]
  outcome: RollOutcome
}

interface RollLogProps {
  entries: readonly RollLogEntry[]
  onClear: () => void
  /** Texto mostrado quando ainda não houve rolagem. */
  emptyHint?: string
}

/**
 * Painel local de rolagens do "Ver como jogador" do construtor: serve para o mestre
 * conferir se os botões do modelo fazem o que ele esperava. Na mesa, as rolagens vão para o
 * chat (Fase 7).
 */
export function RollLog({ entries, onClear, emptyHint }: RollLogProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Rolagens
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={entries.length === 0}
          onClick={onClear}
          aria-label="Limpar rolagens"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {entries.length === 0 && (
          <p className="text-muted-foreground text-xs">
            {emptyHint ?? 'Use um botão de rolagem da ficha para testar.'}
          </p>
        )}

        {entries.map((entry) => (
          <RollResult key={entry.id} roll={entry} />
        ))}
      </div>
    </div>
  )
}

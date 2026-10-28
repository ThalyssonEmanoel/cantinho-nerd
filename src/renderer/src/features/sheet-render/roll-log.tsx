import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RollOutcome, RolledDie } from '@/lib/dice'
import { cn } from '@/lib/utils'

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
 * Painel local de rolagens. Na Fase 7 o resultado passa a ir para o chat da sessão; aqui
 * ele serve para o mestre conferir se os botões do modelo fazem o que ele esperava.
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
          <div
            key={entry.id}
            className={cn(
              'rounded-md border p-2 text-sm',
              entry.outcome === 'critical' && 'border-primary/60 bg-primary/10',
              entry.outcome === 'critical-failure' && 'border-destructive/60 bg-destructive/10'
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{entry.label}</span>
              <span className="text-lg font-semibold tabular-nums">{entry.total}</span>
            </div>

            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
              <code className="bg-muted rounded px-1">{entry.notation}</code>
              {entry.dice.map((die, index) => (
                <span
                  key={index}
                  title={`d${die.sides}${die.dropped ? ' (descartado)' : ''}`}
                  className={cn(
                    'rounded border px-1',
                    die.dropped && 'text-muted-foreground/60 line-through',
                    !die.dropped &&
                      die.sides === 20 &&
                      die.value === 20 &&
                      'border-primary text-primary',
                    !die.dropped &&
                      die.sides === 20 &&
                      die.value === 1 &&
                      'border-destructive text-destructive'
                  )}
                >
                  {die.value}
                </span>
              ))}
            </div>

            {entry.outcome !== 'normal' && (
              <p
                className={cn(
                  'mt-1 text-xs font-semibold uppercase',
                  entry.outcome === 'critical' ? 'text-primary' : 'text-destructive'
                )}
              >
                {entry.outcome === 'critical' ? 'Crítico!' : 'Falha crítica'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

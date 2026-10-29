import type { RollOutcome, RolledDie } from '@/lib/dice'
import { cn } from '@/lib/utils'

export interface RollResultData {
  label: string
  notation: string
  total: number
  dice: readonly RolledDie[]
  outcome: RollOutcome
}

/**
 * Uma rolagem desenhada (7.1): cada dado (o descartado riscado, o que explodiu marcado), o
 * total e o destaque de crítico ou falha crítica. Usado no chat da mesa e no painel local
 * de teste do construtor.
 */
export function RollResult({
  roll,
  className
}: {
  roll: RollResultData
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border p-2 text-sm',
        roll.outcome === 'critical' && 'border-primary/60 bg-primary/10',
        roll.outcome === 'critical-failure' && 'border-destructive/60 bg-destructive/10',
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{roll.label === '' ? 'Rolagem' : roll.label}</span>
        <span className="text-lg font-semibold tabular-nums">{roll.total}</span>
      </div>

      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
        <code className="bg-muted rounded px-1">{roll.notation}</code>
        {roll.dice.map((die, index) => (
          <span
            key={index}
            title={`d${die.sides}${die.dropped ? ' (descartado)' : ''}${die.exploded ? ' (explodiu)' : ''}`}
            className={cn(
              'rounded border px-1 tabular-nums',
              die.dropped && 'text-muted-foreground/60 line-through',
              die.exploded && 'border-amber-400/70 text-amber-300',
              !die.dropped && die.sides === 20 && die.value === 20 && 'border-primary text-primary',
              !die.dropped &&
                die.sides === 20 &&
                die.value === 1 &&
                'border-destructive text-destructive'
            )}
          >
            {die.value}
            {die.exploded && '!'}
          </span>
        ))}
      </div>

      {roll.outcome !== 'normal' && (
        <p
          className={cn(
            'mt-1 text-xs font-semibold uppercase',
            roll.outcome === 'critical' ? 'text-primary' : 'text-destructive'
          )}
        >
          {roll.outcome === 'critical' ? 'Crítico!' : 'Falha crítica'}
        </p>
      )}
    </div>
  )
}

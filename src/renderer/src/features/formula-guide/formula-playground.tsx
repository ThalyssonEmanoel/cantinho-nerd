import { useMemo, useState } from 'react'
import { Dices, Sigma } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rollFormula, type RollSummary } from '@/lib/dice'
import { cn } from '@/lib/utils'
import {
  describeValue,
  evaluateGuideFormula,
  guideContext,
  interpolateGuideRoll
} from './guide-sample'

type Mode = 'formula' | 'roll'

const SUGGESTIONS: Record<Mode, string[]> = {
  formula: [
    '=forca.mod + proficiencia',
    '=vida.max - vida',
    '=se(classe == "Ocultista", 3, 1)',
    '=soma(inventario.peso) > forca',
    '=pericias.atletismo.total'
  ],
  roll: [
    '1d20 + {forca.mod}',
    '{agilidade}d20kh1',
    '2d6 + {forca.mod}',
    '4d6kh3',
    '1d20 + {pericias.percepcao.total}'
  ]
}

/**
 * Caixa de testes do guia: qualquer fórmula, calculada na hora sobre a ficha de exemplo.
 * É o mesmo motor da ficha de verdade, então o que dá certo aqui dá certo no construtor.
 */
export function FormulaPlayground(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('formula')
  const [source, setSource] = useState('=10 + constituicao.mod * nivel')
  const [roll, setRoll] = useState<RollSummary | null>(null)
  const [rollError, setRollError] = useState<string | null>(null)

  const formulaResult = useMemo(
    () => (mode === 'formula' ? evaluateGuideFormula(source) : null),
    [mode, source]
  )
  const notation = useMemo(
    () => (mode === 'roll' ? interpolateGuideRoll(source) : null),
    [mode, source]
  )

  function switchMode(next: Mode): void {
    setMode(next)
    setSource(next === 'formula' ? '=10 + constituicao.mod * nivel' : '1d20 + {forca.mod}')
    setRoll(null)
    setRollError(null)
  }

  function handleRoll(): void {
    const result = rollFormula(source, {
      label: 'Teste',
      context: guideContext(),
      critical: { kind: 'natural' },
      criticalFailureOnOne: true
    })
    if (result.ok) {
      setRoll(result.roll)
      setRollError(null)
    } else {
      setRoll(null)
      setRollError(result.error.message)
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="bg-muted inline-grid grid-cols-2 gap-1 rounded-lg p-1">
        <ModeButton active={mode === 'formula'} onClick={() => switchMode('formula')}>
          <Sigma className="size-3.5" />
          Campo calculado
        </ModeButton>
        <ModeButton active={mode === 'roll'} onClick={() => switchMode('roll')}>
          <Dices className="size-3.5" />
          Rolagem
        </ModeButton>
      </div>

      <div className="flex gap-2">
        <Input
          className="font-mono text-sm"
          value={source}
          spellCheck={false}
          aria-label="Fórmula para testar"
          onChange={(event) => {
            setSource(event.target.value)
            setRoll(null)
            setRollError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && mode === 'roll') handleRoll()
          }}
        />
        {mode === 'roll' && (
          <Button onClick={handleRoll} disabled={notation === null || !notation.ok}>
            <Dices className="size-4" />
            Rolar
          </Button>
        )}
      </div>

      <div className="min-h-12 rounded-md border border-dashed px-3 py-2 text-sm">
        {mode === 'formula' &&
          formulaResult !== null &&
          (formulaResult.ok ? (
            <p>
              Resultado:{' '}
              <strong className="text-emerald-400">{describeValue(formulaResult.value)}</strong>
            </p>
          ) : (
            <p className="text-destructive">#ERRO — {formulaResult.error.message}</p>
          ))}

        {mode === 'roll' && notation !== null && (
          <div className="space-y-1">
            {notation.ok ? (
              <p>
                Vai rolar: <code className="font-mono text-emerald-400">{notation.value}</code>
              </p>
            ) : (
              <p className="text-destructive">#ERRO — {notation.error.message}</p>
            )}
            {roll !== null && (
              <p>
                Total <strong className="text-lg">{roll.total}</strong>
                <span className="text-muted-foreground"> · {roll.detail}</span>
                {roll.outcome === 'critical' && (
                  <span className="ml-2 text-emerald-400">Crítico!</span>
                )}
                {roll.outcome === 'critical-failure' && (
                  <span className="text-destructive ml-2">Falha crítica!</span>
                )}
              </p>
            )}
            {rollError !== null && <p className="text-destructive">{rollError}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Experimente:</span>
        {SUGGESTIONS[mode].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="bg-muted hover:bg-accent rounded px-2 py-0.5 font-mono text-xs transition-colors"
            onClick={() => {
              setSource(suggestion)
              setRoll(null)
              setRollError(null)
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

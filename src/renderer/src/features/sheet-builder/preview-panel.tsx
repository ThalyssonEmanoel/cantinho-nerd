import { useMemo, useState } from 'react'
import { rollFormula, type RollSummary } from '@/lib/dice'
import {
  createPreviewValues,
  createSheetContext,
  newId,
  type SheetSchema,
  type SheetValue,
  type SheetValues
} from '@/lib/sheet'
import { SheetView } from '@/features/sheet-render/sheet-view'
import { RollLog, type RollLogEntry } from '@/features/sheet-render/roll-log'
import type { RollRequest, SheetAudience } from '@/features/sheet-render/types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PreviewPanelProps {
  schema: SheetSchema
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
}

/**
 * "Visualizar como jogador" (5.2): a mesma ficha, preenchível, com valores de teste e as
 * fórmulas funcionando de verdade. É aqui que o mestre descobre se o modelo faz sentido
 * antes de publicar.
 */
export function PreviewPanel({
  schema,
  activeTabId,
  onSelectTab
}: PreviewPanelProps): React.JSX.Element {
  // Valores de teste só do preview: não encostam na ficha de ninguém.
  const [values, setValues] = useState<SheetValues>(() => createPreviewValues(schema))
  const [audience, setAudience] = useState<SheetAudience>('player')
  const [log, setLog] = useState<RollLogEntry[]>([])

  const context = useMemo(() => createSheetContext(schema, values).context, [schema, values])
  const tabId = activeTabId ?? schema.tabs[0]?.id ?? ''

  function handleChange(componentId: string, value: SheetValue): void {
    setValues((current) => ({ ...current, [componentId]: value }))
  }

  function handleRoll(request: RollRequest): void {
    const result = rollFormula(request.formula, {
      label: request.label,
      critical: request.critical,
      criticalFailureOnOne: request.criticalFailureOnOne,
      context: request.context
    })

    if (!result.ok) {
      toast.error('Não consegui rolar', { description: result.error.message })
      return
    }

    setLog((current) => [toLogEntry(result.roll), ...current].slice(0, 30))
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] divide-x">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="flex gap-1">
            {schema.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm transition-colors',
                  tab.id === tabId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                {tab.label === '' ? 'Sem nome' : tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Vendo como</span>
            <Button
              variant={audience === 'player' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAudience('player')}
            >
              Jogador
            </Button>
            <Button
              variant={audience === 'gm' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAudience('gm')}
            >
              Mestre
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <SheetView
            schema={schema}
            tabId={tabId}
            values={values}
            context={context}
            options={{
              audience,
              applyConditionalVisibility: true,
              onChange: handleChange,
              onRoll: handleRoll
            }}
          />
        </div>
      </div>

      <RollLog
        entries={log}
        onClear={() => setLog([])}
        emptyHint="Clique num botão de rolagem da ficha para testar a fórmula."
      />
    </div>
  )
}

function toLogEntry(roll: RollSummary): RollLogEntry {
  return {
    id: newId('roll'),
    label: roll.label ?? 'Rolagem',
    notation: roll.notation,
    detail: roll.detail,
    total: roll.total,
    dice: roll.dice,
    outcome: roll.outcome
  }
}

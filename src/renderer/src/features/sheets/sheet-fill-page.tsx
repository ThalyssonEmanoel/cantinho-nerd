import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { SaveIndicator } from '@/components/save-indicator'
import { rollFormula, type RollSummary } from '@/lib/dice'
import {
  createSheetContext,
  mergedValues,
  newId,
  projectSheetFor,
  type SheetAudience
} from '@/lib/sheet'
import { RollLog, type RollLogEntry } from '@/features/sheet-render/roll-log'
import { SheetView } from '@/features/sheet-render/sheet-view'
import type { RollRequest } from '@/features/sheet-render/types'
import { cn } from '@/lib/utils'
import { sheetRepository } from './repository'
import { useSheetStore } from './sheet-store'

interface SheetFillPageProps {
  sheetId: string
  /** Quem está olhando, vindo do login e da sessão: o mestre vê e edita tudo (5.7). */
  audience: SheetAudience
  backLabel: string
  onBack: () => void
  /**
   * Para onde vão as rolagens dos botões. Na mesa, para o chat (Fase 7); sem isto, ficam
   * num painel local, como no teste do construtor.
   */
  onRoll?: (request: RollRequest) => void
  /** O que ocupa a coluna da direita no lugar do painel local (o chat da mesa). */
  sidePanel?: React.ReactNode
}

/**
 * Ficha em modo de preenchimento (seção 5.7).
 *
 * É o mesmo renderizador do construtor: o que muda são as opções. Aqui ele edita de
 * verdade, respeitando quem vê e quem edita cada campo, e cada alteração vai para o
 * repositório como um patch de um campo só. O que outras pessoas gravam chega pelo canal
 * da sessão e entra sem desfazer o que está sendo digitado aqui.
 */
export function SheetFillPage({
  sheetId,
  audience: viewerAudience,
  backLabel,
  onBack,
  onRoll,
  sidePanel
}: SheetFillPageProps): React.JSX.Element {
  const store = useSheetStore()
  const {
    sheet,
    schema,
    audience,
    activeTabId,
    loadState,
    saveState,
    lastError,
    loadError,
    migration
  } = store
  const [log, setLog] = useState<RollLogEntry[]>([])

  // Abre a ficha e liga o store ao repositório.
  useEffect(() => {
    const state = useSheetStore.getState()
    state.attach(sheetRepository)
    state.setAudience(viewerAudience)
    void state.open(sheetId)

    return () => {
      // Sair da tela não pode perder o que estava na fila dos últimos milissegundos.
      void useSheetStore.getState().flush()
      useSheetStore.getState().close()
    }
    // Só reabre quando muda de ficha; quem olha é acertado no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId])

  useEffect(() => {
    useSheetStore.getState().setAudience(viewerAudience)
  }, [viewerAudience])

  // A recusa do repositório é avisada uma vez, quando acontece.
  useEffect(() => {
    if (lastError !== null) toast.error('Não consegui salvar', { description: lastError })
  }, [lastError])

  /** A ficha do jeito que esta plateia pode recebê-la: o jogador não leva os dados do mestre. */
  const visible = useMemo(
    () => (sheet === null || schema === null ? null : projectSheetFor(schema, sheet, audience)),
    [sheet, schema, audience]
  )

  const values = useMemo(() => (visible === null ? {} : mergedValues(visible)), [visible])

  const context = useMemo(
    () => (schema === null ? null : createSheetContext(schema, values).context),
    [schema, values]
  )

  function handleRoll(request: RollRequest): void {
    if (onRoll !== undefined) {
      onRoll(request)
      return
    }
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

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando a ficha…
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <LoadProblem
        message={`Não consegui abrir a ficha. ${loadError ?? ''}`}
        backLabel={backLabel}
        onBack={onBack}
      />
    )
  }

  if (loadState === 'missing') {
    return (
      <LoadProblem
        message="Esta ficha não existe mais, ou você não tem acesso a ela."
        backLabel={backLabel}
        onBack={onBack}
      />
    )
  }

  if (loadState === 'no-template' || schema === null || sheet === null || context === null) {
    return (
      <LoadProblem
        message="O modelo desta ficha não está mais disponível. Os valores continuam guardados, mas sem o modelo não há como desenhar a ficha."
        backLabel={backLabel}
        onBack={onBack}
      />
    )
  }

  const tabId = activeTabId ?? schema.tabs[0]?.id ?? ''
  const orphanedCount = Object.keys(sheet.orphaned).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {sheet.summary.name === undefined || sheet.summary.name.trim() === ''
              ? 'Personagem sem nome'
              : sheet.summary.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {sheet.ownerName} · {sheet.templateName}
          </p>
        </div>

        <Badge variant="secondary">v{sheet.templateVersion}</Badge>
        <SaveIndicator state={saveState} />

        {audience === 'gm' && (
          <span
            className="text-muted-foreground ml-auto flex items-center gap-1 text-xs"
            title="Você vê e edita também os campos que são só do mestre."
          >
            <Eye className="size-3" />
            Vendo como mestre
          </span>
        )}
      </div>

      {migration !== null && (
        <div className="bg-primary/10 border-primary/30 flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
          <Sparkles className="text-primary size-3.5" />
          <span>
            O modelo foi atualizado: esta ficha passou da v{migration.fromVersion} para a v
            {migration.toVersion}.
            {migration.addedLabels.length > 0 &&
              ` Campos novos: ${migration.addedLabels.slice(0, 6).join(', ')}.`}
            {migration.orphanedCount > 0 &&
              ` ${migration.orphanedCount} valor(es) de campos removidos ficaram guardados.`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6"
            onClick={() => store.dismissMigration()}
          >
            Entendi
          </Button>
        </div>
      )}

      <div
        className={cn(
          'grid min-h-0 flex-1 divide-x',
          sidePanel === undefined ? 'grid-cols-[1fr_18rem]' : 'grid-cols-[1fr_20rem]'
        )}
      >
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-1 border-b px-3 py-2">
            {schema.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => store.setActiveTab(tab.id)}
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

            {audience === 'gm' && orphanedCount > 0 && (
              <span
                className="text-muted-foreground ml-auto text-xs"
                title="Campos que saíram do modelo. O valor volta sozinho se o campo voltar."
              >
                {orphanedCount} valor(es) guardado(s)
              </span>
            )}
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
                onChange: (componentId, value) => store.changeField(componentId, value),
                onRoll: handleRoll
              }}
            />
          </div>
        </div>

        {sidePanel ?? (
          <RollLog
            entries={log}
            onClear={() => setLog([])}
            emptyHint="As rolagens aparecem aqui."
          />
        )}
      </div>
    </div>
  )
}

function LoadProblem({
  message,
  backLabel,
  onBack
}: {
  message: string
  backLabel: string
  onBack: () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <PageHeader title="Ficha" />
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {backLabel}
      </Button>
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

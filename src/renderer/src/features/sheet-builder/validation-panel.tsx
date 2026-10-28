import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ValidationReport } from '@/lib/sheet'
import { cn } from '@/lib/utils'

interface ValidationPanelProps {
  report: ValidationReport
  onSelectComponent: (componentId: string, tabId?: string) => void
}

/** Resultado do Validar (5.2). Clicar num problema leva até o componente. */
export function ValidationPanel({
  report,
  onSelectComponent
}: ValidationPanelProps): React.JSX.Element {
  if (report.issues.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
        <CheckCircle2 className="size-4 text-emerald-500" />
        Nenhum problema encontrado.
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {report.issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`}>
          <button
            type="button"
            disabled={issue.componentId === undefined}
            onClick={() => {
              if (issue.componentId !== undefined) onSelectComponent(issue.componentId, issue.tabId)
            }}
            className={cn(
              'flex w-full items-start gap-2 px-3 py-2 text-left text-sm',
              issue.componentId !== undefined && 'hover:bg-accent/50'
            )}
          >
            {issue.severity === 'error' ? (
              <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            )}
            <span>{issue.message}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

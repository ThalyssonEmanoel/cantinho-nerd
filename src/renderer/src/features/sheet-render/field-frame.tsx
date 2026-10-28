import { EyeOff, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SheetComponent } from '@/lib/sheet'
import { cn } from '@/lib/utils'

interface FieldFrameProps {
  component: SheetComponent
  children: ReactNode
  /** Mostra as marcas de "só mestre" (no construtor). */
  showPermissions?: boolean
  className?: string
}

/** Moldura comum: rótulo, dica, cor de destaque e as marcas de permissão. */
export function FieldFrame({
  component,
  children,
  showPermissions = false,
  className
}: FieldFrameProps): React.JSX.Element {
  const gmOnlyView = component.visibleTo === 'gm'
  const gmOnlyEdit = component.editableBy === 'gm'

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col gap-1', className)}
      style={
        component.accent === undefined ? undefined : { ['--accent' as string]: component.accent }
      }
    >
      {component.label !== '' && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-muted-foreground truncate text-xs font-medium uppercase tracking-wide"
            title={component.hint ?? component.label}
            style={component.accent === undefined ? undefined : { color: component.accent }}
          >
            {component.label}
          </span>
          {showPermissions && gmOnlyView && (
            <span title="Só o mestre vê" className="shrink-0">
              <EyeOff className="text-destructive size-3" />
            </span>
          )}
          {showPermissions && !gmOnlyView && gmOnlyEdit && (
            <span title="Só o mestre edita" className="shrink-0">
              <Lock className="text-muted-foreground size-3" />
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

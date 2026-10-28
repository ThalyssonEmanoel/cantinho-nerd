import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  className?: string
}

/**
 * Caixa de diálogo simples. Fecha com Esc e com clique fora.
 *
 * Feita à mão em vez de usar `window.confirm`: o diálogo nativo do Chromium bloqueia o
 * processo e não combina com o tema do app.
 */
export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className
}: DialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'bg-card animate-in fade-in zoom-in-95 w-full max-w-lg rounded-xl border p-5 shadow-xl duration-150',
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold tracking-tight">{title}</h2>
            {description !== undefined && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </Button>
        </div>

        {children}

        {footer !== undefined && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

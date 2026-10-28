import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface PropertyFieldProps {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
  error?: string
}

/** Linha do painel de propriedades: rótulo em cima, controle embaixo, erro logo abaixo. */
export function PropertyField({
  label,
  hint,
  htmlFor,
  children,
  error
}: PropertyFieldProps): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {error !== undefined && <p className="text-destructive text-xs">{error}</p>}
      {error === undefined && hint !== undefined && (
        <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  )
}

/** Separador com título, para agrupar as propriedades específicas do tipo. */
export function PropertyGroup({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3 border-t pt-3">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</p>
      {children}
    </section>
  )
}

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

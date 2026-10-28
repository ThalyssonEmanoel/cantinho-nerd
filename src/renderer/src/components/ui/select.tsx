import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Select nativo, estilizado. Suficiente para listas curtas e sem dependência extra —
 * quando precisar de busca ou grupos, entra o componente do shadcn por cima.
 */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>): React.JSX.Element {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'border-input bg-background/40 flex h-9 w-full appearance-none rounded-md border px-3 pr-8 text-sm shadow-xs outline-none transition-[color,box-shadow]',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
    </div>
  )
}

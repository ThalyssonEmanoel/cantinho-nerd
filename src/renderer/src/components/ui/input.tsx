import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-input bg-background/40 placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

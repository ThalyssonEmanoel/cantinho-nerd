import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input bg-background/40 placeholder:text-muted-foreground flex min-h-16 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

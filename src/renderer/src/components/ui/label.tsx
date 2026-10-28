import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<'label'>): React.JSX.Element {
  return (
    <label
      data-slot="label"
      className={cn('text-sm font-medium leading-none select-none', className)}
      {...props}
    />
  )
}

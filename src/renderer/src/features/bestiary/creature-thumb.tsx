import { PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAssetImage } from '@/features/board/use-asset-image'

/** A imagem da criatura num círculo, como o token dela vai ficar (ou um ícone, sem imagem). */
export function CreatureThumb({
  path,
  className
}: {
  path: string | null
  className?: string
}): React.JSX.Element {
  const { image } = useAssetImage(path)
  return (
    <span
      className={cn(
        'bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
        className ?? 'size-10'
      )}
      aria-hidden="true"
    >
      {image === null ? (
        <PawPrint className="text-muted-foreground size-1/2" />
      ) : (
        <img src={image.src} alt="" className="size-full object-cover" />
      )}
    </span>
  )
}

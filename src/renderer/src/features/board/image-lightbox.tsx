import { useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAssetImage } from '@/hooks/use-asset-image'

interface ImageLightboxProps {
  path: string | null
  title: string
  onClose: () => void
}

/** "Ampliar a imagem" do token em tela cheia (6.3). */
export function ImageLightbox({ path, title, onClose }: ImageLightboxProps): React.JSX.Element | null {
  const { image, loading } = useAssetImage(path)

  useEffect(() => {
    if (path === null) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [path, onClose])

  if (path === null) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex w-full max-w-4xl items-center justify-between gap-4">
        <p className="truncate font-medium">{title}</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </div>

      {loading && <Loader2 className="text-muted-foreground size-6 animate-spin" />}
      {image !== null && (
        <img
          src={image.src}
          alt={title}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
          draggable={false}
        />
      )}
    </div>
  )
}

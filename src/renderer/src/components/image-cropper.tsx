import { useEffect, useRef, useState } from 'react'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  cropSourceRect,
  displayedSize,
  INITIAL_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  zoomTo,
  type CropState,
  type Size
} from '@/lib/image/crop'
import { AVATAR_SIZE, loadImageFile, renderCropToWebp } from '@/lib/image/upload'
import { cn } from '@/lib/utils'

/** Lado do quadro de recorte na tela. */
const VIEWPORT = 240

interface LoadedImage {
  image: HTMLImageElement
  url: string
  size: Size
}

interface ImageCropperProps {
  /** Arquivo escolhido. Com arquivo, a janela abre. */
  file: File | null
  onCancel: () => void
  /** Recebe o recorte já em WebP. A janela fica esperando enquanto ele envia. */
  onConfirm: (image: Blob) => Promise<void>
  title?: string
  description?: string
  confirmLabel?: string
  /** Lado da imagem salva, em pixels. O avatar usa 256; um retrato de ficha, mais. */
  size?: number
  /** O quadro é redondo (avatar, token) ou quadrado (retrato de ficha retangular). */
  shape?: 'circle' | 'rect'
}

/**
 * Recorte de imagem numa janela (seções 9 e 5.3). Arrastar move a foto dentro do quadro; a
 * roda do mouse e o controle aproximam. O que está no quadro é exatamente o que vai ser
 * salvo, já convertido para WebP.
 *
 * Serve ao avatar da conta e ao retrato da ficha: a conta é a mesma, muda só o tamanho
 * salvo e a forma do quadro.
 */
export function ImageCropper({
  file,
  onCancel,
  onConfirm,
  title = 'Enquadrar a foto',
  description = 'Arraste para posicionar. Use a roda do mouse ou o controle para aproximar.',
  confirmLabel = 'Salvar foto',
  size = AVATAR_SIZE,
  shape = 'circle'
}: ImageCropperProps): React.JSX.Element {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null)
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP)
  const [saving, setSaving] = useState(false)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (file === null) return

    let active = true
    let release: (() => void) | null = null

    void loadImageFile(file).then(
      (result) => {
        release = result.release
        if (!active) {
          result.release()
          return
        }
        setLoaded({
          image: result.image,
          url: result.url,
          size: { width: result.image.naturalWidth, height: result.image.naturalHeight }
        })
        setCrop(INITIAL_CROP)
      },
      (error: unknown) => {
        if (!active) return
        toast.error('Não consegui abrir a imagem', {
          description: error instanceof Error ? error.message : undefined
        })
        onCancel()
      }
    )

    return () => {
      active = false
      release?.()
      setLoaded(null)
    }
  }, [file, onCancel])

  async function handleConfirm(): Promise<void> {
    if (loaded === null) return
    setSaving(true)
    try {
      const blob = await renderCropToWebp(
        loaded.image,
        cropSourceRect(crop, loaded.size, VIEWPORT),
        size
      )
      await onConfirm(blob)
    } catch (error) {
      toast.error('Não consegui salvar a foto', {
        description: error instanceof Error ? error.message : undefined
      })
    } finally {
      setSaving(false)
    }
  }

  const shown = loaded === null ? null : displayedSize(crop, loaded.size, VIEWPORT)

  return (
    <Dialog
      open={file !== null}
      title={title}
      description={description}
      onClose={() => {
        if (!saving) onCancel()
      }}
      className="max-w-sm"
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={loaded === null || saving} onClick={() => void handleConfirm()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'bg-muted/40 relative cursor-grab touch-none overflow-hidden ring-2 ring-white/20 active:cursor-grabbing',
            shape === 'circle' ? 'rounded-full' : 'rounded-md'
          )}
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            lastPointer.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerMove={(event) => {
            const last = lastPointer.current
            if (last === null || loaded === null) return
            lastPointer.current = { x: event.clientX, y: event.clientY }
            setCrop((current) =>
              panBy(current, event.clientX - last.x, event.clientY - last.y, loaded.size, VIEWPORT)
            )
          }}
          onPointerUp={() => {
            lastPointer.current = null
          }}
          onWheel={(event) => {
            if (loaded === null) return
            // Roda para cima aproxima; o fator pequeno deixa o zoom suave no touchpad.
            const factor = Math.exp(-event.deltaY * 0.0015)
            setCrop((current) => zoomTo(current, current.zoom * factor, loaded.size, VIEWPORT))
          }}
        >
          {loaded === null || shown === null ? (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <img
              src={loaded.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
              style={{
                width: shown.width,
                height: shown.height,
                transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`
              }}
            />
          )}
        </div>

        <label className="flex w-full items-center gap-3">
          <ZoomOut className="text-muted-foreground size-4 shrink-0" />
          <input
            type="range"
            className="accent-primary w-full"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            disabled={loaded === null}
            aria-label="Aproximar"
            onChange={(event) => {
              if (loaded === null) return
              const zoom = Number(event.target.value)
              setCrop((current) => zoomTo(current, zoom, loaded.size, VIEWPORT))
            }}
          />
          <ZoomIn className="text-muted-foreground size-4 shrink-0" />
        </label>
      </div>
    </Dialog>
  )
}

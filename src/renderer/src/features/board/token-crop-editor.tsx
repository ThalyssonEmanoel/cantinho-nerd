import { useRef } from 'react'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  panBy as panCrop,
  zoomTo,
  type CropState
} from '@/lib/image/crop'
import { fromCropState, toCropState, type TokenCrop } from '@/lib/board'
import { useAssetImage } from './use-asset-image'

/** Lado do quadro de reenquadramento na tela. */
const VIEWPORT = 176

interface TokenCropEditorProps {
  imagePath: string
  crop: TokenCrop
  onChange: (crop: TokenCrop) => void
}

/**
 * Reenquadrar a imagem dentro do círculo do token, **sem reenviar** o arquivo (6.3).
 *
 * O que muda é só o recorte guardado na linha do token, então dá para ajustar quantas vezes
 * quiser sem gastar o Storage.
 */
export function TokenCropEditor({
  imagePath,
  crop,
  onChange
}: TokenCropEditorProps): React.JSX.Element {
  const { image, loading } = useAssetImage(imagePath)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)

  const size =
    image === null
      ? { width: 1, height: 1 }
      : { width: image.naturalWidth, height: image.naturalHeight }

  const state = toCropState(crop, VIEWPORT)
  const update = (next: CropState): void => onChange(fromCropState(next, VIEWPORT))

  const coverScale = Math.max(VIEWPORT / size.width, VIEWPORT / size.height) * crop.zoom
  const shown = { width: size.width * coverScale, height: size.height * coverScale }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="bg-muted/40 relative cursor-grab touch-none overflow-hidden rounded-full ring-2 ring-white/20 active:cursor-grabbing"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          lastPointer.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          const last = lastPointer.current
          if (last === null || image === null) return
          lastPointer.current = { x: event.clientX, y: event.clientY }
          update(
            panCrop(state, event.clientX - last.x, event.clientY - last.y, size, VIEWPORT)
          )
        }}
        onPointerUp={() => {
          lastPointer.current = null
        }}
        onWheel={(event) => {
          if (image === null) return
          event.preventDefault()
          const factor = Math.exp(-event.deltaY * 0.0015)
          update(zoomTo(state, state.zoom * factor, size, VIEWPORT))
        }}
      >
        {image === null ? (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            {loading ? <Loader2 className="size-5 animate-spin" /> : 'sem imagem'}
          </div>
        ) : (
          <img
            src={image.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
            style={{
              width: shown.width,
              height: shown.height,
              transform: `translate(calc(-50% + ${state.offsetX}px), calc(-50% + ${state.offsetY}px))`
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
          disabled={image === null}
          aria-label="Aproximar a imagem do token"
          onChange={(event) => update(zoomTo(state, Number(event.target.value), size, VIEWPORT))}
        />
        <ZoomIn className="text-muted-foreground size-4 shrink-0" />
      </label>
    </div>
  )
}

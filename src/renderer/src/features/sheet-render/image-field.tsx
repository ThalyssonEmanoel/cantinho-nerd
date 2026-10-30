import { useRef, useState } from 'react'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { ImageCropper } from '@/components/image-cropper'
import { Button } from '@/components/ui/button'
import { validateImageFile } from '@/lib/image/upload'
import { useAssetImage } from '@/hooks/use-asset-image'
import { cn } from '@/lib/utils'
import type { SheetRenderOptions } from './types'

/** Lado do retrato salvo. Maior que o avatar: ele também vira a imagem do token (5.6). */
const PORTRAIT_SIZE = 512

interface ImageFieldProps {
  componentId: string
  shape: 'circle' | 'rect'
  /** Caminho no Storage, ou `''` quando ainda não há foto. */
  path: string
  editable: boolean
  options: SheetRenderOptions
}

/**
 * Campo de imagem da ficha (5.3): o retrato do personagem.
 *
 * Clicar escolhe o arquivo, enquadra e envia; o valor guardado é o caminho no Storage. Sem
 * `uploadImage` nas opções (a pré-visualização do construtor), o campo é só a moldura — ali
 * não há mesa nenhuma onde guardar o arquivo.
 */
export function ImageField({
  componentId,
  shape,
  path,
  editable,
  options
}: ImageFieldProps): React.JSX.Element {
  const { image, loading, failed } = useAssetImage(path === '' ? null : path)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const canUpload = editable && options.uploadImage !== undefined
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-md'

  async function handleConfirm(cropped: Blob): Promise<void> {
    setSaving(true)
    try {
      await options.uploadImage?.(componentId, cropped)
      setPendingFile(null)
    } catch (error) {
      toast.error('Não consegui enviar a foto', {
        description: error instanceof Error ? error.message : undefined
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group relative h-full w-full">
      <button
        type="button"
        disabled={!canUpload || saving}
        onClick={() => fileInput.current?.click()}
        title={
          canUpload
            ? 'Escolher uma foto'
            : editable
              ? 'A foto é escolhida na ficha, dentro da mesa'
              : undefined
        }
        aria-label="Foto do personagem"
        className={cn(
          'bg-muted/40 text-muted-foreground relative flex h-full w-full items-center justify-center overflow-hidden border',
          rounded,
          image === null && 'border-dashed',
          canUpload && 'hover:border-primary cursor-pointer transition-colors',
          !canUpload && 'cursor-default'
        )}
      >
        {image !== null ? (
          <img src={image.src} alt="" className="size-full object-cover" draggable={false} />
        ) : saving || loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-1 text-center">
            <ImageIcon className="size-5" />
            {canUpload && <span className="text-[0.65rem] leading-tight">pôr uma foto</span>}
          </span>
        )}

        {/* Com foto, o convite para trocar aparece ao passar o mouse. */}
        {canUpload && image !== null && (
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100',
              rounded
            )}
          >
            <Upload className="size-4 text-white" />
          </span>
        )}
      </button>

      {canUpload && image !== null && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute -top-1.5 -right-1.5 size-6 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Tirar a foto"
          title="Tirar a foto"
          onClick={() => options.onChange?.(componentId, '')}
        >
          <X className="size-3" />
        </Button>
      )}

      {failed && (
        <span className="text-destructive absolute inset-x-0 bottom-0 text-center text-[0.65rem]">
          foto não carregou
        </span>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ''
          if (file === null) return

          const problem = validateImageFile(file)
          if (problem !== null) {
            toast.error(problem)
            return
          }
          setPendingFile(file)
        }}
      />

      <ImageCropper
        file={pendingFile}
        shape={shape}
        size={PORTRAIT_SIZE}
        title="Enquadrar o retrato"
        confirmLabel="Usar esta foto"
        onCancel={() => setPendingFile(null)}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

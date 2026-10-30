import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/db/errors'
import { galleryImagePath, uploadAsset } from '@/lib/db/assets'
import {
  addGalleryImage,
  GALLERY_KIND_LABELS,
  listGallery,
  removeGalleryImage,
  type GalleryImage,
  type GalleryKind
} from '@/lib/db/gallery'
import { MAX_TOKEN_SIDE, prepareImageForUpload, validateImageFile } from '@/lib/image/upload'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { useAssetImage } from '@/hooks/use-asset-image'

interface GalleryPickerProps {
  open: boolean
  onClose: () => void
  /** Escolheu uma imagem: a tela coloca o token no mapa (ou usa a imagem, no bestiário). */
  onPick: (image: GalleryImage, hidden: boolean) => Promise<void>
  /** `choose`: só escolher a imagem (a da criatura), sem colocar nada no mapa. */
  purpose?: 'place' | 'choose'
}

/**
 * Galeria do mestre (seção 8): monstros, NPCs e objetos reutilizáveis entre sessões.
 *
 * Os jogadores não têm acesso a ela — por isso a imagem é copiada para a pasta da sessão
 * quando vira token, e não referenciada direto daqui.
 */
export function GalleryPicker({
  open,
  onClose,
  onPick,
  purpose = 'place'
}: GalleryPickerProps): React.JSX.Element {
  const userId = useAuthStore((state) => state.userId)
  const [kind, setKind] = useState<GalleryKind>('monster')
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [newName, setNewName] = useState('')
  const [newSize, setNewSize] = useState('1')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const refresh = useCallback(() => {
    return listGallery().then(
      (list) => {
        setImages(list)
        setLoading(false)
      },
      (error: unknown) => {
        setLoading(false)
        toast.error('Não consegui abrir a galeria', { description: errorMessage(error) })
      }
    )
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  async function handleUpload(): Promise<void> {
    if (pendingFile === null || userId === null) return
    setBusy(true)
    try {
      const prepared = await prepareImageForUpload(pendingFile, MAX_TOKEN_SIDE)
      const path = galleryImagePath(userId, prepared.hash)
      await uploadAsset(path, prepared.blob)
      await addGalleryImage({
        kind,
        name: newName.trim() === '' ? 'Sem nome' : newName.trim(),
        imagePath: path,
        tokenSize: Number(newSize.replace(',', '.')) || 1
      })
      setPendingFile(null)
      setNewName('')
      setNewSize('1')
      await refresh()
    } catch (error) {
      toast.error('Não consegui enviar a imagem', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handlePick(image: GalleryImage): Promise<void> {
    setBusy(true)
    try {
      await onPick(image, hidden)
      onClose()
    } catch (error) {
      toast.error(purpose === 'place' ? 'Não consegui colocar o token' : 'Não consegui usar a imagem', {
        description: errorMessage(error)
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(image: GalleryImage): Promise<void> {
    try {
      await removeGalleryImage(image)
      await refresh()
    } catch (error) {
      toast.error('Não consegui excluir da galeria', { description: errorMessage(error) })
    }
  }

  const shown = images.filter((image) => image.kind === kind)

  return (
    <Dialog
      open={open}
      title="Galeria"
      description={
        purpose === 'place'
          ? 'Imagens suas, reutilizáveis em qualquer mesa. Clique numa para colocar no mapa.'
          : 'Clique numa imagem para usá-la. O tamanho do token vem junto.'
      }
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(GALLERY_KIND_LABELS) as GalleryKind[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === kind ? 'default' : 'outline'}
              onClick={() => setKind(option)}
            >
              {GALLERY_KIND_LABELS[option]}
            </Button>
          ))}

          {purpose === 'place' ? (
            <label className="ml-auto flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={hidden}
                onChange={(event) => setHidden(event.target.checked)}
              />
              Começa oculto
            </label>
          ) : (
            <span className="ml-auto" />
          )}

          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" />
            Enviar
          </Button>
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
              setNewName(file.name.replace(/\.[^.]+$/, '').slice(0, 60))
              setPendingFile(file)
            }}
          />
        </div>

        {pendingFile !== null && (
          <div className="bg-muted/30 space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Nova imagem em {GALLERY_KIND_LABELS[kind]}</p>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="galeria-nome">Nome</Label>
                <Input
                  id="galeria-nome"
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="galeria-tamanho">Quadrados</Label>
                <Input
                  id="galeria-tamanho"
                  inputMode="decimal"
                  value={newSize}
                  onChange={(event) => setNewSize(event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingFile(null)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void handleUpload()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Guardar na galeria
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-muted-foreground text-sm">Carregando…</p>}

        {!loading && shown.length === 0 && (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
            Nada em {GALLERY_KIND_LABELS[kind]} ainda. Envie uma imagem para reaproveitar em
            todas as mesas.
          </p>
        )}

        <div className="grid max-h-72 grid-cols-4 gap-3 overflow-auto sm:grid-cols-5">
          {shown.map((image) => (
            <GalleryCard
              key={image.id}
              image={image}
              disabled={busy}
              onPick={() => void handlePick(image)}
              onRemove={() => void handleRemove(image)}
            />
          ))}
        </div>
      </div>
    </Dialog>
  )
}

interface GalleryCardProps {
  image: GalleryImage
  disabled: boolean
  onPick: () => void
  onRemove: () => void
}

function GalleryCard({ image, disabled, onPick, onRemove }: GalleryCardProps): React.JSX.Element {
  const { image: loaded } = useAssetImage(image.imagePath)

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        title={`Colocar ${image.name} no mapa`}
        className={cn(
          'bg-muted/40 hover:border-primary flex w-full flex-col items-center gap-1 rounded-md border p-1.5 transition-colors',
          disabled && 'opacity-60'
        )}
      >
        <span className="bg-background/40 size-16 overflow-hidden rounded-full">
          {loaded !== null && (
            <img src={loaded.src} alt="" className="size-full object-cover" draggable={false} />
          )}
        </span>
        <span className="w-full truncate text-center text-xs">{image.name}</span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-1 -right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onRemove}
        aria-label={`Excluir ${image.name} da galeria`}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}

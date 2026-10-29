import { useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Eye, GripVertical, Image as ImageIcon, Loader2, Pencil, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { BoardMap } from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import { deleteMap, renameMap, reorderMaps } from '@/lib/db/maps'
import { setActiveMap } from '@/lib/db/sessions'
import { useSessionStore } from '@/features/session/session-store'
import { cn } from '@/lib/utils'
import { addMapFromFile } from './board-actions'
import { useBoardStore } from './board-store'

/**
 * Biblioteca de mapas da mesa (6.1), só para o mestre.
 *
 * "Abrir" é só na tela dele — é assim que se prepara um mapa sem mostrar para a mesa.
 * "Ativar" é o que faz todos verem.
 */
export function MapLibrary(): React.JSX.Element {
  const sessionId = useBoardStore((state) => state.sessionId)
  const maps = useBoardStore((state) => state.maps)
  const activeMapId = useBoardStore((state) => state.activeMapId)
  const openMapId = useBoardStore((state) => state.openMapId)

  const fileInput = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState<BoardMap | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [deleting, setDeleting] = useState<BoardMap | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleFile(file: File | undefined): Promise<void> {
    if (file === undefined || sessionId === null) return
    setUploading(true)
    try {
      // O nome do arquivo já é um bom nome de mapa; o mestre renomeia se quiser.
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Mapa'
      const map = await addMapFromFile(sessionId, file, name)
      await useBoardStore.getState().reloadMaps()
      useBoardStore.getState().openMap(map.id)

      // Primeiro mapa da mesa já entra ativado: é o que o mestre quer em 99% dos casos.
      if (activeMapId === null) await activate(map.id)
      toast.success(`"${map.name}" entrou na biblioteca`)
    } catch (error) {
      toast.error('Não consegui enviar o mapa', { description: errorMessage(error) })
    } finally {
      setUploading(false)
    }
  }

  async function activate(mapId: string): Promise<void> {
    if (sessionId === null) return
    try {
      await setActiveMap(sessionId, mapId)
      // O tempo real avisa todo mundo; aqui a tela do mestre não espera a volta.
      useBoardStore.getState().syncSession(mapId, useBoardStore.getState().scale)
      await useSessionStore.getState().reload()
    } catch (error) {
      toast.error('Não consegui ativar o mapa', { description: errorMessage(error) })
    }
  }

  async function handleRename(): Promise<void> {
    if (renaming === null) return
    const name = nameDraft.trim()
    setRenaming(null)
    if (name === '' || name === renaming.name) return

    try {
      await renameMap(renaming.id, name)
      await useBoardStore.getState().reloadMaps()
    } catch (error) {
      toast.error('Não consegui renomear', { description: errorMessage(error) })
    }
  }

  async function handleDelete(): Promise<void> {
    if (deleting === null) return
    const map = deleting
    setDeleting(null)
    try {
      await deleteMap(map)
      await useBoardStore.getState().reloadMaps()
      if (useBoardStore.getState().openMapId === map.id) {
        useBoardStore.getState().openMap(useBoardStore.getState().activeMapId ?? '')
      }
      toast.success('Mapa excluído')
    } catch (error) {
      toast.error('Não consegui excluir o mapa', { description: errorMessage(error) })
    }
  }

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event
    if (over === null || active.id === over.id || sessionId === null) return

    const from = maps.findIndex((map) => map.id === active.id)
    const to = maps.findIndex((map) => map.id === over.id)
    if (from === -1 || to === -1) return

    // Otimista: a lista já aparece na ordem nova, com a posição de cada um.
    const ordered = arrayMove(maps, from, to).map((map, index) => ({ ...map, sortOrder: index }))
    useBoardStore.setState({ maps: ordered })

    try {
      await reorderMaps(
        sessionId,
        ordered.map((map) => map.id)
      )
      await useBoardStore.getState().reloadMaps()
    } catch (error) {
      toast.error('Não consegui reordenar', { description: errorMessage(error) })
    }
  }

  return (
    <section className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ImageIcon className="text-muted-foreground size-4" />
          Mapas
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : null}
          Enviar mapa
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void handleFile(file)
          }}
        />
      </div>

      {maps.length === 0 && (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          Nenhum mapa ainda. Envie uma imagem: ela vira o tabuleiro, e o tamanho dela é o
          tamanho do mapa.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <SortableContext items={maps.map((map) => map.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {maps.map((map) => (
              <MapRow
                key={map.id}
                map={map}
                active={map.id === activeMapId}
                open={map.id === openMapId}
                sortable={maps.length > 1}
                onOpen={() => useBoardStore.getState().openMap(map.id)}
                onActivate={() => void activate(map.id)}
                onRename={() => {
                  setNameDraft(map.name)
                  setRenaming(map)
                }}
                onDelete={() => setDeleting(map)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Dialog
        open={renaming !== null}
        title="Renomear mapa"
        onClose={() => setRenaming(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRename()}>Salvar</Button>
          </>
        }
      >
        <Input
          autoFocus
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleRename()
          }}
        />
      </Dialog>

      <Dialog
        open={deleting !== null}
        title={`Excluir "${deleting?.name ?? ''}"?`}
        description="Os tokens, desenhos e a névoa deste mapa vão embora com ele."
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </>
        }
      />
    </section>
  )
}

interface MapRowProps {
  map: BoardMap
  active: boolean
  open: boolean
  sortable: boolean
  onOpen: () => void
  onActivate: () => void
  onRename: () => void
  onDelete: () => void
}

function MapRow({
  map,
  active,
  open,
  sortable,
  onOpen,
  onActivate,
  onRename,
  onDelete
}: MapRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: map.id,
    disabled: !sortable
  })

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1.5',
        open && 'border-primary/60',
        isDragging && 'bg-accent/40 relative z-10'
      )}
      style={{
        transform: transform === null ? undefined : `translate3d(0, ${transform.y}px, 0)`,
        transition
      }}
    >
      {sortable && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label="Reordenar mapa"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}

      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className="truncate text-sm">{map.name}</p>
        <p className="text-muted-foreground text-xs">
          {map.width} × {map.height}
        </p>
      </button>

      {active ? (
        <Badge variant="secondary" title="A mesa está vendo este mapa">
          ativo
        </Badge>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onActivate}
          aria-label="Ativar para a mesa"
          title="Ativar para a mesa"
        >
          <Play className="size-3.5" />
        </Button>
      )}

      {!open && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onOpen}
          aria-label="Abrir só para mim"
          title="Abrir só para mim (preparar)"
        >
          <Eye className="size-3.5" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onRename}
        aria-label="Renomear mapa"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onDelete}
        aria-label="Excluir mapa"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

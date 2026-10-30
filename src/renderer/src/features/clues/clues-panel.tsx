import { useEffect, useState } from 'react'
import { Eye, EyeOff, Image as ImageIcon, Lightbulb, Loader2, NotebookPen, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/save-indicator'
import { errorMessage } from '@/lib/db/errors'
import { MAX_NOTES_LENGTH } from '@/lib/db/notes'
import { clueHeadline, isRevealed, revealLabel, type Clue } from '@/lib/session/clues'
import { ImageLightbox } from '@/features/board/image-lightbox'
import { useAssetImage } from '@/hooks/use-asset-image'
import { useSessionStore } from '@/features/session/session-store'
import { cn } from '@/lib/utils'
import { patchClue } from './clue-actions'
import { ClueEditorDialog } from './clue-editor-dialog'
import { useCluesStore } from './clues-store'

/**
 * Aba Pistas (Fase 13).
 *
 * Para o mestre: o bloco de notas privado e a lista de pistas, com quem já viu cada uma.
 * Para o jogador: as pistas reveladas para ele — nada mais chega até aqui, porque é o
 * banco que filtra.
 */
export function CluesPanel(): React.JSX.Element {
  const session = useSessionStore((state) => state.session)
  const clues = useCluesStore((state) => state.clues)
  const loading = useCluesStore((state) => state.loading)
  const [editing, setEditing] = useState<Clue | null>(null)
  const [creating, setCreating] = useState(false)
  const [lightbox, setLightbox] = useState<Clue | null>(null)

  // Enquanto a aba está à vista, o que chegou já está visto.
  useEffect(() => {
    useCluesStore.getState().markSeen()
  }, [clues])

  const isGm = session?.role === 'gm'

  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
      {isGm && <NotesSection />}

      <section className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="text-muted-foreground size-4" />
            Pistas
          </h2>
          {isGm && (
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Nova
            </Button>
          )}
        </div>

        {loading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </p>
        )}

        {!loading && clues.length === 0 && (
          <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            {isGm
              ? 'Nenhuma pista ainda. Guarde aqui o que você vai revelar: um texto, uma imagem, ou os dois.'
              : 'Nada revelado até agora. Quando o mestre revelar uma pista, ela aparece aqui.'}
          </p>
        )}

        <ul className="space-y-1.5">
          {clues.map((clue) => (
            <li key={clue.id}>
              {isGm ? (
                <GmClueRow
                  clue={clue}
                  members={session?.members ?? []}
                  onEdit={() => setEditing(clue)}
                />
              ) : (
                <PlayerClueCard clue={clue} onOpenImage={() => setLightbox(clue)} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {(creating || editing !== null) && session !== null && (
        <ClueEditorDialog
          key={editing?.id ?? 'nova'}
          sessionId={session.id}
          clue={editing}
          members={session.members}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <ImageLightbox
        path={lightbox?.imagePath ?? null}
        title={lightbox === null ? '' : clueHeadline(lightbox)}
        onClose={() => setLightbox(null)}
      />
    </div>
  )
}

/** Bloco de notas da mesa: só o mestre lê, e salva sozinho. */
function NotesSection(): React.JSX.Element {
  const notes = useCluesStore((state) => state.notes)
  const notesState = useCluesStore((state) => state.notesState)

  return (
    <section className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <NotebookPen className="text-muted-foreground size-4" />
          Minhas notas
        </h2>
        <SaveIndicator state={notesState} />
      </div>

      <Textarea
        className="min-h-32 text-sm"
        maxLength={MAX_NOTES_LENGTH}
        placeholder="O que ninguém mais vê: o plano do vilão, o nome verdadeiro do NPC, o que vem depois."
        value={notes}
        onChange={(event) => useCluesStore.getState().setNotes(event.target.value)}
        onBlur={() => void useCluesStore.getState().flushNotes()}
      />
    </section>
  )
}

interface GmClueRowProps {
  clue: Clue
  members: readonly { userId: string; displayName: string }[]
  onEdit: () => void
}

function GmClueRow({ clue, members, onEdit }: GmClueRowProps): React.JSX.Element {
  const revealed = isRevealed(clue)

  async function toggleAll(): Promise<void> {
    try {
      // O atalho revela (ou esconde) para a mesa inteira; para escolher gente, é na janela.
      await patchClue(clue, revealed ? { revealAll: false, revealedTo: [] } : { revealAll: true })
    } catch (error) {
      toast.error('Não consegui mudar a pista', { description: errorMessage(error) })
    }
  }

  return (
    <div
      className={cn(
        'bg-card/40 flex items-center gap-2 rounded-md border px-2 py-1.5',
        revealed && 'border-primary/40'
      )}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <p className="flex items-center gap-1.5 truncate text-sm">
          {clue.imagePath !== null && <ImageIcon className="text-muted-foreground size-3.5 shrink-0" />}
          {clueHeadline(clue)}
        </p>
        <p className="text-muted-foreground truncate text-xs">{revealLabel(clue, members)}</p>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => void toggleAll()}
        aria-label={revealed ? 'Esconder de todos' : 'Revelar para a mesa'}
        title={revealed ? 'Esconder de todos' : 'Revelar para a mesa'}
      >
        {revealed ? <Eye className="text-primary size-3.5" /> : <EyeOff className="size-3.5" />}
      </Button>
    </div>
  )
}

/** A pista como o jogador a vê: o que foi revelado, inteiro. */
function PlayerClueCard({
  clue,
  onOpenImage
}: {
  clue: Clue
  onOpenImage: () => void
}): React.JSX.Element {
  const { image } = useAssetImage(clue.imagePath)

  return (
    <div className="bg-card/40 space-y-2 rounded-md border p-2.5">
      <p className="text-sm font-medium">{clueHeadline(clue)}</p>

      {image !== null && (
        <button type="button" onClick={onOpenImage} title="Ampliar a imagem" className="block w-full">
          <img
            src={image.src}
            alt=""
            className="max-h-40 w-full rounded-md object-cover"
            draggable={false}
          />
        </button>
      )}

      {clue.body.trim() !== '' && (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{clue.body}</p>
      )}
    </div>
  )
}

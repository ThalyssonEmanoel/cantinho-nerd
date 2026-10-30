import { useRef, useState } from 'react'
import { Eye, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/user-avatar'
import { errorMessage } from '@/lib/db/errors'
import type { SessionMember } from '@/lib/db/sessions'
import { clueProblem, MAX_CLUE_BODY, type Clue } from '@/lib/session/clues'
import { useAssetImage } from '@/hooks/use-asset-image'
import { addClue, patchClue, removeClue, uploadClueImage } from './clue-actions'

interface ClueEditorDialogProps {
  sessionId: string
  /** Pista existente, ou `null` para criar uma nova. */
  clue: Clue | null
  members: readonly SessionMember[]
  onClose: () => void
}

/**
 * Janela da pista (Fase 13): texto, imagem e para quem está revelada.
 *
 * Montada com `key` por pista (ou "nova"), então o estado inicial já vem do que está no
 * banco — sem efeito copiando prop para estado.
 */
export function ClueEditorDialog({
  sessionId,
  clue,
  members,
  onClose
}: ClueEditorDialogProps): React.JSX.Element {
  const [title, setTitle] = useState(clue?.title ?? '')
  const [body, setBody] = useState(clue?.body ?? '')
  const [imagePath, setImagePath] = useState<string | null>(clue?.imagePath ?? null)
  const [revealAll, setRevealAll] = useState(clue?.revealAll ?? false)
  const [revealedTo, setRevealedTo] = useState<string[]>(clue?.revealedTo ?? [])
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const preview = useAssetImage(imagePath)

  const players = members.filter((member) => member.role === 'player')

  function toggleTarget(userId: string): void {
    setRevealAll(false)
    setRevealedTo((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    )
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (file === undefined) return
    setSaving(true)
    try {
      setImagePath(await uploadClueImage(sessionId, file))
    } catch (error) {
      toast.error('Não consegui enviar a imagem', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(): Promise<void> {
    const draft = { title, body, imagePath }
    const problem = clueProblem(draft)
    if (problem !== null) {
      toast.error(problem)
      return
    }

    setSaving(true)
    try {
      if (clue === null) {
        const created = await addClue(sessionId, draft)
        // Revelar na criação é um segundo passo: a pista nasce só do mestre.
        if (revealAll || revealedTo.length > 0) {
          await patchClue(created, { revealAll, revealedTo })
        }
      } else {
        await patchClue(clue, { ...draft, revealAll, revealedTo })
      }
      onClose()
    } catch (error) {
      toast.error('Não consegui salvar a pista', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (clue === null) return
    try {
      await removeClue(clue)
      onClose()
    } catch (error) {
      toast.error('Não consegui excluir a pista', { description: errorMessage(error) })
    }
  }

  return (
    <Dialog
      open
      title={clue === null ? 'Nova pista' : 'Pista'}
      description="Texto, imagem, ou os dois. Você escolhe quem pode ver."
      onClose={onClose}
      className="max-w-xl"
      footer={
        <>
          {clue !== null && (
            <Button variant="destructive" disabled={saving} onClick={() => void handleDelete()}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pista-titulo">Título</Label>
          <Input
            id="pista-titulo"
            autoFocus
            placeholder="Ex.: A carta rasgada"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pista-texto">Texto</Label>
          <Textarea
            id="pista-texto"
            className="min-h-24"
            maxLength={MAX_CLUE_BODY}
            placeholder="O que os jogadores leem quando a pista for revelada."
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Imagem</Label>
          <div className="flex items-center gap-3">
            <div className="bg-muted/40 text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {preview.image === null ? (
                <ImageIcon className="size-5" />
              ) : (
                <img
                  src={preview.image.src}
                  alt=""
                  className="size-full object-cover"
                  draggable={false}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="size-3.5" />
                {imagePath === null ? 'Enviar imagem' : 'Trocar a imagem'}
              </Button>
              {imagePath !== null && (
                <Button variant="ghost" size="sm" onClick={() => setImagePath(null)}>
                  Tirar a imagem
                </Button>
              )}
            </div>
          </div>
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

        <div className="space-y-2 border-t pt-4">
          <Label className="flex items-center gap-1.5">
            <Eye className="size-3.5" />
            Quem pode ver
          </Label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={revealAll}
              onChange={(event) => {
                setRevealAll(event.target.checked)
                if (event.target.checked) setRevealedTo([])
              }}
            />
            A mesa inteira
          </label>

          {players.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Ninguém entrou na mesa ainda. A pista fica guardada para quando entrarem.
            </p>
          ) : (
            <ul className="space-y-1">
              {players.map((member) => (
                <li key={member.userId}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={revealAll || revealedTo.includes(member.userId)}
                      disabled={revealAll}
                      onChange={() => toggleTarget(member.userId)}
                    />
                    <UserAvatar
                      displayName={member.displayName}
                      avatarPath={member.avatarPath}
                      className="size-6 text-[0.6rem]"
                    />
                    {member.displayName}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <p className="text-muted-foreground text-xs">
            Sem ninguém marcado, a pista é só sua: nem o texto nem a imagem saem do seu app.
          </p>
        </div>
      </div>
    </Dialog>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Dices, Link2, Loader2, LogIn, Plus, Trash2, TriangleAlert, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { PhaseNotice } from '@/components/phase-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { errorMessage } from '@/lib/db/errors'
import {
  createSession,
  deleteSession,
  listMySessions,
  type SessionSummary
} from '@/lib/db/sessions'
import {
  generateFriendlyPassword,
  SESSION_NAME_MAX,
  validateSessionName,
  validateSessionPassword
} from '@/lib/session/invite'
import type { SheetTemplateSummary } from '@/lib/sheet'
import { copyInvite } from '@/features/session/copy-invite'
import { templateRepository } from '@/features/sheet-templates/repository'
import { useAuthStore } from '@/stores/auth-store'

interface Library {
  sessions: SessionSummary[]
  templates: SheetTemplateSummary[]
}

async function loadLibrary(userId: string): Promise<Library> {
  const [sessions, templates] = await Promise.all([
    listMySessions(userId),
    templateRepository.list()
  ])
  return {
    sessions: sessions.filter((session) => session.role === 'gm'),
    // Só modelo de personagem publicado serve de sistema (a ficha fica presa a uma versão).
    templates: templates.filter(
      (template) => template.kind === 'character' && template.publishedVersion !== null
    )
  }
}

/** Lobby do mestre (seção 4.3): as mesas que ele mestra. */
export function GmLobbyPage(): React.JSX.Element {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [templates, setTemplates] = useState<SheetTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = useCallback((library: Library) => {
    setSessions(library.sessions)
    setTemplates(library.templates)
    setLoading(false)
  }, [])

  const fail = useCallback((error: unknown) => {
    setLoading(false)
    toast.error('Não consegui carregar suas mesas', { description: errorMessage(error) })
  }, [])

  useEffect(() => {
    if (userId === null) return
    void loadLibrary(userId).then(apply, fail)
  }, [userId, apply, fail])

  async function handleDelete(): Promise<void> {
    const target = deleting
    if (target === null) return
    setBusy(true)
    try {
      await deleteSession(target.id)
      setSessions((list) => list.filter((session) => session.id !== target.id))
      toast.success(`"${target.name}" excluída`)
    } catch (error) {
      toast.error('Não consegui excluir a sessão', { description: errorMessage(error) })
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const templateName = (id: string | null): string =>
    id === null
      ? 'sem sistema'
      : (templates.find((template) => template.id === id)?.name ?? 'sistema')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Minhas sessões"
        description="As mesas que você mestra."
        actions={
          <>
            <Button variant="outline" onClick={() => void navigate('/templates')}>
              <Wrench className="size-4" />
              Meus modelos de ficha
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Nova sessão
            </Button>
          </>
        }
      />

      {loading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando…
        </p>
      )}

      {!loading && sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma sessão ainda. Crie a primeira e mande o convite para a galera.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void navigate(`/session/${session.id}`)}
              >
                <p className="truncate font-medium">{session.name}</p>
                <p className="text-muted-foreground text-xs">
                  {templateName(session.characterTemplateId)} · código {session.inviteId}
                </p>
              </button>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => void copyInvite(session)}>
                  <Link2 className="size-4" />
                  Copiar convite
                </Button>
                <Button size="sm" onClick={() => void navigate(`/session/${session.id}`)}>
                  <LogIn className="size-4" />
                  Entrar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(session)}
                  aria-label="Excluir sessão"
                  title="Excluir sessão"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PhaseNotice
        phase="Fase 10"
        title="Biblioteca do mestre"
        items={[
          'Bestiário com fichas de criatura',
          'Encontros prontos para colocar no mapa',
          'Galerias de imagens'
        ]}
      />

      {creating && (
        <CreateSessionDialog
          templates={templates}
          onClose={() => setCreating(false)}
          onCreated={(id) => void navigate(`/session/${id}`)}
        />
      )}

      <Dialog
        open={deleting !== null}
        title={`Excluir "${deleting?.name ?? ''}"?`}
        description="Some tudo: jogadores, fichas e imagens da sessão. Não tem como desfazer."
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </>
        }
      />
    </div>
  )
}

function CreateSessionDialog({
  templates,
  onClose,
  onCreated
}: {
  templates: SheetTemplateSummary[]
  onClose: () => void
  onCreated: (id: string) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [password, setPassword] = useState(() => generateFriendlyPassword())
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  const nameError = validateSessionName(name)
  const passwordError = validateSessionPassword(password)

  async function handleCreate(): Promise<void> {
    setSubmitted(true)
    if (nameError !== null || passwordError !== null || busy) return
    setBusy(true)
    try {
      const created = await createSession({
        name,
        password,
        templateId: templateId === '' ? null : templateId
      })
      toast.success('Sessão criada', { description: 'Agora é copiar o convite e chamar a galera.' })
      onCreated(created.id)
    } catch (error) {
      toast.error('Não consegui criar a sessão', { description: errorMessage(error) })
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title="Nova sessão"
      description="Dá para trocar a senha e o sistema depois."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void handleCreate()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Criar e abrir
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="session-name">Nome</Label>
          <Input
            id="session-name"
            autoFocus
            maxLength={SESSION_NAME_MAX}
            placeholder="Ex.: Mesa de sexta"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {submitted && nameError !== null && (
            <p className="text-destructive text-xs">{nameError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-password">Senha da sessão</Label>
          <div className="flex gap-2">
            <Input
              id="session-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPassword(generateFriendlyPassword())}
              aria-label="Sugerir outra senha"
              title="Sugerir outra senha"
            >
              <Dices className="size-4" />
            </Button>
          </div>
          {passwordError !== null && <p className="text-destructive text-xs">{passwordError}</p>}
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-400" />
            Não use uma senha pessoal: ela vai no convite, e você consegue vê-la depois.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-template">Sistema</Label>
          <Select
            id="session-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Escolher depois</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} (v{template.publishedVersion})
              </option>
            ))}
          </Select>
          <p className="text-muted-foreground text-xs">
            {templates.length === 0
              ? 'Nenhum modelo de personagem publicado ainda: publique um em "Meus modelos de ficha".'
              : 'O modelo de ficha que os jogadores usam para criar o personagem.'}
          </p>
        </div>

        {/* Enter no formulário cria; o botão de envio fica no rodapé do diálogo. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}

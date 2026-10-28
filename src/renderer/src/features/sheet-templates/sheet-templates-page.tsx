import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Copy, FileUp, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { errorMessage } from '@/lib/db/errors'
import {
  parseTemplateFile,
  templateKindLabel,
  validateSchema,
  type SheetTemplateSummary,
  type TemplateKind
} from '@/lib/sheet'
import { LocalImportBanner } from './local-import-banner'
import { ensureExampleTemplate, templateRepository } from './repository'

type LoadState = 'loading' | 'ready' | 'error'

/** Primeira carga: semeia o exemplo da conta (5.1) e lista. O exemplo falhar não impede a lista. */
async function loadLibrary(): Promise<SheetTemplateSummary[]> {
  try {
    await ensureExampleTemplate()
  } catch (error) {
    console.warn('Não consegui criar o modelo de exemplo:', error)
  }
  return templateRepository.list()
}

/** Biblioteca de modelos de ficha do mestre (seção 5.1), salva na conta. */
export function SheetTemplatesPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<SheetTemplateSummary[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<TemplateKind>('character')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<SheetTemplateSummary | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleting, setDeleting] = useState<SheetTemplateSummary | null>(null)

  const applyList = useCallback((list: SheetTemplateSummary[]) => {
    setTemplates(list)
    setLoadState('ready')
  }, [])

  const failLoad = useCallback((error: unknown) => {
    setLoadState('error')
    toast.error('Não consegui carregar seus modelos', { description: errorMessage(error) })
  }, [])

  const refresh = useCallback(
    () => templateRepository.list().then(applyList, failLoad),
    [applyList, failLoad]
  )

  // O `then` não é enfeite: setState direto no corpo do efeito dispara renderização em
  // cascata, e o lint cobra isso com razão.
  useEffect(() => {
    void loadLibrary().then(applyList, failLoad)
  }, [applyList, failLoad])

  function retry(): void {
    setLoadState('loading')
    void loadLibrary().then(applyList, failLoad)
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (name === '' || busy) return

    setBusy(true)
    try {
      const template = await templateRepository.create({ name, kind: newKind })
      setCreating(false)
      setNewName('')
      void navigate(`/templates/${template.id}`)
    } catch (error) {
      toast.error('Não consegui criar o modelo', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate(summary: SheetTemplateSummary): Promise<void> {
    try {
      await templateRepository.duplicate(summary.id)
      await refresh()
      toast.success('Modelo duplicado')
    } catch (error) {
      toast.error('Não consegui duplicar o modelo', { description: errorMessage(error) })
    }
  }

  async function handleDelete(): Promise<void> {
    const target = deleting
    if (target === null) return
    setDeleting(null)

    try {
      if (await templateRepository.isInUse(target.id)) {
        toast.error('Este modelo está em uso', {
          description: 'Ele é o sistema de uma sessão ou já tem fichas criadas a partir dele.'
        })
        return
      }
    } catch (error) {
      toast.error('Não consegui excluir o modelo', { description: errorMessage(error) })
      return
    }

    // Otimista: some da lista na hora e volta se o banco recusar.
    const before = templates
    setTemplates((list) => list.filter((item) => item.id !== target.id))
    try {
      await templateRepository.remove(target.id)
      toast.success('Modelo excluído')
    } catch (error) {
      setTemplates(before)
      toast.error('Não consegui excluir o modelo', { description: errorMessage(error) })
    }
  }

  async function handleRename(): Promise<void> {
    const target = renaming
    if (target === null) return
    setRenaming(null)

    const name = renameDraft.trim()
    if (name === '' || name === target.name) return

    const before = templates
    setTemplates((list) => list.map((item) => (item.id === target.id ? { ...item, name } : item)))
    try {
      await templateRepository.rename(target.id, name)
    } catch (error) {
      setTemplates(before)
      toast.error('Não consegui renomear o modelo', { description: errorMessage(error) })
    }
  }

  async function handleImport(): Promise<void> {
    const file = await window.api.openTextFile({
      filters: [{ name: 'Modelo de ficha', extensions: ['json'] }]
    })

    if (file.status === 'canceled') return
    if (file.status !== 'opened') {
      toast.error('Não consegui abrir o arquivo', {
        description: file.status === 'error' ? file.message : undefined
      })
      return
    }

    const parsed = parseTemplateFile(file.text)
    if (!parsed.ok) {
      toast.error('Arquivo recusado', { description: parsed.message })
      return
    }

    const report = validateSchema(parsed.value.schema)
    try {
      const template = await templateRepository.create({
        name: parsed.value.name,
        kind: parsed.value.kind,
        schema: parsed.value.schema
      })
      toast.success(`"${parsed.value.name}" importado`, {
        description:
          report.errors.length > 0
            ? `Atenção: o modelo tem ${report.errors.length} erro(s) de validação.`
            : 'Entrou como rascunho.'
      })
      void navigate(`/templates/${template.id}`)
    } catch (error) {
      toast.error('Não consegui importar o modelo', { description: errorMessage(error) })
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Meus modelos de ficha"
        description="Os sistemas que você monta: Ordem Paranormal, D&D, o que você inventar."
        actions={
          <>
            <Button variant="ghost" onClick={() => void navigate('/guide')}>
              <BookOpen className="size-4" />
              Guia de fórmulas
            </Button>
            <Button variant="outline" onClick={() => void handleImport()}>
              <FileUp className="size-4" />
              Importar
            </Button>
            <Button
              onClick={() => {
                setNewName('')
                setCreating(true)
              }}
            >
              <Plus className="size-4" />
              Novo modelo
            </Button>
          </>
        }
      />

      <LocalImportBanner onImported={() => void refresh()} />

      {loadState === 'loading' && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando…
        </p>
      )}

      {loadState === 'error' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">Seus modelos não carregaram.</p>
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="size-4" />
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && templates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhum modelo ainda. Crie um ou importe um `.json`.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void navigate(`/templates/${template.id}`)}
              >
                <p className="truncate font-medium">{template.name}</p>
                <p className="text-muted-foreground text-xs">
                  {templateKindLabel(template.kind)} · {template.componentCount} componente(s) ·
                  atualizado {new Date(template.updatedAt).toLocaleString('pt-BR')}
                </p>
              </button>

              {template.publishedVersion === null ? (
                <Badge variant="outline">rascunho</Badge>
              ) : (
                <Badge variant="secondary">v{template.publishedVersion}</Badge>
              )}

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setRenaming(template)
                    setRenameDraft(template.name)
                  }}
                  aria-label="Renomear"
                  title="Renomear"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleDuplicate(template)}
                  aria-label="Duplicar"
                  title="Duplicar"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(template)}
                  aria-label="Excluir"
                  title="Excluir"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={creating}
        title="Novo modelo de ficha"
        description="Dá para mudar tudo depois."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button disabled={newName.trim() === '' || busy} onClick={() => void handleCreate()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Criar e abrir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Ex.: Ordem Paranormal"
            maxLength={120}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
            }}
          />
          <Select
            value={newKind}
            onChange={(event) => setNewKind(event.target.value as TemplateKind)}
          >
            <option value="character">Personagem (ficha de jogador)</option>
            <option value="creature">Criatura (bestiário)</option>
          </Select>
        </div>
      </Dialog>

      <Dialog
        open={renaming !== null}
        title="Renomear modelo"
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
          maxLength={120}
          value={renameDraft}
          onChange={(event) => setRenameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleRename()
          }}
        />
      </Dialog>

      <Dialog
        open={deleting !== null}
        title={`Excluir "${deleting?.name ?? ''}"?`}
        description="As fichas criadas a partir dele não são apagadas, mas ficam sem modelo."
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
    </div>
  )
}

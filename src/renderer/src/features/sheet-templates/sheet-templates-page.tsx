import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import {
  parseTemplateFile,
  seedExampleTemplate,
  templateKindLabel,
  validateSchema,
  type SheetTemplateSummary,
  type TemplateKind
} from '@/lib/sheet'
import { templateRepository } from './repository'

/** Biblioteca de modelos de ficha do mestre (seção 5.1). */
export function SheetTemplatesPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<SheetTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<TemplateKind>('character')
  const [renaming, setRenaming] = useState<SheetTemplateSummary | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleting, setDeleting] = useState<SheetTemplateSummary | null>(null)

  const refresh = useCallback(async () => {
    const list = await templateRepository.list()
    setTemplates(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    // O exemplo d20 entra na primeira vez que a biblioteca abre (5.1).
    void seedExampleTemplate(templateRepository).then(() => refresh())
  }, [refresh])

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (name === '') return

    const template = await templateRepository.create({ name, kind: newKind })
    setCreating(false)
    setNewName('')
    await refresh()
    void navigate(`/templates/${template.id}`)
  }

  async function handleDuplicate(summary: SheetTemplateSummary): Promise<void> {
    await templateRepository.duplicate(summary.id)
    await refresh()
    toast.success('Modelo duplicado')
  }

  async function handleDelete(): Promise<void> {
    if (deleting === null) return

    if (await templateRepository.isInUse(deleting.id)) {
      toast.error('Este modelo está em uso por uma sessão', {
        description: 'Troque o sistema da sessão antes de excluir.'
      })
      setDeleting(null)
      return
    }

    await templateRepository.remove(deleting.id)
    setDeleting(null)
    await refresh()
    toast.success('Modelo excluído')
  }

  async function handleRename(): Promise<void> {
    if (renaming === null) return
    const name = renameDraft.trim()
    if (name !== '') await templateRepository.rename(renaming.id, name)
    setRenaming(null)
    await refresh()
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
    const template = await templateRepository.create({
      name: parsed.value.name,
      kind: parsed.value.kind,
      schema: parsed.value.schema
    })

    await refresh()
    toast.success(`"${parsed.value.name}" importado`, {
      description:
        report.errors.length > 0
          ? `Atenção: o modelo tem ${report.errors.length} erro(s) de validação.`
          : 'Entrou como rascunho.'
    })
    void navigate(`/templates/${template.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Meus modelos de ficha"
        description="Os sistemas que você monta: Ordem Paranormal, D&D, o que você inventar."
        actions={
          <>
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

      {loading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      {!loading && templates.length === 0 && (
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
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleDuplicate(template)}
                  aria-label="Duplicar"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(template)}
                  aria-label="Excluir"
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
            <Button disabled={newName.trim() === ''} onClick={() => void handleCreate()}>
              Criar e abrir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Ex.: Ordem Paranormal"
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

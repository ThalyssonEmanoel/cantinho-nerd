import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { errorMessage } from '@/lib/db/errors'
import type { SheetSummaryRow, SheetTemplateSummary } from '@/lib/sheet'
import { templateRepository } from '@/features/sheet-templates/repository'
import { useAuthStore } from '@/stores/auth-store'
import { sheetRepository } from './repository'

interface Lists {
  sheets: SheetSummaryRow[]
  templates: SheetTemplateSummary[]
}

/** Só modelo publicado serve: a ficha fica presa a uma versão imutável (5.1). */
async function loadLists(): Promise<Lists> {
  const [sheets, templates] = await Promise.all([sheetRepository.list(), templateRepository.list()])
  return {
    sheets,
    templates: templates.filter((template) => template.publishedVersion !== null)
  }
}

/**
 * Fichas preenchidas desta máquina (seção 5.7).
 *
 * Na Fase 5 esta lista vira a aba "Fichas" da sessão: o jogador cria o personagem a partir
 * do modelo da sessão e o mestre abre a ficha de qualquer um. Até lá as fichas vivem aqui
 * (os modelos já vêm da conta, desde a Fase 4), e é por aqui que o preenchimento é testado.
 */
export function SheetsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [sheets, setSheets] = useState<SheetSummaryRow[]>([])
  const [templates, setTemplates] = useState<SheetTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [deleting, setDeleting] = useState<SheetSummaryRow | null>(null)
  const displayName = useAuthStore((state) => state.profile?.displayName)

  const apply = useCallback((lists: Lists) => {
    setSheets(lists.sheets)
    setTemplates(lists.templates)
    setLoading(false)
  }, [])

  const failLoad = useCallback((error: unknown) => {
    setLoading(false)
    toast.error('Não consegui carregar as fichas e os modelos', {
      description: errorMessage(error)
    })
  }, [])

  const refresh = useCallback(() => loadLists().then(apply, failLoad), [apply, failLoad])

  // O `then` não é enfeite: setState direto no corpo do efeito dispara renderização em
  // cascata, e o lint cobra isso com razão.
  useEffect(() => {
    void loadLists().then(apply, failLoad)
  }, [apply, failLoad])

  async function handleCreate(): Promise<void> {
    const owner = ownerName.trim()
    if (templateId === '' || owner === '') return

    try {
      const sheet = await sheetRepository.create({ templateId, ownerName: owner })
      setCreating(false)
      void navigate(`/sheets/${sheet.id}`)
    } catch (error) {
      toast.error('Não consegui criar a ficha', {
        description: error instanceof Error ? error.message : undefined
      })
    }
  }

  async function handleDelete(): Promise<void> {
    if (deleting === null) return
    await sheetRepository.remove(deleting.id)
    setDeleting(null)
    await refresh()
    toast.success('Ficha excluída')
  }

  function openCreate(): void {
    setTemplateId(templates[0]?.id ?? '')
    // Começa com o nome de quem está logado; na Fase 5 o dono vira a conta de verdade.
    setOwnerName(displayName ?? '')
    setCreating(true)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Fichas"
        description="Personagens preenchidos a partir dos seus modelos publicados."
        actions={
          <Button disabled={templates.length === 0} onClick={openCreate}>
            <Plus className="size-4" />
            Nova ficha
          </Button>
        }
      />

      {loading && <p className="text-muted-foreground text-sm">Carregando…</p>}

      {!loading && templates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum modelo publicado ainda. Uma ficha fica presa a uma versão publicada do modelo,
              então publique uma antes de criar personagens.
            </p>
            <Button variant="outline" onClick={() => void navigate('/templates')}>
              <Wrench className="size-4" />
              Ir para os modelos
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && templates.length > 0 && sheets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma ficha ainda. Crie a primeira.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {sheets.map((sheet) => (
          <Card key={sheet.id}>
            <CardContent className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void navigate(`/sheets/${sheet.id}`)}
              >
                <p className="truncate font-medium">
                  {sheet.name === '' ? 'Personagem sem nome' : sheet.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {sheet.ownerName} · {sheet.templateName} v{sheet.templateVersion} · atualizada{' '}
                  {new Date(sheet.updatedAt).toLocaleString('pt-BR')}
                </p>
              </button>

              {sheet.bars.hp !== undefined && (
                <Badge variant="outline">
                  {sheet.bars.hp.current} / {sheet.bars.hp.max}
                </Badge>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleting(sheet)}
                aria-label="Excluir ficha"
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={creating}
        title="Nova ficha"
        description="A ficha usa a última versão publicada do modelo escolhido."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              disabled={templateId === '' || ownerName.trim() === ''}
              onClick={() => void handleCreate()}
            >
              Criar e abrir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} (v{template.publishedVersion})
              </option>
            ))}
          </Select>
          {/*
            Rótulo para se achar na lista, já preenchido com o nome da conta. Continua
            editável enquanto as fichas são locais: dá para testar a ficha "de outra pessoa".
          */}
          <Input
            autoFocus
            placeholder="De quem é a ficha? Ex.: Thalysson"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
            }}
          />
        </div>
      </Dialog>

      <Dialog
        open={deleting !== null}
        title={`Excluir a ficha de ${deleting?.ownerName ?? ''}?`}
        description="Os valores preenchidos vão embora com ela."
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

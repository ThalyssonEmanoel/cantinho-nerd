import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  allTags,
  CREATURE_KIND_LABELS,
  filterCreatures,
  type Creature,
  type CreatureKind
} from '@/lib/bestiary'
import { deleteCreature, duplicateCreature, listCreatures } from '@/lib/db/bestiary'
import { errorMessage } from '@/lib/db/errors'
import type { SheetTemplateSummary } from '@/lib/sheet'
import { cn } from '@/lib/utils'
import { templateRepository } from '@/features/sheet-templates/repository'
import { newCreature } from './bestiary-actions'
import { CreatureThumb } from './creature-thumb'
import { EncountersTab } from './encounters-tab'

type Tab = 'creatures' | 'encounters'

/**
 * Bestiário do mestre (seção 8): criaturas com stat block do jeito que ele modelou, e os
 * encontros montados com elas. É da conta, não da mesa: serve em todas as sessões.
 */
export function BestiaryPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('creatures')
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    return listCreatures().then(
      (list) => {
        setCreatures(list)
        setLoading(false)
      },
      (error: unknown) => {
        setLoading(false)
        toast.error('O bestiário não carregou', { description: errorMessage(error) })
      }
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Bestiário"
        description="Suas criaturas e encontros, para usar em qualquer mesa. Os jogadores não veem nada daqui."
      />

      <div className="flex gap-1 border-b" role="tablist">
        {(
          [
            ['creatures', 'Criaturas'],
            ['encounters', 'Encontros']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === value
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando…
        </p>
      ) : tab === 'creatures' ? (
        <CreaturesTab creatures={creatures} onChanged={() => void refresh()} />
      ) : (
        <EncountersTab creatures={creatures} />
      )}
    </div>
  )
}

function CreaturesTab({
  creatures,
  onChanged
}: {
  creatures: Creature[]
  onChanged: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<CreatureKind | 'all'>('all')
  const [tags, setTags] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Creature | null>(null)

  const shown = filterCreatures(creatures, query, tags, kind)
  const tagOptions = allTags(creatures)

  async function handleDuplicate(creature: Creature): Promise<void> {
    try {
      await duplicateCreature(creature)
      onChanged()
    } catch (error) {
      toast.error('Não consegui duplicar', { description: errorMessage(error) })
    }
  }

  async function handleDelete(): Promise<void> {
    const creature = deleting
    setDeleting(null)
    if (creature === null) return
    try {
      await deleteCreature(creature.id)
      onChanged()
    } catch (error) {
      toast.error('Não consegui excluir', { description: errorMessage(error) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pelo nome ou tag"
            className="pl-8"
            aria-label="Buscar criatura"
          />
        </div>
        <Select
          value={kind}
          onChange={(event) => setKind(event.target.value as CreatureKind | 'all')}
          aria-label="Tipo"
          className="w-36"
        >
          <option value="all">Todos</option>
          <option value="monster">Monstros</option>
          <option value="npc">NPCs</option>
        </Select>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova criatura
        </Button>
      </div>

      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tag">
          {tagOptions.map((tag) => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setTags(on ? tags.filter((item) => item !== tag) : [...tags, tag])}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  on ? 'border-primary bg-primary/15' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {creatures.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma criatura ainda. Elas usam um modelo de ficha do tipo{' '}
            <strong>Criatura (bestiário)</strong>, montado em Modelos de ficha.
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nada encontrado com esse filtro.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((creature) => (
            <Card key={creature.id}>
              <CardContent className="flex items-center gap-3">
                <CreatureThumb path={creature.imagePath} />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void navigate(`/bestiary/${creature.id}`)}
                >
                  <p className="truncate font-medium">{creature.name || 'Sem nome'}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {CREATURE_KIND_LABELS[creature.kind]}
                    {creature.tags.length > 0 && ` · ${creature.tags.join(', ')}`}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => void handleDuplicate(creature)}
                  aria-label={`Duplicar ${creature.name}`}
                  title="Duplicar"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setDeleting(creature)}
                  aria-label={`Excluir ${creature.name}`}
                  title="Excluir"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <NewCreatureDialog
          onClose={() => setCreating(false)}
          onCreated={(creature) => void navigate(`/bestiary/${creature.id}`)}
        />
      )}

      <Dialog
        open={deleting !== null}
        title={`Excluir ${deleting?.name ?? ''}?`}
        description="Some do bestiário, e os encontros passam a pular o grupo dela. Os tokens que já estão nas mesas continuam, com a ficha deles."
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

/** Nome e modelo `creature` (com versão publicada) da criatura nova. */
function NewCreatureDialog({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: (creature: Creature) => void
}): React.JSX.Element {
  const [templates, setTemplates] = useState<SheetTemplateSummary[] | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void templateRepository.list().then(
      (list) => {
        if (!active) return
        const usable = list.filter(
          (item) => item.kind === 'creature' && item.publishedVersion !== null
        )
        setTemplates(usable)
        setTemplateId(usable[0]?.id ?? '')
      },
      (error: unknown) => {
        if (active) setTemplates([])
        toast.error('Não consegui ler seus modelos', { description: errorMessage(error) })
      }
    )
    return () => {
      active = false
    }
  }, [])

  async function create(): Promise<void> {
    setBusy(true)
    try {
      const template = await templateRepository.get(templateId)
      if (template === null) throw new Error('O modelo não existe mais.')
      onCreated(await newCreature(template, name.trim() === '' ? 'Criatura nova' : name))
    } catch (error) {
      toast.error('Não consegui criar a criatura', { description: errorMessage(error) })
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title="Nova criatura"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || templateId === ''} onClick={() => void create()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Criar
          </Button>
        </>
      }
    >
      {templates === null ? (
        <p className="text-muted-foreground text-sm">Carregando seus modelos…</p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Você ainda não tem um modelo do tipo <strong>Criatura (bestiário)</strong> publicado.
          Crie um em <strong>Modelos de ficha</strong>, monte o stat block (vida, defesa,
          ataques…) e publique.
        </p>
      ) : (
        <div className="space-y-3">
          <Input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome (ex.: Goblin)"
            aria-label="Nome da criatura"
            autoFocus
          />
          <Select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            aria-label="Modelo do stat block"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} (v{template.publishedVersion})
              </option>
            ))}
          </Select>
          <Badge variant="outline">o stat block nasce com os valores padrão do modelo</Badge>
        </div>
      )}
    </Dialog>
  )
}

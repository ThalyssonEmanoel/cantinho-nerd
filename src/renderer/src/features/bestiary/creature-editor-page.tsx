import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpCircle, Image as ImageIcon, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { clampTokenSize } from '@/lib/board'
import { parseTags, type Creature, type CreatureKind } from '@/lib/bestiary'
import { getCreature, updateCreature } from '@/lib/db/bestiary'
import { errorMessage } from '@/lib/db/errors'
import { rollFormula, type RollSummary } from '@/lib/dice'
import {
  createSheetContext,
  fillResourceCurrents,
  migrateValues,
  newId,
  type SheetSchema,
  type SheetTemplate,
  type SheetValue,
  type SheetValues
} from '@/lib/sheet'
import { cn } from '@/lib/utils'
import { GalleryPicker } from '@/features/board/gallery-picker'
import { RollLog, type RollLogEntry } from '@/features/sheet-render/roll-log'
import { SheetView } from '@/features/sheet-render/sheet-view'
import type { RollRequest } from '@/features/sheet-render/types'
import { templateRepository } from '@/features/sheet-templates/repository'
import { CreatureThumb } from './creature-thumb'

interface Loaded {
  creature: Creature
  template: SheetTemplate
}

/** Abre a criatura e o modelo dela; o editor só monta com os dois em mãos. */
export function CreatureEditorPage(): React.JSX.Element {
  const { creatureId } = useParams<{ creatureId: string }>()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (creatureId === undefined) return
    let active = true
    void (async () => {
      try {
        const creature = await getCreature(creatureId)
        if (creature === null) throw new Error('Esta criatura não existe mais.')
        const template = await templateRepository.get(creature.templateId)
        if (template === null) throw new Error('O modelo desta criatura não existe mais.')
        if (active) setLoaded({ creature, template })
      } catch (error) {
        if (active) setProblem(errorMessage(error))
      }
    })()
    return () => {
      active = false
    }
  }, [creatureId])

  if (problem !== null) {
    return (
      <div className="space-y-3 p-8">
        <p className="text-sm">{problem}</p>
        <Button variant="outline" onClick={() => void navigate('/bestiary')}>
          <ArrowLeft className="size-4" />
          Voltar ao bestiário
        </Button>
      </div>
    )
  }
  if (loaded === null) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Abrindo a criatura…
      </p>
    )
  }
  return <CreatureEditor key={loaded.creature.id} {...loaded} />
}

/**
 * O stat block da criatura (seção 8): o modelo `creature` do mestre, preenchido no mesmo
 * renderizador das fichas, como mestre (vê e edita tudo). Os botões de rolagem funcionam
 * de verdade, para testar o ataque antes da sessão.
 *
 * Gravar é explícito ("Salvar"): o stat block é preparação, não jogo, e assim dá para mexer
 * à vontade e desistir.
 */
function CreatureEditor({ creature, template }: Loaded): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState(creature.name)
  const [kind, setKind] = useState<CreatureKind>(creature.kind)
  const [tagsText, setTagsText] = useState(creature.tags.join(', '))
  const [size, setSize] = useState(String(creature.tokenSize))
  const [imagePath, setImagePath] = useState<string | null>(creature.imagePath)
  const [version, setVersion] = useState(creature.templateVersion)
  const [values, setValues] = useState<SheetValues>(creature.values)
  const [tabId, setTabId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [log, setLog] = useState<RollLogEntry[]>([])

  const schema: SheetSchema | null =
    template.versions.find((item) => item.version === version)?.schema ?? null
  const latest = template.versions.at(-1)
  const context = useMemo(
    () => (schema === null ? null : createSheetContext(schema, values).context),
    [schema, values]
  )

  function touch(): void {
    setDirty(true)
  }

  /** Leva o stat block para a versão nova do modelo, sem perder o que já foi preenchido. */
  function upgrade(): void {
    if (latest === undefined) return
    const migrated = migrateValues(latest.schema, values)
    setValues(fillResourceCurrents(latest.schema, migrated.values, migrated.addedIds))
    setVersion(latest.version)
    touch()
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await updateCreature(creature.id, {
        name: name.trim() === '' ? 'Sem nome' : name,
        kind,
        tags: parseTags(tagsText),
        tokenSize: clampTokenSize(Number(size.replace(',', '.'))),
        imagePath,
        templateVersion: version,
        values
      })
      setDirty(false)
      toast.success('Criatura salva')
    } catch (error) {
      toast.error('Não consegui salvar', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  function handleRoll(request: RollRequest): void {
    const result = rollFormula(request.formula, {
      label: request.label,
      critical: request.critical,
      criticalFailureOnOne: request.criticalFailureOnOne,
      context: request.context
    })
    if (!result.ok) {
      toast.error('Não consegui rolar', { description: result.error.message })
      return
    }
    setLog((current) => [toLogEntry(result.roll), ...current].slice(0, 30))
  }

  const currentTab = tabId ?? schema?.tabs[0]?.id ?? ''

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          void save()
        }
      }}
    >
      <header className="flex flex-wrap items-end gap-3 border-b p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate('/bestiary')}
          aria-label="Voltar ao bestiário"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="group relative"
          title="Escolher a imagem na galeria"
          aria-label="Escolher a imagem na galeria"
        >
          <CreatureThumb path={imagePath} className="size-14" />
          <ImageIcon className="bg-card absolute -right-1 -bottom-1 size-5 rounded-full border p-0.5" />
        </button>

        <div className="space-y-1">
          <Label htmlFor="creature-name">Nome</Label>
          <Input
            id="creature-name"
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value)
              touch()
            }}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="creature-kind">Tipo</Label>
          <Select
            id="creature-kind"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as CreatureKind)
              touch()
            }}
          >
            <option value="monster">Monstro</option>
            <option value="npc">NPC</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="creature-size">Tamanho (quadrados)</Label>
          <Input
            id="creature-size"
            value={size}
            inputMode="decimal"
            onChange={(event) => {
              setSize(event.target.value)
              touch()
            }}
            className="w-24"
          />
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="creature-tags">Tags (separadas por vírgula)</Label>
          <Input
            id="creature-tags"
            value={tagsText}
            onChange={(event) => {
              setTagsText(event.target.value)
              touch()
            }}
            placeholder="floresta, fraco, chefe"
          />
        </div>

        <div className="flex items-center gap-2">
          {dirty && <Badge variant="outline">não salvo</Badge>}
          <Button disabled={saving || !dirty} onClick={() => void save()} title="Salvar (Ctrl+S)">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        </div>
      </header>

      {latest !== undefined && latest.version > version && (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm">
          <ArrowUpCircle className="size-4 text-amber-300" />
          O modelo "{template.name}" tem uma versão nova (v{latest.version}). Esta criatura está
          na v{version}.
          <Button size="sm" variant="outline" className="ml-auto" onClick={upgrade}>
            Atualizar o stat block
          </Button>
        </div>
      )}

      {schema === null || context === null ? (
        <p className="text-muted-foreground p-6 text-sm">
          A versão v{version} do modelo não está mais disponível.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] divide-x">
          <div className="flex min-h-0 flex-col">
            {schema.tabs.length > 1 && (
              <div className="flex gap-1 border-b px-3 py-2">
                {schema.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTabId(tab.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-sm transition-colors',
                      tab.id === currentTab
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50'
                    )}
                  >
                    {tab.label === '' ? 'Sem nome' : tab.label}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto">
              <SheetView
                schema={schema}
                tabId={currentTab}
                values={values}
                context={context}
                options={{
                  audience: 'gm',
                  applyConditionalVisibility: true,
                  onChange: (componentId: string, value: SheetValue) => {
                    setValues((current) => ({ ...current, [componentId]: value }))
                    touch()
                  },
                  onRoll: handleRoll
                }}
              />
            </div>
          </div>
          <RollLog
            entries={log}
            onClear={() => setLog([])}
            emptyHint="Clique num botão de rolagem do stat block para testar."
          />
        </div>
      )}

      <GalleryPicker
        open={picking}
        purpose="choose"
        onClose={() => setPicking(false)}
        onPick={async (image) => {
          setImagePath(image.imagePath)
          setSize(String(image.tokenSize))
          touch()
        }}
      />
    </div>
  )
}

function toLogEntry(roll: RollSummary): RollLogEntry {
  return {
    id: newId('roll'),
    label: roll.label ?? 'Rolagem',
    notation: roll.notation,
    detail: roll.detail,
    total: roll.total,
    dice: roll.dice,
    outcome: roll.outcome
  }
}

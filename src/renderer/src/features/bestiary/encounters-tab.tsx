import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  clampGroupCount,
  describeEncounter,
  encounterSize,
  MAX_GROUP_COUNT,
  type Creature,
  type Encounter,
  type EncounterGroup
} from '@/lib/bestiary'
import { deleteEncounter, listEncounters, saveEncounter } from '@/lib/db/bestiary'
import { errorMessage } from '@/lib/db/errors'

/** O que está sendo editado: um encontro salvo, ou um novo (`id` null). */
interface Draft {
  id: string | null
  name: string
  groups: EncounterGroup[]
}

/**
 * Builder de encontros (seção 8): grupos de criatura + quantidade + "começa oculta",
 * salvos para usar de novo. Colocar no mapa é na mesa, com um clique.
 */
export function EncountersTab({ creatures }: { creatures: Creature[] }): React.JSX.Element {
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Encounter | null>(null)

  const refresh = useCallback(() => {
    return listEncounters().then(
      (list) => {
        setEncounters(list)
        setLoading(false)
      },
      (error: unknown) => {
        setLoading(false)
        toast.error('Os encontros não carregaram', { description: errorMessage(error) })
      }
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function updateGroup(index: number, patch: Partial<EncounterGroup>): void {
    if (draft === null) return
    setDraft({
      ...draft,
      groups: draft.groups.map((group, position) =>
        position === index ? { ...group, ...patch } : group
      )
    })
  }

  async function save(): Promise<void> {
    if (draft === null) return
    setBusy(true)
    try {
      await saveEncounter(draft.id, draft.name, draft.groups)
      setDraft(null)
      await refresh()
      toast.success('Encontro salvo')
    } catch (error) {
      toast.error('Não consegui salvar o encontro', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    const encounter = deleting
    setDeleting(null)
    if (encounter === null) return
    try {
      await deleteEncounter(encounter.id)
      await refresh()
    } catch (error) {
      toast.error('Não consegui excluir', { description: errorMessage(error) })
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground flex-1 text-sm">
          Monte o encontro aqui e coloque no mapa pela aba <strong>Mesa</strong> da sessão.
        </p>
        <Button
          disabled={creatures.length === 0}
          onClick={() =>
            setDraft({
              id: null,
              name: '',
              groups: creatures[0] === undefined
                ? []
                : [{ creatureId: creatures[0].id, count: 1, hidden: false }]
            })
          }
        >
          <Plus className="size-4" />
          Novo encontro
        </Button>
      </div>

      {creatures.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Crie criaturas primeiro: o encontro é feito com elas.
        </p>
      )}

      {encounters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhum encontro salvo ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {encounters.map((encounter) => (
            <Card key={encounter.id}>
              <CardContent className="flex items-center gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() =>
                    setDraft({
                      id: encounter.id,
                      name: encounter.name,
                      groups: encounter.groups
                    })
                  }
                >
                  <p className="truncate font-medium">{encounter.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {encounterSize(encounter, creatures)} criatura(s) ·{' '}
                    {describeEncounter(encounter, creatures)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setDeleting(encounter)}
                  aria-label={`Excluir ${encounter.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft !== null && (
        <Dialog
          open
          title={draft.id === null ? 'Novo encontro' : 'Editar encontro'}
          onClose={() => setDraft(null)}
          className="max-w-xl"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button
                disabled={busy || draft.name.trim() === '' || draft.groups.length === 0}
                onClick={() => void save()}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input
              value={draft.name}
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Nome (ex.: Emboscada na estrada)"
              aria-label="Nome do encontro"
            />
            <ul className="space-y-1.5">
              {draft.groups.map((group, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Select
                    value={group.creatureId}
                    onChange={(event) => updateGroup(index, { creatureId: event.target.value })}
                    aria-label={`Criatura do grupo ${index + 1}`}
                    className="flex-1"
                  >
                    {!creatures.some((creature) => creature.id === group.creatureId) && (
                      <option value={group.creatureId}>(criatura excluída)</option>
                    )}
                    {creatures.map((creature) => (
                      <option key={creature.id} value={creature.id}>
                        {creature.name || 'Sem nome'}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_GROUP_COUNT}
                    value={group.count}
                    onChange={(event) =>
                      updateGroup(index, { count: clampGroupCount(Number(event.target.value)) })
                    }
                    className="w-20"
                    aria-label={`Quantidade do grupo ${index + 1}`}
                  />
                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={group.hidden}
                      onChange={(event) => updateGroup(index, { hidden: event.target.checked })}
                    />
                    começa oculta
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        groups: draft.groups.filter((_, position) => position !== index)
                      })
                    }
                    aria-label={`Tirar o grupo ${index + 1}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              disabled={creatures.length === 0}
              onClick={() =>
                setDraft({
                  ...draft,
                  groups: [
                    ...draft.groups,
                    { creatureId: creatures[0]?.id ?? '', count: 1, hidden: false }
                  ]
                })
              }
            >
              <Plus className="size-4" />
              Adicionar grupo
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog
        open={deleting !== null}
        title={`Excluir ${deleting?.name ?? ''}?`}
        description="As criaturas continuam no bestiário."
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              Excluir
            </Button>
          </>
        }
      />
    </div>
  )
}

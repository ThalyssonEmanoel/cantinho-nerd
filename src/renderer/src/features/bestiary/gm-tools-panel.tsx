import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MapPinned, PawPrint, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  describeEncounter,
  encounterSize,
  filterCreatures,
  type Creature,
  type Encounter
} from '@/lib/bestiary'
import { listCreatures, listEncounters } from '@/lib/db/bestiary'
import { errorMessage } from '@/lib/db/errors'
import { useBoardStore } from '@/features/board/board-store'
import {
  pullPlayersToMap,
  spawnCreature,
  spawnEncounter,
  type SpawnOutcome
} from './bestiary-actions'
import { CreatureThumb } from './creature-thumb'

/** Quantas criaturas a busca mostra de uma vez no painel estreito. */
const SHOWN = 8

/**
 * Ferramentas do mestre na mesa (seção 8): puxar os jogadores para o mapa aberto, colocar
 * um encontro inteiro com um clique e colocar uma criatura avulsa do bestiário.
 */
export function GmToolsPanel(): React.JSX.Element {
  const hasMap = useBoardStore((state) => state.openMapId !== null)
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [regroup, setRegroup] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [addToCombat, setAddToCombat] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => {
    return Promise.all([listCreatures(), listEncounters()]).then(
      ([creatureList, encounterList]) => {
        setCreatures(creatureList)
        setEncounters(encounterList)
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

  async function run(key: string, action: () => Promise<void>): Promise<void> {
    setBusy(key)
    try {
      await action()
    } catch (error) {
      toast.error('Não deu certo', { description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  function report(outcome: SpawnOutcome): void {
    if (outcome.placed > 0) {
      toast.success(
        outcome.placed === 1 ? '1 criatura no mapa' : `${outcome.placed} criaturas no mapa`
      )
    }
    if (outcome.skipped > 0) {
      toast.warning(
        `${outcome.skipped} grupo(s) ficaram de fora: a criatura foi excluída ou o modelo dela não abriu.`
      )
    }
  }

  const shown = filterCreatures(creatures, query, []).slice(0, SHOWN)

  return (
    <section className="space-y-3 p-3" aria-label="Ferramentas do mestre">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <PawPrint className="text-muted-foreground size-4" />
        Ferramentas do mestre
        <Link to="/bestiary" className="text-muted-foreground ml-auto text-xs underline">
          Abrir o bestiário
        </Link>
      </h2>

      {!hasMap && (
        <p className="text-muted-foreground text-xs">Abra um mapa para colocar tokens nele.</p>
      )}

      <div className="space-y-1.5">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!hasMap || busy !== null}
          onClick={() =>
            void run('pull', async () => {
              const changed = await pullPlayersToMap(regroup)
              toast.success(
                changed === 0
                  ? 'Todos os jogadores já estavam no mapa.'
                  : `${changed} jogador(es) ${regroup ? 'reagrupados' : 'puxados'} para o mapa`
              )
            })
          }
        >
          {busy === 'pull' ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          Puxar jogadores
        </Button>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={regroup}
            onChange={(event) => setRegroup(event.target.checked)}
          />
          Reagrupar quem já está no mapa
        </label>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={hidden}
            onChange={(event) => setHidden(event.target.checked)}
          />
          Criatura avulsa começa oculta
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={addToCombat}
            onChange={(event) => setAddToCombat(event.target.checked)}
          />
          Já pôr no combate
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" />
          Carregando o bestiário…
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Encontros</p>
            {encounters.length === 0 ? (
              <p className="text-muted-foreground text-xs">Nenhum encontro salvo.</p>
            ) : (
              <ul className="space-y-1">
                {encounters.map((encounter) => (
                  <li key={encounter.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{encounter.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {describeEncounter(encounter, creatures)}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      disabled={
                        !hasMap || busy !== null || encounterSize(encounter, creatures) === 0
                      }
                      onClick={() =>
                        void run(`e:${encounter.id}`, async () => {
                          report(await spawnEncounter(encounter, creatures, { addToCombat }))
                        })
                      }
                      aria-label={`Colocar o encontro ${encounter.name}`}
                    >
                      {busy === `e:${encounter.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <MapPinned className="size-3.5" />
                      )}
                      Colocar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Criaturas</p>
            {creatures.length === 0 ? (
              <p className="text-muted-foreground text-xs">O bestiário está vazio.</p>
            ) : (
              <>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-2 left-2 size-3.5" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar"
                    className="h-7 pl-7 text-sm"
                    aria-label="Buscar no bestiário"
                  />
                </div>
                <ul className="space-y-1">
                  {shown.map((creature) => (
                    <li key={creature.id} className="flex items-center gap-2">
                      <CreatureThumb path={creature.imagePath} className="size-7" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {creature.name || 'Sem nome'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        disabled={!hasMap || busy !== null}
                        onClick={() =>
                          void run(`c:${creature.id}`, async () => {
                            report(await spawnCreature(creature, { hidden, addToCombat }))
                          })
                        }
                        aria-label={`Colocar ${creature.name}`}
                      >
                        {busy === `c:${creature.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <MapPinned className="size-3.5" />
                        )}
                        Colocar
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

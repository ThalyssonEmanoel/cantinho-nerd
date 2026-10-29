import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  Dices,
  EyeOff,
  GripVertical,
  Loader2,
  Play,
  Plus,
  ScrollText,
  SkipForward,
  Swords,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TOKEN_KIND_COLORS } from '@/lib/board'
import {
  currentEntry,
  describeHpChange,
  entryLabel,
  formatHp,
  isMyTurn,
  moveEntry,
  type CombatEntry
} from '@/lib/combat'
import { errorMessage } from '@/lib/db/errors'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useBoardStore } from '@/features/board/board-store'
import { useSessionStore } from '@/features/session/session-store'
import {
  addTokensToCombat,
  clearCombatLog,
  endCombat,
  endMyTurn,
  nextTurn,
  removeParticipant,
  reorderParticipants,
  rollInitiatives,
  setInitiative,
  startCombat
} from './combat-actions'
import { useCombatStore } from './combat-store'

/** Faz a ação e transforma o erro do banco em aviso, sem derrubar a tela. */
async function attempt(title: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (error) {
    toast.error(title, { description: errorMessage(error) })
  }
}

type AddMode = 'selected' | 'map' | 'players'

/**
 * Tracker de iniciativa e log de combate (7.3), na aba "Combate" do painel da mesa.
 *
 * O mestre conduz: inicia, põe e tira participantes, rola e edita a iniciativa, reordena
 * arrastando e passa o turno. O jogador acompanha e, na vez dele, encerra o próprio turno.
 */
export function CombatPanel(): React.JSX.Element {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const members = useSessionStore((state) => state.session?.members)
  const userId = useAuthStore((state) => state.userId)
  const state = useCombatStore((state) => state.state)
  const entries = useCombatStore((state) => state.entries)
  const log = useCombatStore((state) => state.log)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<'end' | 'log' | null>(null)

  const isGm = role === 'gm'
  const current = currentEntry(entries, state)
  const myTurn = isMyTurn(entries, state, userId)
  const nameOf = (id: string): string =>
    members?.find((member) => member.userId === id)?.displayName ?? ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function run(title: string, action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    await attempt(title, action)
    setBusy(false)
  }

  async function add(mode: AddMode): Promise<void> {
    setAdding(false)
    const board = useBoardStore.getState()
    const tokens =
      mode === 'selected'
        ? board.tokens.filter((token) => board.selection.includes(token.id))
        : mode === 'players'
          ? board.tokens.filter((token) => token.kind === 'player')
          : // Objetos (porta, baú) são cenário: não entram no "todos do mapa".
            board.tokens.filter((token) => token.kind !== 'object')
    if (tokens.length === 0) {
      toast.info(
        mode === 'selected'
          ? 'Selecione tokens no mapa primeiro.'
          : 'Não há tokens assim no mapa aberto.'
      )
      return
    }
    await run('Não consegui adicionar ao combate', async () => {
      const added = await addTokensToCombat(tokens.map((token) => token.id))
      if (added === 0) toast.info('Todos esses já estão no combate.')
    })
  }

  async function rollMissing(): Promise<void> {
    const missing = entries.filter((entry) => entry.initiative === null)
    if (missing.length === 0) {
      toast.info('Todos já têm iniciativa. Use o dado de cada um para rolar de novo.')
      return
    }
    await run('Não consegui rolar a iniciativa', async () => {
      const problems = await rollInitiatives(missing)
      if (problems.length > 0) {
        toast.warning('Algumas fichas não deixaram rolar: foi 1d20 no lugar', {
          description: problems.join('\n')
        })
      }
    })
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (over === null || active.id === over.id) return
    const ids = moveEntry(
      entries.map((entry) => entry.id),
      String(active.id),
      String(over.id)
    )
    void attempt('Não consegui reordenar', () => reorderParticipants(ids))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="space-y-2 border-b p-3" aria-label="Tracker de iniciativa">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Swords className="text-muted-foreground size-4" />
          Combate
          {state.active && (
            <Badge variant="secondary" className="ml-auto">
              Rodada {state.round}
            </Badge>
          )}
        </h2>

        {!state.active ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Nenhum combate em andamento.</p>
            {isGm && (
              <>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void run('Não consegui iniciar o combate', startCombat)}
                >
                  <Swords className="size-4" />
                  Iniciar combate
                </Button>
                <p className="text-muted-foreground text-xs">
                  Ou selecione tokens no mapa e use <strong>Adicionar ao combate</strong>, na
                  barra de baixo.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {isGm && (
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setAdding((open) => !open)}
                  aria-expanded={adding}
                >
                  <Plus className="size-4" />
                  Adicionar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || entries.length === 0}
                  onClick={() => void rollMissing()}
                  title="Rola para quem ainda não tem iniciativa, pelo papel Iniciativa da ficha"
                >
                  <Dices className="size-4" />
                  Rolar iniciativa
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive ml-auto"
                  disabled={busy}
                  onClick={() => setConfirm('end')}
                >
                  Encerrar
                </Button>
              </div>
            )}

            {isGm && adding && (
              <div className="bg-muted/40 grid gap-1 rounded-md border p-1" role="menu">
                <AddOption onPick={() => void add('selected')}>Os selecionados no mapa</AddOption>
                <AddOption onPick={() => void add('map')}>
                  Todos do mapa aberto (menos objetos)
                </AddOption>
                <AddOption onPick={() => void add('players')}>Só os jogadores</AddOption>
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {isGm ? 'Ninguém no combate ainda.' : 'O mestre ainda está montando o combate.'}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={entries.map((entry) => entry.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="space-y-1" aria-label="Ordem dos turnos">
                    {entries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        isGm={isGm}
                        mine={entry.ownerId === userId}
                        active={entry.id === current?.id}
                        sortable={isGm && entries.length > 1}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}

            {isGm && entries.length > 0 && (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => void run('Não consegui passar o turno', nextTurn)}
              >
                {state.turnEntryId === null ? (
                  <>
                    <Play className="size-4" />
                    Começar o turno
                  </>
                ) : (
                  <>
                    <SkipForward className="size-4" />
                    Próximo turno
                  </>
                )}
              </Button>
            )}
            {!isGm && myTurn && (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => void run('Não consegui encerrar o turno', endMyTurn)}
              >
                <SkipForward className="size-4" />
                Encerrar meu turno
              </Button>
            )}
          </>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col p-3" aria-label="Log de combate">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ScrollText className="text-muted-foreground size-4" />
          Log de combate
          {isGm && log.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground ml-auto h-7"
              onClick={() => setConfirm('log')}
            >
              <Trash2 className="size-3.5" />
              Limpar
            </Button>
          )}
        </h2>
        {log.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Dano e cura aplicados aparecem aqui: quem, em quem, quanto e a vida antes → depois.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {log.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex items-baseline gap-2 rounded px-1.5 py-1 text-xs',
                  item.kind === 'damage' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                )}
              >
                <span className="min-w-0 flex-1">
                  {describeHpChange(item, nameOf(item.actorId), isGm)}
                  {isGm && item.tokenHidden && (
                    <EyeOff
                      className="text-muted-foreground ml-1 inline size-3"
                      aria-label="token oculto"
                    />
                  )}
                </span>
                <time className="text-muted-foreground shrink-0 tabular-nums">
                  {formatTime(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={confirm !== null}
        title={confirm === 'end' ? 'Encerrar o combate?' : 'Limpar o log de combate?'}
        description={
          confirm === 'end'
            ? 'O tracker é limpo: participantes, iniciativas e rodada. O log continua.'
            : 'Some o histórico de dano e cura para todo mundo. Não tem como desfazer.'
        }
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const which = confirm
                setConfirm(null)
                if (which === 'end') void run('Não consegui encerrar o combate', endCombat)
                else void attempt('Não consegui limpar o log', clearCombatLog)
              }}
            >
              {confirm === 'end' ? 'Encerrar combate' : 'Limpar o log'}
            </Button>
          </>
        }
      />
    </div>
  )
}

function AddOption({
  onPick,
  children
}: {
  onPick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      className="hover:bg-accent rounded px-2 py-1 text-left text-sm"
      onClick={onPick}
    >
      {children}
    </button>
  )
}

interface EntryRowProps {
  entry: CombatEntry
  isGm: boolean
  mine: boolean
  active: boolean
  sortable: boolean
}

function EntryRow({ entry, isGm, mine, active, sortable }: EntryRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: !sortable
  })
  const label = entryLabel(entry, isGm)

  return (
    <li
      ref={setNodeRef}
      aria-current={active ? 'step' : undefined}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-1.5 py-1',
        active ? 'border-amber-400/70 bg-amber-500/15' : 'bg-card/40',
        isDragging && 'bg-accent/40 relative z-10'
      )}
      style={{
        transform: transform === null ? undefined : `translate3d(0, ${transform.y}px, 0)`,
        transition
      }}
    >
      {sortable && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label={`Reordenar ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}

      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.65rem] font-semibold"
        style={{ borderColor: TOKEN_KIND_COLORS[entry.kind] }}
        aria-hidden="true"
      >
        {label.slice(0, 1).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        {active && <span className="sr-only">Vez de </span>}
        {label}
        {mine && <span className="text-muted-foreground"> (você)</span>}
      </span>

      {isGm && entry.hidden && (
        <EyeOff className="text-muted-foreground size-3.5 shrink-0" aria-label="oculto" />
      )}

      {isGm ? (
        <>
          <InitiativeInput key={`${entry.id}:${entry.initiative ?? ''}`} entry={entry} label={label} />
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() =>
              void attempt('Não consegui rolar a iniciativa', () => rollInitiatives([entry]))
            }
            aria-label={`Rolar a iniciativa de ${label}`}
            title="Rolar a iniciativa"
          >
            <Dices className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() =>
              void attempt('Não consegui tirar do combate', () => removeParticipant(entry.id))
            }
            aria-label={`Tirar ${label} do combate`}
            title="Tirar do combate"
          >
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground w-8 text-right text-sm tabular-nums">
          {entry.initiative === null ? '—' : formatHp(entry.initiative)}
        </span>
      )}
    </li>
  )
}

/**
 * Iniciativa digitada pelo mestre. Grava ao sair do campo ou no Enter — gravar a cada tecla
 * reordenaria a fila no meio da digitação. A `key` inclui o valor, então o campo recomeça
 * do que o banco tem quando outra pessoa (ou a rolagem) muda o número.
 */
function InitiativeInput({ entry, label }: { entry: CombatEntry; label: string }): React.JSX.Element {
  const initial = entry.initiative === null ? '' : String(entry.initiative)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function commit(): Promise<void> {
    const text = draft.trim().replace(',', '.')
    if (text === initial) return
    const value = text === '' ? null : Number(text)
    if (value !== null && !Number.isFinite(value)) {
      setDraft(initial)
      toast.error('A iniciativa precisa ser um número.')
      return
    }
    setSaving(true)
    await attempt('Não consegui gravar a iniciativa', () => setInitiative(entry.id, value))
    setSaving(false)
  }

  return (
    <span className="relative">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(initial)
        }}
        inputMode="decimal"
        className="h-7 w-12 px-1 text-center text-sm tabular-nums"
        aria-label={`Iniciativa de ${label}`}
        placeholder="—"
      />
      {saving && (
        <Loader2 className="text-muted-foreground absolute top-1.5 -right-1 size-3 animate-spin" />
      )}
    </span>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  setConditionRounds,
  toggleCondition,
  type BoardToken,
  type ConditionDef,
  type TokenCondition
} from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import { cn } from '@/lib/utils'
import { applyTokenPatch } from './board-actions'

interface ConditionsDialogProps {
  /** O pai monta com `key={token.id}`: o estado inicial já vem do token certo. */
  token: BoardToken
  /** A lista da mesa (6.3). */
  available: readonly ConditionDef[]
  onClose: () => void
}

/**
 * Condições de um token (6.3): liga e desliga as da lista da mesa e, se quiser, dá uma
 * duração em rodadas — ela cai no fim de cada turno do token no combate e, ao zerar, a
 * condição sai sozinha.
 */
export function ConditionsDialog({
  token,
  available,
  onClose
}: ConditionsDialogProps): React.JSX.Element {
  const [list, setList] = useState<TokenCondition[]>(token.conditions)
  const [saving, setSaving] = useState(false)

  // Condição que saiu da lista da mesa mas continua no token: aparece para dar para tirar.
  const extra = list.filter((item) => !available.some((def) => def.key === item.key))
  const options: ConditionDef[] = [...available, ...extra]

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await applyTokenPatch(token, { conditions: list })
      onClose()
    } catch (error) {
      toast.error('Não consegui salvar as condições', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Condições"
      description={token.name === '' ? 'Token sem nome' : token.name}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          A mesa não tem condições. O mestre monta a lista em <strong>Gerenciar</strong>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Condições">
          {options.map((def) => {
            const on = list.some((item) => item.key === def.key)
            return (
              <button
                key={def.key}
                type="button"
                aria-pressed={on}
                onClick={() => setList(toggleCondition(list, def))}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors',
                  on
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <span aria-hidden="true">{def.icon}</span>
                {def.name}
              </button>
            )
          })}
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-muted-foreground text-xs">
            Duração em rodadas (vazio = até tirar). Cai no fim de cada turno deste token.
          </p>
          <ul className="space-y-1">
            {list.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <Input
                  value={item.rounds === null ? '' : String(item.rounds)}
                  onChange={(event) =>
                    setList(setConditionRounds(list, item.key, event.target.value))
                  }
                  inputMode="numeric"
                  placeholder="—"
                  className="h-8 w-16 text-center tabular-nums"
                  aria-label={`Rodadas de ${item.name}`}
                />
                <span className="text-muted-foreground w-14 text-xs">rodadas</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  )
}

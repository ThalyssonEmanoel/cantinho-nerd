import { useState } from 'react'
import { HeartPlus, Loader2, Swords, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hpTargets, parseHpAmount, type HpChangeKind } from '@/lib/combat'
import { errorMessage } from '@/lib/db/errors'
import type { SessionRole } from '@/lib/db/sessions'
import { addTokensToCombat, applyHp } from '@/features/combat/combat-actions'
import { useBoardStore } from './board-store'

interface SelectionBarProps {
  role: SessionRole
  userId: string | null
}

/**
 * Barra de baixo do tabuleiro, com tokens selecionados (7.3): o valor, Dano e Cura, e — para
 * o mestre — pôr os selecionados no combate. O mestre aplica em qualquer token; o jogador,
 * só nos próprios (o banco confere de novo).
 */
export function SelectionBar({ role, userId }: SelectionBarProps): React.JSX.Element | null {
  const tokens = useBoardStore((state) => state.tokens)
  const selection = useBoardStore((state) => state.selection)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  if (selection.length === 0) return null
  const targets = hpTargets(tokens, selection, role, userId)

  async function apply(kind: HpChangeKind): Promise<void> {
    const value = parseHpAmount(amount)
    if (value === null) {
      toast.error('Digite quanto de dano ou cura (um número de 0 a 100000).')
      return
    }
    setBusy(true)
    try {
      const results = await applyHp(
        targets.map((token) => token.id),
        kind,
        value
      )
      const skipped = results.filter((result) => result.skipped).length
      if (skipped > 0) {
        toast.info(
          skipped === 1 ? 'Um dos tokens não tem vida.' : `${skipped} tokens não têm vida.`
        )
      }
      setAmount('')
    } catch (error) {
      toast.error(kind === 'damage' ? 'Não consegui aplicar o dano' : 'Não consegui curar', {
        description: errorMessage(error)
      })
    } finally {
      setBusy(false)
    }
  }

  async function addToCombat(): Promise<void> {
    setBusy(true)
    try {
      const added = await addTokensToCombat(selection)
      toast.success(
        added === 0
          ? 'Esses já estavam no combate.'
          : added === 1
            ? 'Um token entrou no combate.'
            : `${added} tokens entraram no combate.`
      )
    } catch (error) {
      toast.error('Não consegui adicionar ao combate', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="bg-card/60 flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-xs"
      aria-label="Tokens selecionados"
    >
      <span className="text-muted-foreground">
        {selection.length === 1 ? '1 selecionado' : `${selection.length} selecionados`}
      </span>

      {targets.length > 0 ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            // Enter no valor aplica dano: é o caso mais comum no meio do combate.
            event.preventDefault()
            void apply('damage')
          }}
        >
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="Valor"
            className="h-7 w-20 text-center tabular-nums"
            aria-label="Valor de dano ou cura"
          />
          <Button type="submit" size="sm" variant="destructive" className="h-7" disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            Dano
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={busy}
            onClick={() => void apply('heal')}
          >
            <HeartPlus className="size-3.5" />
            Cura
          </Button>
          {targets.length < selection.length && (
            <span className="text-muted-foreground">
              (vale para {targets.length} de {selection.length})
            </span>
          )}
        </form>
      ) : (
        <span className="text-muted-foreground">
          {role === 'player'
            ? 'Dano e cura: só nos seus tokens.'
            : 'Nenhum dos selecionados tem vida.'}
        </span>
      )}

      {role === 'gm' && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          disabled={busy}
          onClick={() => void addToCombat()}
        >
          <Swords className="size-3.5" />
          Adicionar ao combate
        </Button>
      )}

      <span className="text-muted-foreground ml-auto">Del exclui · Esc limpa a seleção</span>
    </div>
  )
}

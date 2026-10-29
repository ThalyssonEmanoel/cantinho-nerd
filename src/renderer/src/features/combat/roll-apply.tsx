import { useState } from 'react'
import { HeartPlus, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { formatHp, hpTargets, type HpChangeKind } from '@/lib/combat'
import { errorMessage } from '@/lib/db/errors'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useBoardStore } from '@/features/board/board-store'
import { useSessionStore } from '@/features/session/session-store'
import { applyHp } from './combat-actions'

/**
 * "Aplicar como dano/cura nos selecionados" (7.3), embaixo de uma rolagem do chat: o total
 * vai para os tokens selecionados no mapa que esta pessoa pode afetar.
 */
export function RollApply({ total }: { total: number }): React.JSX.Element | null {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const userId = useAuthStore((state) => state.userId)
  // Só a contagem: um seletor que devolve lista nova a cada leitura faria a tela girar.
  const count = useBoardStore(
    (state) => hpTargets(state.tokens, state.selection, role, userId).length
  )
  const [busy, setBusy] = useState(false)

  // Rolagem negativa não vira dano nem cura.
  if (!Number.isFinite(total) || total < 0) return null

  async function apply(kind: HpChangeKind): Promise<void> {
    const board = useBoardStore.getState()
    const targets = hpTargets(board.tokens, board.selection, role, userId)
    if (targets.length === 0) return
    setBusy(true)
    try {
      await applyHp(
        targets.map((token) => token.id),
        kind,
        total
      )
      const who = targets.length === 1 ? '1 token' : `${targets.length} tokens`
      toast.success(
        kind === 'damage'
          ? `${formatHp(total)} de dano em ${who}`
          : `${formatHp(total)} de cura em ${who}`
      )
    } catch (error) {
      toast.error(kind === 'damage' ? 'Não consegui aplicar o dano' : 'Não consegui curar', {
        description: errorMessage(error)
      })
    } finally {
      setBusy(false)
    }
  }

  const title =
    count === 0
      ? 'Selecione tokens no mapa para aplicar este total neles'
      : `Aplicar ${formatHp(total)} nos ${count} selecionado(s)`

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs transition-opacity',
        count === 0 && 'opacity-0 group-hover:opacity-60 focus-within:opacity-100'
      )}
    >
      {busy && <Loader2 className="text-muted-foreground size-3 animate-spin" />}
      <ApplyButton
        disabled={busy || count === 0}
        title={title}
        onClick={() => void apply('damage')}
        className="text-red-300 hover:bg-red-500/15"
      >
        <Zap className="size-3" />
        Dano{count > 0 ? ` (${count})` : ''}
      </ApplyButton>
      <ApplyButton
        disabled={busy || count === 0}
        title={title}
        onClick={() => void apply('heal')}
        className="text-emerald-300 hover:bg-emerald-500/15"
      >
        <HeartPlus className="size-3" />
        Cura{count > 0 ? ` (${count})` : ''}
      </ApplyButton>
      <span className="text-muted-foreground">nos selecionados</span>
    </div>
  )
}

function ApplyButton({
  disabled,
  title,
  onClick,
  className,
  children
}: {
  disabled: boolean
  title: string
  onClick: () => void
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

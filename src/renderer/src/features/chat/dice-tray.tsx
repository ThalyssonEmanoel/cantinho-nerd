import { useState } from 'react'
import { Dices, EyeOff, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addDie,
  advantageNotation,
  isPoolEmpty,
  poolNotation,
  TRAY_DICE,
  type DicePool,
  type DiceRules,
  type TrayDie
} from '@/lib/chat/tray'
import { cn } from '@/lib/utils'
import { useChatStore } from './chat-store'

/**
 * Bandeja de dados (7.1): clicar nos dados monta a rolagem (botão direito tira um), com
 * modificador; vantagem e desvantagem num clique; fórmula livre; favoritas da mesa; e
 * rolagem secreta, que só o autor e o mestre veem.
 */
export function DiceTray({ rules }: { rules: DiceRules }): React.JSX.Element {
  const macros = useChatStore((state) => state.macros)
  const [pool, setPool] = useState<DicePool>({})
  const [modifier, setModifier] = useState(0)
  const [formula, setFormula] = useState('')
  const [secret, setSecret] = useState(false)
  const [rolling, setRolling] = useState(false)

  async function roll(notation: string, label = ''): Promise<boolean> {
    if (notation.trim() === '' || rolling) return false
    setRolling(true)
    const result = await useChatStore
      .getState()
      .roll({ formula: notation, label, ...rules, secret })
    setRolling(false)
    if (!result.ok) toast.error('Não consegui rolar', { description: result.message })
    return result.ok
  }

  async function saveFavorite(): Promise<void> {
    const text = formula.trim()
    if (text === '') return
    const result = await useChatStore.getState().saveMacro(text, text)
    if (result.ok) toast.success('Fórmula salva nas favoritas')
    else toast.error('Não consegui salvar a favorita', { description: result.message })
  }

  const notation = poolNotation(pool, modifier)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {TRAY_DICE.map((sides: TrayDie) => (
          <button
            key={sides}
            type="button"
            title={`d${sides} (clique para pôr, botão direito para tirar)`}
            aria-label={`d${sides}`}
            onClick={() => setPool((current) => addDie(current, sides))}
            onContextMenu={(event) => {
              event.preventDefault()
              setPool((current) => addDie(current, sides, -1))
            }}
            className={cn(
              'hover:bg-accent relative rounded-md border py-1.5 text-xs font-semibold tabular-nums transition-colors',
              (pool[sides] ?? 0) > 0 && 'border-primary bg-primary/10'
            )}
          >
            d{sides}
            {(pool[sides] ?? 0) > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1 rounded-full px-1 text-[0.6rem]">
                {pool[sides]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          className="h-8 w-16 text-center text-sm"
          value={modifier}
          aria-label="Modificador"
          title="Modificador"
          onChange={(event) => setModifier(Math.trunc(Number(event.target.value) || 0))}
        />
        <Button
          size="sm"
          className="h-8 flex-1"
          disabled={isPoolEmpty(pool) || rolling}
          onClick={() =>
            void roll(notation).then((ok) => {
              if (ok) setPool({})
            })
          }
        >
          <Dices className="size-4" />
          {isPoolEmpty(pool) ? 'Escolha os dados' : `Rolar ${notation}`}
        </Button>
        {!isPoolEmpty(pool) && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setPool({})}
            aria-label="Limpar a bandeja"
            title="Limpar a bandeja"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={rolling}
          onClick={() => void roll(advantageNotation('advantage', modifier), 'Vantagem')}
        >
          Vantagem
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={rolling}
          onClick={() => void roll(advantageNotation('disadvantage', modifier), 'Desvantagem')}
        >
          Desvantagem
        </Button>
      </div>

      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          void roll(formula)
        }}
      >
        <Input
          className="h-8 font-mono text-xs"
          placeholder="Fórmula livre: 2d6+3"
          value={formula}
          aria-label="Fórmula livre"
          onChange={(event) => setFormula(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={formula.trim() === ''}
          onClick={() => void saveFavorite()}
          aria-label="Salvar nas favoritas"
          title="Salvar nas favoritas"
        >
          <Star className="size-4" />
        </Button>
        <Button type="submit" size="sm" className="h-8" disabled={formula.trim() === '' || rolling}>
          Rolar
        </Button>
      </form>

      {macros.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {macros.map((macro) => (
            <span key={macro.id} className="bg-muted flex items-center rounded-md text-xs">
              <button
                type="button"
                className="hover:text-primary px-2 py-1 font-mono"
                title={`Rolar ${macro.formula}`}
                onClick={() =>
                  void roll(macro.formula, macro.label === macro.formula ? '' : macro.label)
                }
              >
                {macro.label === '' ? macro.formula : macro.label}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive pr-1.5"
                aria-label={`Tirar ${macro.formula} das favoritas`}
                title="Tirar das favoritas"
                onClick={() =>
                  void useChatStore
                    .getState()
                    .deleteMacro(macro.id)
                    .then((result) => {
                      if (!result.ok)
                        toast.error('Não consegui tirar a favorita', {
                          description: result.message
                        })
                    })
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="accent-primary size-3.5"
          checked={secret}
          onChange={(event) => setSecret(event.target.checked)}
        />
        <EyeOff className="size-3" />
        Rolagem secreta (só você e o mestre veem)
      </label>
    </div>
  )
}

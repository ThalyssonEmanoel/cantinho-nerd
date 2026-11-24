import { Input } from '@/components/ui/input'
import type { RollCost } from '@/lib/sheet'

interface RollCostInputsProps {
  cost: RollCost | undefined
  /** Exemplo do campo "quanto": numa tabela, a coluna da linha (`=pe`); fora dela, um número. */
  amountPlaceholder: string
  onChange: (cost: RollCost | undefined) => void
}

/**
 * "Desconta ao rolar" (`RollCost`): a chave da barra ou do número e quanto sai dela.
 *
 * Os dois vazios tiram o custo do botão, e ele volta a só rolar. A validação do modelo acusa a
 * chave que não existe ou que não é barra nem número.
 */
export function RollCostInputs({
  cost,
  amountPlaceholder,
  onChange
}: RollCostInputsProps): React.JSX.Element {
  function update(change: Partial<RollCost>): void {
    const next = { target: cost?.target ?? '', amount: cost?.amount ?? '', ...change }
    onChange(next.target.trim() === '' && next.amount.trim() === '' ? undefined : next)
  }

  return (
    <div
      className="grid grid-cols-2 gap-2"
      title="Ao rolar, desconta da ficha (a barra ou o número). Faltou, rola do mesmo jeito, o campo vai a 0 e o chat avisa quanto faltou."
    >
      <Input
        className="h-7 font-mono text-xs"
        value={cost?.target ?? ''}
        placeholder="desconta de: energia"
        aria-label="Desconta de (chave da barra ou do número)"
        onChange={(event) => update({ target: event.target.value })}
      />
      <Input
        className="h-7 font-mono text-xs"
        value={cost?.amount ?? ''}
        placeholder={`quanto: ${amountPlaceholder}`}
        aria-label="Quanto desconta (número ou fórmula)"
        onChange={(event) => update({ amount: event.target.value })}
      />
    </div>
  )
}

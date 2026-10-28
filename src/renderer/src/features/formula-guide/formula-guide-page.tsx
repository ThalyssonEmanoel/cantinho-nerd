import { PageHeader } from '@/components/page-header'
import { FormulaGuide } from './formula-guide'

/** Tela do Guia de fórmulas, também aberto dentro do construtor pelo botão "Guia". */
export function FormulaGuidePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <PageHeader
        title="Guia de fórmulas"
        description="Como escrever fórmulas e ligar um componente ao outro no construtor de fichas."
      />
      <FormulaGuide />
    </div>
  )
}

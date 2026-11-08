import { ImageIcon } from 'lucide-react'
import { useAssetImage } from '@/hooks/use-asset-image'
import { evaluateFormula, type FormulaContext } from '@/lib/formula'
import type { SheetComponent } from '@/lib/sheet'
import { cn } from '@/lib/utils'

type FigureComponent = Extract<SheetComponent, { type: 'figure' }>

interface FigureViewProps {
  component: FigureComponent
  context: FormulaContext
}

/** O caminho da imagem da ficha que a fórmula aponta; vazio quando ela não dá em nada. */
function sourcePath(component: FigureComponent, context: FormulaContext): string {
  const formula = component.sourceFormula
  if (formula === undefined || formula.trim() === '') return ''

  const result = evaluateFormula(formula, context)
  return result.ok && typeof result.value === 'string' ? result.value : ''
}

/**
 * Imagem que a ficha só mostra (5.3): um diagrama que vem com o modelo ou a repetição de uma
 * imagem da própria ficha em outra aba. Trocar a foto continua sendo no campo de imagem.
 */
export function FigureView({ component, context }: FigureViewProps): React.JSX.Element {
  const { image } = useAssetImage(sourcePath(component, context))
  const src = image?.src ?? component.src

  if (src === undefined) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex h-full w-full items-center justify-center rounded-md border border-dashed">
        <ImageIcon className="size-5" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={component.hint ?? component.label}
      draggable={false}
      className={cn(
        'size-full rounded-md',
        component.fit === 'cover' ? 'object-cover' : 'object-contain'
      )}
    />
  )
}

import type { FormulaContext } from '@/lib/formula'
import { evaluateFormula, toBoolean } from '@/lib/formula'
import {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  type SheetComponent,
  type SheetSchema,
  type SheetValues
} from '@/lib/sheet'
import { ComponentView } from './component-view'
import { canSee, type SheetRenderOptions } from './types'

interface SheetViewProps {
  schema: SheetSchema
  tabId: string
  values: SheetValues
  context: FormulaContext
  options: SheetRenderOptions
}

/**
 * Desenha uma aba da ficha na mesma geometria do construtor.
 *
 * Usa CSS grid com as mesmas coordenadas da grade de 12 colunas: aqui não há arrastar,
 * então não vale carregar a react-grid-layout só para posicionar.
 */
export function SheetView({
  schema,
  tabId,
  values,
  context,
  options
}: SheetViewProps): React.JSX.Element {
  const tab = schema.tabs.find((item) => item.id === tabId) ?? schema.tabs[0]

  if (tab === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Este modelo não tem abas.</p>
  }

  const visible = tab.components.filter((component) => isVisible(component, context, options))

  return (
    <div
      className="grid gap-2 p-4"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        gridAutoRows: `${GRID_ROW_HEIGHT}px`
      }}
    >
      {visible.map((component) => (
        <div
          key={component.id}
          style={{
            gridColumn: `${component.layout.x + 1} / span ${component.layout.w}`,
            gridRow: `${component.layout.y + 1} / span ${component.layout.h}`
          }}
        >
          <ComponentView
            component={component}
            context={context}
            values={values}
            options={options}
          />
        </div>
      ))}

      {visible.length === 0 && (
        <p className="text-muted-foreground col-span-12 p-4 text-sm">
          Nada para mostrar nesta aba.
        </p>
      )}
    </div>
  )
}

function isVisible(
  component: SheetComponent,
  context: FormulaContext,
  options: SheetRenderOptions
): boolean {
  if (!canSee(component, options)) return false
  if (options.applyConditionalVisibility !== true) return true

  const condition = component.visibleWhen
  if (condition === undefined || condition.trim() === '') return true

  const result = evaluateFormula(condition, context)
  // Condição quebrada não esconde o campo: melhor mostrar do que o jogador perder acesso
  // a um campo da ficha dele por causa de um erro de digitação do mestre.
  return result.ok ? toBoolean(result.value) : true
}

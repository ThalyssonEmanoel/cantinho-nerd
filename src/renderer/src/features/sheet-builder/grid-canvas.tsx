import { useMemo } from 'react'
import {
  GridLayout,
  noCompactor,
  useContainerWidth,
  type Compactor,
  type Layout,
  type LayoutItem
} from 'react-grid-layout'
import type { FormulaContext } from '@/lib/formula'
import {
  defaultSizeFor,
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  type ComponentType,
  type GridPosition,
  type SheetSchema,
  type SheetValues
} from '@/lib/sheet'
import { ComponentView } from '@/features/sheet-render/component-view'
import { cn } from '@/lib/utils'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

/**
 * Grade do construtor: 12 colunas, arrastar, redimensionar com encaixe (5.2).
 *
 * `noCompactor` com `preventCollision` é o que faz "os itens ficam onde foram soltos":
 * nada sobe sozinho para preencher buraco, e soltar em cima de outro componente é recusado
 * em vez de empurrar o vizinho.
 */
const STAY_PUT: Compactor = { ...noCompactor, preventCollision: true }

export interface GridCanvasProps {
  schema: SheetSchema
  tabId: string
  values: SheetValues
  context: FormulaContext
  selectedId: string | null
  /** Tipo que está sendo arrastado da paleta, para o espaço reservado ter o tamanho certo. */
  draggingType: ComponentType | null
  onSelect: (componentId: string | null) => void
  onLayoutsChange: (layouts: (GridPosition & { id: string })[]) => void
  onDropNew: (position: { x: number; y: number }) => void
  /** Começou a arrastar ou redimensionar: a tela guarda o estado para o Desfazer. */
  onInteractionStart: () => void
  /** Terminou: vale um único passo de Desfazer. */
  onInteractionEnd: () => void
}

export function GridCanvas({
  schema,
  tabId,
  values,
  context,
  selectedId,
  draggingType,
  onSelect,
  onLayoutsChange,
  onDropNew,
  onInteractionStart,
  onInteractionEnd
}: GridCanvasProps): React.JSX.Element {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 900 })
  const tab = schema.tabs.find((item) => item.id === tabId)

  const layout = useMemo<Layout>(
    () =>
      (tab?.components ?? []).map((component) => ({
        i: component.id,
        x: component.layout.x,
        y: component.layout.y,
        w: component.layout.w,
        h: component.layout.h
      })),
    [tab]
  )

  const droppingSize = draggingType === null ? { w: 3, h: 2 } : defaultSizeFor(draggingType)

  return (
    <div
      ref={containerRef}
      className="min-h-full"
      onMouseDown={(event) => {
        // Clique no vazio limpa a seleção.
        if (event.target === event.currentTarget) onSelect(null)
      }}
    >
      {mounted && tab !== undefined && (
        <GridLayout
          width={width}
          layout={layout}
          compactor={STAY_PUT}
          gridConfig={{
            cols: GRID_COLUMNS,
            rowHeight: GRID_ROW_HEIGHT,
            margin: [8, 8],
            containerPadding: [8, 8]
          }}
          resizeConfig={{ enabled: true, handles: ['se'] }}
          dropConfig={{ enabled: true, defaultItem: droppingSize }}
          onDragStart={onInteractionStart}
          onDragStop={onInteractionEnd}
          onResizeStart={onInteractionStart}
          onResizeStop={onInteractionEnd}
          onLayoutChange={(next: Layout) => {
            onLayoutsChange(
              next.map((item: LayoutItem) => ({
                id: item.i,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h
              }))
            )
          }}
          onDrop={(_layout: Layout, item: LayoutItem | undefined) => {
            if (item === undefined) return
            onDropNew({ x: item.x, y: item.y })
          }}
        >
          {tab.components.map((component) => (
            <div
              key={component.id}
              className={cn(
                // Mãozinha aberta: o clique seleciona e o arrasto move o componente.
                'group bg-card/60 relative cursor-grab overflow-hidden rounded-md border p-2 transition-colors',
                selectedId === component.id
                  ? 'border-primary ring-primary/40 ring-2'
                  : 'hover:border-muted-foreground/40'
              )}
              onMouseDown={() => onSelect(component.id)}
            >
              {/*
                Os campos aqui são só visuais: no construtor o clique seleciona e arrasta o
                componente, e quem quiser testar o preenchimento usa "Ver como jogador".
              */}
              <div className="pointer-events-none h-full">
                <ComponentView
                  component={component}
                  context={context}
                  values={values}
                  options={{ audience: 'gm', readOnly: true }}
                  showPermissions
                />
              </div>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  )
}

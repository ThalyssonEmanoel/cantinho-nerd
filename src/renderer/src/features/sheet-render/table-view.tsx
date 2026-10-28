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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Dices, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { FormulaContext } from '@/lib/formula'
import {
  createRowFormulaContext,
  formatCellValue,
  isTableValue,
  newId,
  readFormulaValue,
  safeNumber,
  type CellValue,
  type SheetComponent,
  type SheetValues,
  type TableColumn,
  type TableRowValue
} from '@/lib/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { canEdit, type SheetRenderOptions } from './types'

type TableComponent = Extract<SheetComponent, { type: 'table' }>

interface TableViewProps {
  component: TableComponent
  context: FormulaContext
  values: SheetValues
  options: SheetRenderOptions
}

const ROW_CLASS = 'hover:bg-muted/30 grid items-center gap-2 border-b px-2 py-1 last:border-b-0'

/**
 * Tabela da ficha (5.3): linhas fixas do mestre, linhas que o jogador adiciona, colunas
 * calculadas e botão de rolagem por linha.
 *
 * Só as linhas que o jogador criou podem ser removidas e reordenadas. As linhas fixas vêm
 * do modelo — apagar "Furtividade" da ficha seria editar o sistema, não a ficha — e as
 * fórmulas as encontram pela chave (`pericias.furtividade.total`), não pela posição.
 */
export function TableView({
  component,
  context,
  values,
  options
}: TableViewProps): React.JSX.Element {
  const raw = values[component.id]
  const rows = isTableValue(raw) ? raw : []
  const editable = canEdit(component, options)
  const reorderable = editable && component.playerCanAddRows && rows.length > 1

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function updateRow(index: number, cells: Record<string, CellValue>): void {
    const next = rows.map((row, position) =>
      position === index ? { ...row, cells: { ...row.cells, ...cells } } : row
    )
    options.onChange?.(component.id, next)
  }

  function addRow(): void {
    const cells: Record<string, CellValue> = {}
    for (const column of component.columns) {
      if (column.kind === 'computed' || column.kind === 'rollButton') continue
      cells[column.key] = column.kind === 'number' ? 0 : column.kind === 'checkbox' ? false : ''
    }
    options.onChange?.(component.id, [...rows, { id: newId('row'), cells }])
  }

  function removeRow(index: number): void {
    options.onChange?.(
      component.id,
      rows.filter((_row, position) => position !== index)
    )
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (over === null || active.id === over.id) return

    const from = rows.findIndex((row) => row.id === active.id)
    const to = rows.findIndex((row) => row.id === over.id)
    if (from === -1 || to === -1) return

    options.onChange?.(component.id, arrayMove(rows, from, to))
  }

  const gridTemplate = buildGridTemplate(component, reorderable)

  const body = rows.map((row, index) => {
    const props: RowProps = {
      row,
      index,
      component,
      context,
      options,
      editable,
      gridTemplate,
      onChangeCells: (cells) => updateRow(index, cells),
      onRemove: () => removeRow(index)
    }

    return reorderable ? (
      <SortableTableRow key={row.id} {...props} />
    ) : (
      <TableRow key={row.id} {...props} />
    )
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border">
      <div
        className="text-muted-foreground bg-muted/50 grid gap-2 border-b px-2 py-1.5 text-xs font-medium"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {reorderable && <span />}
        {component.showRowLabels && <span>Nome</span>}
        {component.columns.map((column) => (
          <span key={column.id} className="truncate" title={column.label}>
            {column.label}
          </span>
        ))}
        {component.playerCanAddRows && <span />}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 && (
          <p className="text-muted-foreground px-2 py-3 text-xs">Nenhuma linha.</p>
        )}

        {reorderable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.map((row) => row.id)}
              strategy={verticalListSortingStrategy}
            >
              {body}
            </SortableContext>
          </DndContext>
        ) : (
          body
        )}
      </div>

      {component.playerCanAddRows && (
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" disabled={!editable} onClick={addRow}>
            <Plus className="size-3.5" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}

function buildGridTemplate(component: TableComponent, reorderable: boolean): string {
  const columns = component.columns.map((column) =>
    column.width === undefined ? '1fr' : `${column.width}fr`
  )
  if (component.showRowLabels) columns.unshift('1.4fr')
  if (reorderable) columns.unshift('1.25rem')
  if (component.playerCanAddRows) columns.push('2rem')
  return columns.join(' ')
}

interface RowProps {
  row: TableRowValue
  index: number
  component: TableComponent
  context: FormulaContext
  options: SheetRenderOptions
  editable: boolean
  gridTemplate: string
  onChangeCells: (cells: Record<string, CellValue>) => void
  onRemove: () => void
}

function TableRow(props: RowProps): React.JSX.Element {
  return (
    <div className={ROW_CLASS} style={{ gridTemplateColumns: props.gridTemplate }}>
      <RowCells {...props} />
    </div>
  )
}

/** Mesma linha, arrastável pela alça (também funciona pelo teclado, via dnd-kit). */
function SortableTableRow(props: RowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.id
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(ROW_CLASS, isDragging && 'bg-accent/40 relative z-10')}
      style={{
        gridTemplateColumns: props.gridTemplate,
        // Só o eixo vertical se move, então não vale carregar o utilitário de matriz.
        transform: transform === null ? undefined : `translate3d(0, ${transform.y}px, 0)`,
        transition
      }}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
        aria-label="Reordenar linha"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <RowCells {...props} />
    </div>
  )
}

function RowCells({
  row,
  component,
  context,
  options,
  editable,
  onChangeCells,
  onRemove
}: RowProps): React.JSX.Element {
  const rowName = row.key ?? row.id
  const label = component.rows.find((item) => item.key === row.key)?.label ?? ''
  // Linha fixa do mestre não é removível; o espaço fica vazio para a grade não torcer.
  const removable = component.playerCanAddRows && row.key === undefined

  return (
    <>
      {component.showRowLabels && (
        <span className="truncate text-sm" title={label}>
          {label}
        </span>
      )}

      {component.columns.map((column) => (
        <CellView
          key={column.id}
          column={column}
          component={component}
          context={context}
          row={row}
          rowName={rowName}
          editable={editable}
          options={options}
          onChange={(value) => onChangeCells({ [column.key]: value })}
        />
      ))}

      {component.playerCanAddRows &&
        (removable ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!editable}
            onClick={onRemove}
            aria-label="Remover linha"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : (
          <span />
        ))}
    </>
  )
}

function rollLabel(
  component: TableComponent,
  row: TableRowValue,
  column: TableColumn
): string {
  const rowLabel = component.rows.find((item) => item.key === row.key)?.label
  if (rowLabel !== undefined && rowLabel !== '') return rowLabel
  return `${component.label}: ${column.label}`
}

interface CellViewProps {
  column: TableColumn
  component: TableComponent
  context: FormulaContext
  row: TableRowValue
  rowName: string
  editable: boolean
  options: SheetRenderOptions
  onChange: (value: CellValue) => void
}

function CellView({
  column,
  component,
  context,
  row,
  rowName,
  editable,
  options,
  onChange
}: CellViewProps): React.JSX.Element {
  const raw = row.cells[column.key]

  switch (column.kind) {
    case 'text':
      return (
        <Input
          className="h-7 text-sm"
          value={typeof raw === 'string' ? raw : ''}
          disabled={!editable}
          onChange={(event) => onChange(event.target.value)}
        />
      )

    case 'number':
      return (
        <Input
          className="h-7 text-sm"
          type="number"
          value={safeNumber(raw)}
          disabled={!editable}
          onChange={(event) => onChange(safeNumber(event.target.value))}
        />
      )

    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={raw === true}
          disabled={!editable}
          onChange={(event) => onChange(event.target.checked)}
        />
      )

    case 'select':
      return (
        <Select
          className="h-7 text-sm"
          value={typeof raw === 'string' ? raw : ''}
          disabled={!editable}
          onChange={(event) => onChange(event.target.value)}
        >
          {(column.options ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      )

    case 'computed': {
      const { value, error } = readFormulaValue(context, [component.key, rowName, column.key])
      return (
        <span
          className={cn('truncate text-sm', error !== undefined && 'text-destructive')}
          title={error?.message}
        >
          {error === undefined ? formatCellValue(value, column.format) : '#ERRO'}
        </span>
      )
    }

    case 'rollButton':
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          disabled={options.onRoll === undefined}
          onClick={() =>
            options.onRoll?.({
              // "Furtividade: 17" e não "Perícias: Rolar: 17": quando a linha tem rótulo,
              // ele é o nome da rolagem (5.7).
              label: rollLabel(component, row, column),
              formula: column.formula ?? '1d20',
              critical: column.critical ?? { kind: 'none' },
              criticalFailureOnOne: column.criticalFailureOnOne ?? false,
              context: createRowFormulaContext(context, component, rowName)
            })
          }
        >
          <Dices className="size-3.5" />
          {column.label}
        </Button>
      )
  }
}

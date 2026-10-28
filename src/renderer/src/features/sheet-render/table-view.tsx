import { Dices, Plus, Trash2 } from 'lucide-react'
import type { FormulaContext } from '@/lib/formula'
import {
  createRowFormulaContext,
  formatCellValue,
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

/**
 * Tabela da ficha (5.3): linhas fixas do mestre, linhas que o jogador adiciona, colunas
 * calculadas e botão de rolagem por linha.
 */
export function TableView({
  component,
  context,
  values,
  options
}: TableViewProps): React.JSX.Element {
  const rows = (values[component.id] ?? []) as TableRowValue[]
  const editable = canEdit(component, options)
  const rowsByName = component.rows

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

  const gridTemplate = buildGridTemplate(component)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border">
      <div
        className="text-muted-foreground bg-muted/50 grid gap-2 border-b px-2 py-1.5 text-xs font-medium"
        style={{ gridTemplateColumns: gridTemplate }}
      >
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

        {rows.map((row, index) => {
          const rowName = row.key ?? row.id
          const label = rowsByName.find((item) => item.key === row.key)?.label ?? ''

          return (
            <div
              key={row.id}
              className="hover:bg-muted/30 grid items-center gap-2 border-b px-2 py-1 last:border-b-0"
              style={{ gridTemplateColumns: gridTemplate }}
            >
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
                  onChange={(value) => updateRow(index, { [column.key]: value })}
                />
              ))}

              {component.playerCanAddRows && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={!editable}
                  onClick={() => removeRow(index)}
                  aria-label="Remover linha"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )
        })}
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

function buildGridTemplate(component: TableComponent): string {
  const columns = component.columns.map((column) =>
    column.width === undefined ? '1fr' : `${column.width}fr`
  )
  if (component.showRowLabels) columns.unshift('1.4fr')
  if (component.playerCanAddRows) columns.push('2rem')
  return columns.join(' ')
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
              label: `${component.label}: ${
                component.rows.find((item) => item.key === row.key)?.label ?? column.label
              }`,
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

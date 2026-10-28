import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  keyFromLabel,
  newId,
  type SheetComponent,
  type TableColumn,
  type TableColumnKind,
  type TableRowTemplate
} from '@/lib/sheet'
import { PropertyField, PropertyGroup } from './property-field'

type TableComponent = Extract<SheetComponent, { type: 'table' }>

const COLUMN_KINDS: { value: TableColumnKind; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'checkbox', label: 'Caixa' },
  { value: 'select', label: 'Lista' },
  { value: 'computed', label: 'Calculado' },
  { value: 'rollButton', label: 'Rolagem' }
]

interface TablePropertiesProps {
  component: TableComponent
  onChange: (change: Partial<TableComponent>) => void
}

/** Colunas e linhas fixas da tabela (5.3). */
export function TableProperties({ component, onChange }: TablePropertiesProps): React.JSX.Element {
  function updateColumn(index: number, change: Partial<TableColumn>): void {
    onChange({
      columns: component.columns.map((column, position) =>
        position === index ? { ...column, ...change } : column
      )
    })
  }

  function moveColumn(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= component.columns.length) return
    const columns = [...component.columns]
    const [moved] = columns.splice(index, 1)
    if (moved === undefined) return
    columns.splice(target, 0, moved)
    onChange({ columns })
  }

  function addColumn(): void {
    const label = `Coluna ${component.columns.length + 1}`
    onChange({
      columns: [
        ...component.columns,
        {
          id: newId('col'),
          key: keyFromLabel(
            label,
            component.columns.map((column) => column.key)
          ),
          label,
          kind: 'text'
        }
      ]
    })
  }

  function updateRow(index: number, change: Partial<TableRowTemplate>): void {
    onChange({
      rows: component.rows.map((row, position) =>
        position === index ? { ...row, ...change } : row
      )
    })
  }

  function moveRow(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= component.rows.length) return
    const rows = [...component.rows]
    const [moved] = rows.splice(index, 1)
    if (moved === undefined) return
    rows.splice(target, 0, moved)
    onChange({ rows })
  }

  function addRow(): void {
    const label = `Linha ${component.rows.length + 1}`
    onChange({
      rows: [
        ...component.rows,
        {
          id: newId('row'),
          key: keyFromLabel(
            label,
            component.rows.map((row) => row.key)
          ),
          label
        }
      ]
    })
  }

  return (
    <>
      <PropertyGroup title="Colunas">
        <div className="space-y-3">
          {component.columns.map((column, index) => (
            <div key={column.id} className="space-y-2 rounded-md border p-2">
              <div className="flex items-center gap-1">
                <Input
                  className="h-7 text-sm"
                  value={column.label}
                  placeholder="Rótulo"
                  onChange={(event) => updateColumn(index, { label: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                  aria-label="Subir coluna"
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={index === component.columns.length - 1}
                  onClick={() => moveColumn(index, 1)}
                  aria-label="Descer coluna"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() =>
                    onChange({
                      columns: component.columns.filter((_item, position) => position !== index)
                    })
                  }
                  aria-label="Excluir coluna"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="h-7 font-mono text-xs"
                  value={column.key}
                  placeholder="chave"
                  onChange={(event) => updateColumn(index, { key: event.target.value })}
                />
                <Select
                  className="h-7 text-xs"
                  value={column.kind}
                  onChange={(event) =>
                    updateColumn(index, { kind: event.target.value as TableColumnKind })
                  }
                >
                  {COLUMN_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              </div>

              {(column.kind === 'computed' || column.kind === 'rollButton') && (
                <Input
                  className="h-7 font-mono text-xs"
                  value={column.formula ?? ''}
                  placeholder={column.kind === 'computed' ? '=bonus + 1' : '1d20 + {total}'}
                  onChange={(event) => updateColumn(index, { formula: event.target.value })}
                />
              )}

              {column.kind === 'select' && (
                <Input
                  className="h-7 text-xs"
                  value={(column.options ?? []).map((option) => option.label).join(', ')}
                  placeholder="Opção 1, Opção 2"
                  onChange={(event) =>
                    updateColumn(index, {
                      options: event.target.value
                        .split(',')
                        .map((label) => label.trim())
                        .filter((label) => label !== '')
                        .map((label) => ({ id: newId('o'), label }))
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="size-3.5" />
          Nova coluna
        </Button>
      </PropertyGroup>

      <PropertyGroup title="Linhas fixas">
        <p className="text-muted-foreground text-xs">
          Use para perícias e listas que o mestre define. Deixe vazio quando o jogador é quem
          preenche, como no inventário.
        </p>

        <div className="space-y-2">
          {component.rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-1">
              <Input
                className="h-7 text-sm"
                value={row.label}
                onChange={(event) => {
                  const label = event.target.value
                  updateRow(index, { label })
                }}
              />
              <Input
                className="h-7 w-28 font-mono text-xs"
                value={row.key}
                onChange={(event) => updateRow(index, { key: event.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
                aria-label="Subir linha"
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={index === component.rows.length - 1}
                onClick={() => moveRow(index, 1)}
                aria-label="Descer linha"
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() =>
                  onChange({ rows: component.rows.filter((_item, position) => position !== index) })
                }
                aria-label="Excluir linha"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Nova linha
        </Button>
      </PropertyGroup>

      <PropertyGroup title="Comportamento">
        <PropertyField label="O jogador adiciona linhas">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={component.playerCanAddRows}
              onChange={(event) => onChange({ playerCanAddRows: event.target.checked })}
            />
            Permitir adicionar e remover
          </label>
        </PropertyField>

        <PropertyField label="Mostrar o nome das linhas">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={component.showRowLabels}
              onChange={(event) => onChange({ showRowLabels: event.target.checked })}
            />
            Primeira coluna com o rótulo
          </label>
        </PropertyField>
      </PropertyGroup>
    </>
  )
}

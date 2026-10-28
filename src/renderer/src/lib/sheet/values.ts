import type { SheetComponent, SheetSchema, TableColumn } from './types'
import { allComponents, isDecorative } from './types'

/**
 * Valores de uma ficha. Guardados pelo **id** do componente, nunca pela chave: renomear a
 * chave numa versão nova do modelo não pode perder o que o jogador já preencheu (5.2).
 */

export type CellValue = string | number | boolean

export interface ResourceValue {
  current: number
  /** Só preenchido quando o máximo é fixo; com fórmula, o máximo é calculado na hora. */
  max?: number
}

export interface TableRowValue {
  id: string
  /** Chave da linha fixa do mestre. Linhas do jogador não têm. */
  key?: string
  cells: Record<string, CellValue>
}

export type SheetValue = CellValue | ResourceValue | TableRowValue[]

export type SheetValues = Record<string, SheetValue>

export function isResourceValue(value: SheetValue | undefined): value is ResourceValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTableValue(value: SheetValue | undefined): value is TableRowValue[] {
  return Array.isArray(value)
}

function defaultCellValue(column: TableColumn): CellValue {
  switch (column.kind) {
    case 'number':
      return 0
    case 'checkbox':
      return false
    case 'select':
      return column.options?.[0]?.id ?? ''
    default:
      return ''
  }
}

/** Valor inicial de um componente, segundo as propriedades que o mestre configurou. */
export function defaultValueFor(component: SheetComponent): SheetValue | undefined {
  switch (component.type) {
    case 'text':
    case 'textarea':
    case 'image':
      return ''
    case 'number':
      return component.defaultValue ?? component.min ?? 0
    case 'checkbox':
      return component.defaultValue
    case 'select':
      return component.defaultOptionId ?? component.options[0]?.id ?? ''
    case 'attribute':
      return component.defaultValue ?? component.min ?? 0
    case 'resource': {
      const max = component.maxValue
      return max === undefined ? { current: 0 } : { current: max, max }
    }
    case 'markers':
      return 0
    case 'table':
      return component.rows.map((row) => ({
        id: row.id,
        key: row.key,
        cells: buildRowCells(component.columns, row.cells)
      }))
    default:
      // Título e campo calculado não guardam valor; o botão de rolagem também não.
      return undefined
  }
}

function buildRowCells(
  columns: readonly TableColumn[],
  preset: Record<string, CellValue> | undefined
): Record<string, CellValue> {
  const cells: Record<string, CellValue> = {}
  for (const column of columns) {
    // Coluna calculada e botão de rolagem não guardam valor.
    if (column.kind === 'computed' || column.kind === 'rollButton') continue
    cells[column.key] = preset?.[column.key] ?? defaultCellValue(column)
  }
  return cells
}

/** Ficha nova a partir do modelo. */
export function createDefaultValues(schema: SheetSchema): SheetValues {
  const values: SheetValues = {}
  for (const component of allComponents(schema)) {
    if (isDecorative(component)) continue
    const value = defaultValueFor(component)
    if (value !== undefined) values[component.id] = value
  }
  return values
}

/**
 * Valores de teste para o "Visualizar como jogador" (5.2): como os padrões, mas com um
 * texto de exemplo e uma linha de exemplo nas tabelas que o jogador preenche, para a
 * pré-visualização não ficar vazia.
 */
export function createSampleValues(schema: SheetSchema): SheetValues {
  const values = createDefaultValues(schema)

  for (const component of allComponents(schema)) {
    if (component.type === 'text' && values[component.id] === '') {
      values[component.id] = component.placeholder ?? 'Exemplo'
    }

    if (component.type === 'table' && component.playerCanAddRows) {
      const rows = values[component.id]
      if (isTableValue(rows) && rows.length === 0) {
        values[component.id] = [
          { id: 'exemplo', cells: buildRowCells(component.columns, undefined) }
        ]
      }
    }
  }

  return values
}

/**
 * Migração entre versões do modelo (5.7): componente novo recebe o padrão e o valor de
 * componente que saiu fica guardado, escondido, em vez de ser apagado.
 */
export interface MigrationResult {
  values: SheetValues
  /** Ids que não existem mais no modelo, mantidos para não perder dado do jogador. */
  orphanedIds: string[]
  /** Ids que ganharam valor padrão agora. */
  addedIds: string[]
}

export function migrateValues(schema: SheetSchema, previous: SheetValues): MigrationResult {
  const values: SheetValues = { ...previous }
  const addedIds: string[] = []
  const liveIds = new Set<string>()

  for (const component of allComponents(schema)) {
    if (isDecorative(component)) continue
    liveIds.add(component.id)

    if (!(component.id in values)) {
      const value = defaultValueFor(component)
      if (value !== undefined) {
        values[component.id] = value
        addedIds.push(component.id)
      }
      continue
    }

    if (component.type === 'table') {
      // Coluna nova numa tabela que já tem linhas: cada linha recebe o padrão dela.
      const rows = values[component.id]
      if (isTableValue(rows)) {
        values[component.id] = rows.map((row) => ({
          ...row,
          cells: { ...buildRowCells(component.columns, undefined), ...row.cells }
        }))
      }
    }
  }

  const orphanedIds = Object.keys(values).filter((id) => !liveIds.has(id))
  return { values, orphanedIds, addedIds }
}

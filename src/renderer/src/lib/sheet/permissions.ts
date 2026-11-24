import {
  findComponentById,
  isDecorative,
  type SheetComponent,
  type SheetSchema,
  type TableColumn
} from './types'
import type { CellValue, SheetValue } from './values'

type TableComponent = Extract<SheetComponent, { type: 'table' }>

/**
 * Quem vê e quem edita cada campo da ficha (seções 5.3 e 5.7).
 *
 * Fica fora dos componentes de propósito: na Fase 5 a mesma regra passa a valer no banco
 * (RLS e RPC de patch), e este arquivo é onde ela está escrita e testada de uma vez.
 */

/** Quem está olhando a ficha. */
export type SheetAudience = 'gm' | 'player'

/** Campo que o jogador nem recebe: vive na tabela separada do mestre (5.7). */
export function isGmOnly(component: SheetComponent): boolean {
  return component.visibleTo === 'gm'
}

export function canSeeComponent(component: SheetComponent, audience: SheetAudience): boolean {
  return audience === 'gm' || !isGmOnly(component)
}

export function canEditComponent(component: SheetComponent, audience: SheetAudience): boolean {
  // Não dá para editar o que não se vê: o jogador nem recebe o valor do campo do mestre.
  if (!canSeeComponent(component, audience)) return false
  return audience === 'gm' || component.editableBy === 'player'
}

/** Componentes que não guardam valor próprio e portanto não são graváveis. */
export function holdsValue(component: SheetComponent): boolean {
  if (isDecorative(component)) return false
  return component.type !== 'computed' && component.type !== 'rollButton'
}

/**
 * Este campo pode ser gravado por quem está pedindo?
 *
 * É a mesma pergunta que o RPC de patch fará no servidor. O repositório local chama esta
 * função para recusar do mesmo jeito, então a tela já aprende a lidar com a recusa agora.
 */
export function canPatchField(
  schema: SheetSchema,
  componentId: string,
  audience: SheetAudience
): boolean {
  const component = findComponentById(schema, componentId)
  if (component === undefined) return false
  if (!holdsValue(component)) return false
  return canEditComponent(component, audience)
}

// ---------------------------------------------------------------------------
// Coluna de tabela travada para o jogador (`editableBy: 'gm'` na coluna)
// ---------------------------------------------------------------------------

const VALUE_COLUMN_KINDS: readonly TableColumn['kind'][] = ['text', 'number', 'checkbox', 'select']

/** Coluna que só o mestre muda, mesmo numa tabela que o jogador edita. */
export function isLockedColumn(column: TableColumn): boolean {
  return column.editableBy === 'gm' && VALUE_COLUMN_KINDS.includes(column.kind)
}

/** A célula desta coluna pode ser editada por quem está olhando? (a tabela já é editável) */
export function canEditColumn(column: TableColumn, audience: SheetAudience): boolean {
  return audience === 'gm' || !isLockedColumn(column)
}

function defaultCell(column: TableColumn): CellValue {
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

/**
 * Valores que uma célula travada pode ter numa linha que o jogador acabou de adicionar: ele
 * cria a linha, mas quem preenche a coluna do mestre é o mestre. Aceita os dois jeitos de
 * nascer vazia (o padrão do modelo e o `''` que o botão "Adicionar" põe na lista).
 */
function isBlankCell(column: TableColumn, value: CellValue | undefined): boolean {
  return value === undefined || value === '' || value === 0 || value === false || value === defaultCell(column)
}

function rowsOf(value: SheetValue | undefined): { id: string; cells: Record<string, CellValue> }[] {
  return Array.isArray(value) ? value : []
}

/**
 * Colunas travadas que o patch mudou. É a mesma conta que o `patch_sheet` faz no banco
 * (migração 20261124120000): a tela já impede a edição, isto é a garantia.
 *
 * - linha que já existia: a célula travada tem de ficar igual (célula que falta vale o padrão,
 *   para uma coluna nova no modelo não parecer mudança);
 * - linha nova: a célula travada só pode nascer vazia;
 * - linha removida: não conta (remover linha é da tabela, não da coluna).
 */
export function changedLockedColumns(
  table: TableComponent,
  previous: SheetValue | undefined,
  next: SheetValue | undefined
): string[] {
  const locked = table.columns.filter(isLockedColumn)
  if (locked.length === 0) return []

  const before = new Map(rowsOf(previous).map((row) => [row.id, row]))
  const changed = new Set<string>()

  for (const row of rowsOf(next)) {
    const old = before.get(row.id)
    for (const column of locked) {
      const value = row.cells[column.key]
      if (old === undefined) {
        if (!isBlankCell(column, value)) changed.add(column.key)
        continue
      }
      const fallback = defaultCell(column)
      if ((value ?? fallback) !== (old.cells[column.key] ?? fallback)) changed.add(column.key)
    }
  }

  return [...changed]
}

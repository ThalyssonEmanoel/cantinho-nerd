import { keyFromLabel, uniqueKey } from './keys'
import {
  COMPONENT_LABELS,
  type ComponentType,
  type GridPosition,
  type SheetComponent,
  type SheetSchema,
  type SheetTab,
  type SheetTemplate,
  type TemplateKind
} from './types'
import { allComponents } from './types'

/** Criação de ids, componentes, abas e modelos novos. */

export function newId(prefix: string): string {
  // Id curto e legível no JSON exportado; o uuid completo só polui o arquivo.
  const random = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `${prefix}_${random}`
}

/** Tamanho inicial de cada tipo na grade de 12 colunas. */
const DEFAULT_LAYOUT: Record<ComponentType, { w: number; h: number }> = {
  text: { w: 4, h: 2 },
  textarea: { w: 6, h: 4 },
  number: { w: 2, h: 2 },
  checkbox: { w: 3, h: 2 },
  select: { w: 4, h: 2 },
  image: { w: 2, h: 5 },
  heading: { w: 12, h: 1 },
  attribute: { w: 2, h: 3 },
  resource: { w: 4, h: 2 },
  markers: { w: 4, h: 2 },
  computed: { w: 3, h: 2 },
  rollButton: { w: 3, h: 2 },
  table: { w: 12, h: 7 }
}

export function defaultSizeFor(type: ComponentType): { w: number; h: number } {
  return DEFAULT_LAYOUT[type]
}

export interface CreateComponentOptions {
  /** Chaves já usadas no modelo, para a nova não repetir. */
  takenKeys: Iterable<string>
  /** Posição onde o componente foi solto. */
  position?: { x: number; y: number }
  label?: string
}

export function createComponent(
  type: ComponentType,
  options: CreateComponentOptions
): SheetComponent {
  const label = options.label ?? COMPONENT_LABELS[type]
  const size = DEFAULT_LAYOUT[type]
  const layout: GridPosition = {
    x: options.position?.x ?? 0,
    y: options.position?.y ?? 0,
    w: size.w,
    h: size.h
  }

  const base = {
    id: newId('c'),
    key: keyFromLabel(label, options.takenKeys),
    label,
    editableBy: 'player' as const,
    visibleTo: 'all' as const,
    layout
  }

  switch (type) {
    case 'text':
      return { ...base, type }
    case 'textarea':
      return { ...base, type }
    case 'number':
      return { ...base, type, defaultValue: 0 }
    case 'checkbox':
      return { ...base, type, defaultValue: false }
    case 'select':
      return {
        ...base,
        type,
        options: [
          { id: newId('o'), label: 'Opção 1' },
          { id: newId('o'), label: 'Opção 2' }
        ]
      }
    case 'image':
      return { ...base, type, shape: 'circle' }
    case 'heading':
      return { ...base, type, text: 'Seção', level: 'section' }
    case 'attribute':
      return { ...base, type, defaultValue: 10, min: 0, modifierFormula: 'piso((valor - 10) / 2)' }
    case 'resource':
      return { ...base, type, maxValue: 10, showButtons: true }
    case 'markers':
      return { ...base, type, count: 3 }
    case 'computed':
      return { ...base, type, formula: '=0', format: 'integer' }
    case 'rollButton':
      return {
        ...base,
        type,
        formula: '1d20',
        critical: { kind: 'none' },
        criticalFailureOnOne: false
      }
    case 'table':
      return {
        ...base,
        type,
        columns: [
          { id: newId('col'), key: 'item', label: 'Item', kind: 'text' },
          { id: newId('col'), key: 'quantidade', label: 'Qtd.', kind: 'number', width: 20 }
        ],
        rows: [],
        playerCanAddRows: true,
        showRowLabels: false
      }
  }
}

/** Cópia de um componente, com id e chave novos (o resto igual). */
export function duplicateComponent(
  component: SheetComponent,
  takenKeys: Iterable<string>
): SheetComponent {
  const copy = structuredClone(component)
  copy.id = newId('c')
  copy.key = uniqueKey(component.key, takenKeys)
  // Papel é único por modelo (5.6): a cópia não pode levar o papel do original.
  delete copy.role
  copy.layout = { ...component.layout, y: component.layout.y + component.layout.h }

  if (copy.type === 'table') {
    copy.columns = copy.columns.map((column) => ({ ...column, id: newId('col') }))
    copy.rows = copy.rows.map((row) => ({ ...row, id: newId('row') }))
  }
  if (copy.type === 'select') {
    copy.options = copy.options.map((option) => ({ ...option, id: newId('o') }))
  }

  return copy
}

export function createTab(label: string): SheetTab {
  return { id: newId('tab'), label, components: [] }
}

export function createEmptySchema(): SheetSchema {
  return { formatVersion: 1, tabs: [createTab('Geral')] }
}

export function createTemplate(input: {
  name: string
  kind: TemplateKind
  schema?: SheetSchema
}): SheetTemplate {
  const now = new Date().toISOString()
  return {
    id: newId('tpl'),
    name: input.name,
    kind: input.kind,
    draftSchema: input.schema ?? createEmptySchema(),
    versions: [],
    createdAt: now,
    updatedAt: now
  }
}

/** Todas as chaves em uso num modelo — o que `createComponent` precisa para não repetir. */
export function takenKeysOf(schema: SheetSchema): string[] {
  return allComponents(schema).map((component) => component.key)
}

/**
 * Primeira linha livre abaixo de tudo numa aba. Usado quando o componente é adicionado por
 * clique na paleta, sem arrastar: ele entra no fim, sem cobrir ninguém.
 */
export function nextFreeRow(tab: SheetTab): number {
  return tab.components.reduce(
    (bottom, component) => Math.max(bottom, component.layout.y + component.layout.h),
    0
  )
}

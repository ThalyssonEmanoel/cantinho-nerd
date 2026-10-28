import type { CriticalRule } from '../dice'

/**
 * Modelo de ficha (seções 5.1 a 5.6 da especificação).
 *
 * O app não conhece as regras de nenhum sistema: um modelo é só uma grade de componentes
 * com fórmulas. Tudo que é específico de Ordem Paranormal, D&D ou do sistema caseiro do
 * mestre vem daqui.
 */

export const GRID_COLUMNS = 12

/** Altura de uma linha da grade, em pixels. Usada pela grade e pelo preenchimento. */
export const GRID_ROW_HEIGHT = 36

export type ComponentType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'image'
  | 'heading'
  | 'attribute'
  | 'resource'
  | 'markers'
  | 'computed'
  | 'rollButton'
  | 'table'

/** Quem edita o campo. */
export type EditPermission = 'player' | 'gm'

/** Quem vê o campo. */
export type ViewPermission = 'all' | 'gm'

/**
 * Papéis que ligam a ficha à mesa (seção 5.6). No máximo um componente por papel.
 * Sem eles o app não teria como saber o que é "Vida" ou "Defesa" numa ficha dinâmica.
 */
export type ComponentRole =
  'name' | 'portrait' | 'hp' | 'bar2' | 'bar3' | 'initiative' | 'defense' | 'vision'

export interface GridPosition {
  x: number
  y: number
  w: number
  h: number
}

export interface ComponentBase {
  /** Imutável: é por ele que os valores da ficha são salvos, não pela chave. */
  id: string
  /** Nome curto usado nas fórmulas (`Força` → `forca`). Única no modelo e editável. */
  key: string
  label: string
  hint?: string
  editableBy: EditPermission
  visibleTo: ViewPermission
  /** Fórmula opcional: mostra o componente só quando ela for verdadeira. */
  visibleWhen?: string
  role?: ComponentRole
  /** Cor de destaque (token do tema ou hex). */
  accent?: string
  layout: GridPosition
}

export type NumberFormat = 'integer' | 'signed' | 'decimal'

export interface SelectOption {
  id: string
  label: string
  /** Valor numérico opcional: quando existe, é o que a fórmula recebe. */
  value?: number
}

export interface TextComponent extends ComponentBase {
  type: 'text'
  placeholder?: string
  maxLength?: number
}

export interface TextareaComponent extends ComponentBase {
  type: 'textarea'
  placeholder?: string
  maxLength?: number
}

export interface NumberComponent extends ComponentBase {
  type: 'number'
  min?: number
  max?: number
  step?: number
  defaultValue?: number
}

export interface CheckboxComponent extends ComponentBase {
  type: 'checkbox'
  defaultValue: boolean
}

export interface SelectComponent extends ComponentBase {
  type: 'select'
  options: SelectOption[]
  /** Id da opção padrão. */
  defaultOptionId?: string
}

export interface ImageComponent extends ComponentBase {
  type: 'image'
  shape: 'circle' | 'rect'
}

export interface HeadingComponent extends ComponentBase {
  type: 'heading'
  text: string
  level: 'title' | 'section'
}

export interface AttributeComponent extends ComponentBase {
  type: 'attribute'
  min?: number
  max?: number
  defaultValue?: number
  /** Fórmula do modificador, usando `valor` (ex.: `piso((valor - 10) / 2)`). */
  modifierFormula?: string
}

export interface ResourceComponent extends ComponentBase {
  type: 'resource'
  /** Máximo fixo. Ignorado quando há `maxFormula`. */
  maxValue?: number
  /** Máximo por fórmula (ex.: `10 + constituicao.mod * nivel`). */
  maxFormula?: string
  color?: string
  showButtons: boolean
}

export interface MarkersComponent extends ComponentBase {
  type: 'markers'
  /** Quantidade fixa de bolinhas. Ignorada quando há `countFormula`. */
  count?: number
  countFormula?: string
}

export interface ComputedComponent extends ComponentBase {
  type: 'computed'
  formula: string
  format: NumberFormat
}

export interface RollButtonComponent extends ComponentBase {
  type: 'rollButton'
  /** Notação com `{…}`, ex.: `1d20 + {forca.mod}`. */
  formula: string
  critical: CriticalRule
  criticalFailureOnOne: boolean
}

export type TableColumnKind = 'text' | 'number' | 'checkbox' | 'select' | 'computed' | 'rollButton'

export interface TableColumn {
  id: string
  /** Nome usado nas fórmulas da própria linha e em `tabela.linha.coluna`. */
  key: string
  label: string
  kind: TableColumnKind
  /** Peso da coluna na largura da tabela. */
  width?: number
  options?: SelectOption[]
  /** Para `computed` e `rollButton`. */
  formula?: string
  format?: NumberFormat
  critical?: CriticalRule
  criticalFailureOnOne?: boolean
}

export interface TableRowTemplate {
  id: string
  /** Chave da linha, para `pericias.furtividade.total`. */
  key: string
  label: string
  /** Valores que o mestre já deixa preenchidos, por chave de coluna. */
  cells?: Record<string, string | number | boolean>
}

export interface TableComponent extends ComponentBase {
  type: 'table'
  columns: TableColumn[]
  /** Linhas fixas definidas pelo mestre (perícias, por exemplo). */
  rows: TableRowTemplate[]
  /** Quando ligado, o jogador adiciona e remove linhas (inventário, por exemplo). */
  playerCanAddRows: boolean
  /** Mostra a coluna de rótulo das linhas fixas. */
  showRowLabels: boolean
}

export type SheetComponent =
  | TextComponent
  | TextareaComponent
  | NumberComponent
  | CheckboxComponent
  | SelectComponent
  | ImageComponent
  | HeadingComponent
  | AttributeComponent
  | ResourceComponent
  | MarkersComponent
  | ComputedComponent
  | RollButtonComponent
  | TableComponent

export interface SheetTab {
  id: string
  label: string
  components: SheetComponent[]
}

export interface SheetSchema {
  /** Versão do formato, para migrar modelos antigos quando o app mudar. */
  formatVersion: 1
  tabs: SheetTab[]
}

export type TemplateKind = 'character' | 'creature'

export interface SheetTemplateVersion {
  version: number
  schema: SheetSchema
  publishedAt: string
}

export interface SheetTemplate {
  id: string
  name: string
  kind: TemplateKind
  /** O que o mestre está editando. */
  draftSchema: SheetSchema
  /** Versões publicadas, imutáveis. Os jogadores usam sempre a última. */
  versions: SheetTemplateVersion[]
  createdAt: string
  updatedAt: string
}

/** O que a lista da biblioteca precisa, sem carregar o esquema inteiro. */
export interface SheetTemplateSummary {
  id: string
  name: string
  kind: TemplateKind
  publishedVersion: number | null
  componentCount: number
  updatedAt: string
}

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  checkbox: 'Caixa de seleção',
  select: 'Lista de opções',
  image: 'Imagem',
  heading: 'Título / seção',
  attribute: 'Atributo',
  resource: 'Barra de recurso',
  markers: 'Marcadores',
  computed: 'Campo calculado',
  rollButton: 'Botão de rolagem',
  table: 'Tabela / lista'
}

export const ROLE_LABELS: Record<ComponentRole, string> = {
  name: 'Nome do personagem',
  portrait: 'Retrato',
  hp: 'Vida (barra principal)',
  bar2: 'Barra extra 2',
  bar3: 'Barra extra 3',
  initiative: 'Iniciativa',
  defense: 'Defesa',
  vision: 'Visão (metros)'
}

/**
 * Qual tipo de componente pode assumir cada papel (seção 5.6). A validação usa isto para
 * impedir, por exemplo, marcar um texto como barra de vida.
 */
export const ROLE_ALLOWED_TYPES: Record<ComponentRole, readonly ComponentType[]> = {
  name: ['text'],
  portrait: ['image'],
  hp: ['resource'],
  bar2: ['resource'],
  bar3: ['resource'],
  initiative: ['rollButton', 'number', 'computed'],
  defense: ['number', 'computed', 'attribute'],
  vision: ['number', 'computed']
}

/** Componentes sem valor próprio: não guardam nada na ficha e não entram em fórmulas. */
export const DECORATIVE_TYPES: readonly ComponentType[] = ['heading']

export function isDecorative(component: SheetComponent): boolean {
  return DECORATIVE_TYPES.includes(component.type)
}

/** Todos os componentes de todas as abas, na ordem das abas. */
export function allComponents(schema: SheetSchema): SheetComponent[] {
  return schema.tabs.flatMap((tab) => tab.components)
}

export function findComponentByKey(schema: SheetSchema, key: string): SheetComponent | undefined {
  return allComponents(schema).find((component) => component.key === key)
}

export function findComponentById(schema: SheetSchema, id: string): SheetComponent | undefined {
  return allComponents(schema).find((component) => component.id === id)
}

export function publishedVersionOf(template: SheetTemplate): SheetTemplateVersion | null {
  return template.versions.at(-1) ?? null
}

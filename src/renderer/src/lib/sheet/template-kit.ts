import { slugifyKey } from './keys'
import type { CriticalRule } from '../dice'
import type {
  AttributeComponent,
  CheckboxComponent,
  ComponentBase,
  ComponentRole,
  ComputedComponent,
  EditPermission,
  FigureComponent,
  GridPosition,
  HeadingComponent,
  ImageComponent,
  MarkersComponent,
  NumberComponent,
  NumberFormat,
  ResourceComponent,
  RollButtonComponent,
  SelectComponent,
  SelectOption,
  TableColumn,
  TableColumnKind,
  TableComponent,
  TableRowTemplate,
  TextareaComponent,
  TextComponent,
  ViewPermission
} from './types'

/**
 * Peças para escrever um modelo de ficha em código, em vez de arrastar no construtor.
 *
 * É como vivem as fichas prontas de `docs/fichas/`: o gerador monta o modelo com estas peças e
 * o teste ao lado grava o `.json` que o mestre importa na biblioteca. O app não usa nada disto.
 */

// ---------------------------------------------------------------------------
// Fórmulas
// ---------------------------------------------------------------------------

/** Texto entre aspas para a fórmula. A linguagem não tem como escapar aspas dentro dele. */
export function q(text: string): string {
  if (text.includes('"')) throw new Error(`Texto de fórmula com aspas: ${text}`)
  return `"${text}"`
}

export type Branch = readonly [condition: string, value: string]

/** `se(a, x, se(b, y, z))`: o primeiro ramo verdadeiro ganha. */
export function choose(branches: readonly Branch[], fallback: string): string {
  return branches.reduceRight<string>(
    (rest, [condition, value]) => `se(${condition}, ${value}, ${rest})`,
    fallback
  )
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

export interface Options {
  hint?: string
  editableBy?: EditPermission
  visibleTo?: ViewPermission
  when?: string
  role?: ComponentRole
  accent?: string
}

export function at(x: number, y: number, w: number, h: number): GridPosition {
  return { x, y, w, h }
}

function base(key: string, label: string, layout: GridPosition, options: Options): ComponentBase {
  const component: ComponentBase = {
    id: `c_${key}`,
    key,
    label,
    editableBy: options.editableBy ?? 'player',
    visibleTo: options.visibleTo ?? 'all',
    layout
  }
  if (options.hint !== undefined) component.hint = options.hint
  if (options.when !== undefined) component.visibleWhen = options.when
  if (options.role !== undefined) component.role = options.role
  if (options.accent !== undefined) component.accent = options.accent
  return component
}

export type OptionSpec = string | readonly [label: string, value: number]

export function selectOptions(specs: readonly OptionSpec[]): SelectOption[] {
  return specs.map((spec) => {
    const [label, value] = typeof spec === 'string' ? [spec, undefined] : spec
    const option: SelectOption = { id: `o_${slugifyKey(label)}`, label }
    if (value !== undefined) option.value = value
    return option
  })
}

/** Id da opção a partir do rótulo: é o que uma linha fixa de tabela guarda na célula. */
export function optionId(label: string): string {
  return `o_${slugifyKey(label)}`
}

export function heading(
  key: string,
  text: string,
  layout: GridPosition,
  options: Options = {}
): HeadingComponent {
  return {
    ...base(key, text, layout, { editableBy: 'gm', ...options }),
    type: 'heading',
    text,
    level: 'section'
  }
}

/** Texto corrido do modelo: a regra que fica à vista e que o jogador não edita. */
export function paragraph(
  key: string,
  label: string,
  text: string,
  layout: GridPosition,
  options: Options = {}
): HeadingComponent {
  return {
    ...base(key, label, layout, { editableBy: 'gm', ...options }),
    type: 'heading',
    text,
    level: 'paragraph'
  }
}

export interface TextOptions extends Options {
  defaultValue?: string
}

function withTextOptions<T extends TextComponent | TextareaComponent>(
  component: T,
  placeholder: string | undefined,
  options: TextOptions
): T {
  if (placeholder !== undefined) component.placeholder = placeholder
  if (options.defaultValue !== undefined) component.defaultValue = options.defaultValue
  return component
}

export function text(
  key: string,
  label: string,
  layout: GridPosition,
  placeholder?: string,
  options: TextOptions = {}
): TextComponent {
  return withTextOptions(
    { ...base(key, label, layout, options), type: 'text' },
    placeholder,
    options
  )
}

export function textarea(
  key: string,
  label: string,
  layout: GridPosition,
  placeholder?: string,
  options: TextOptions = {}
): TextareaComponent {
  return withTextOptions(
    { ...base(key, label, layout, options), type: 'textarea' },
    placeholder,
    options
  )
}

export function number(
  key: string,
  label: string,
  layout: GridPosition,
  limits: { min?: number; max?: number; defaultValue: number },
  options: Options = {}
): NumberComponent {
  return { ...base(key, label, layout, options), type: 'number', ...limits }
}

export function checkbox(
  key: string,
  label: string,
  layout: GridPosition,
  options: Options = {}
): CheckboxComponent {
  return { ...base(key, label, layout, options), type: 'checkbox', defaultValue: false }
}

export interface SelectFieldOptions extends Options {
  /** Rótulo da opção que já vem escolhida. Sem isto, é a primeira da lista. */
  defaultLabel?: string
}

export function select(
  key: string,
  label: string,
  layout: GridPosition,
  specs: readonly OptionSpec[],
  options: SelectFieldOptions = {}
): SelectComponent {
  const component: SelectComponent = {
    ...base(key, label, layout, options),
    type: 'select',
    options: selectOptions(specs)
  }
  if (options.defaultLabel !== undefined) {
    component.defaultOptionId = optionId(options.defaultLabel)
  }
  return component
}

export function image(
  key: string,
  label: string,
  layout: GridPosition,
  options: Options & { shape?: 'circle' | 'rect' }
): ImageComponent {
  return { ...base(key, label, layout, options), type: 'image', shape: options.shape ?? 'circle' }
}

/** Imagem que a ficha só mostra: embutida no modelo (`src`) ou repetida (`sourceFormula`). */
export function figure(
  key: string,
  label: string,
  layout: GridPosition,
  source: { src?: string; sourceFormula?: string; fit: 'contain' | 'cover' },
  options: Options = {}
): FigureComponent {
  return {
    ...base(key, label, layout, { editableBy: 'gm', ...options }),
    type: 'figure',
    ...source
  }
}

export function attribute(
  key: string,
  label: string,
  layout: GridPosition,
  fields: { min?: number; max?: number; defaultValue: number; modifierFormula: string },
  options: Options = {}
): AttributeComponent {
  return { ...base(key, label, layout, options), type: 'attribute', ...fields }
}

export function resource(
  key: string,
  label: string,
  layout: GridPosition,
  maxFormula: string,
  color: string,
  options: Options & { followsMax?: boolean }
): ResourceComponent {
  const component: ResourceComponent = {
    ...base(key, label, layout, options),
    type: 'resource',
    maxFormula,
    color,
    showButtons: true
  }
  if (options.followsMax === true) component.followsMax = true
  return component
}

export function markers(
  key: string,
  label: string,
  layout: GridPosition,
  count: number,
  options: Options
): MarkersComponent {
  return { ...base(key, label, layout, options), type: 'markers', count }
}

export function computed(
  key: string,
  label: string,
  layout: GridPosition,
  formula: string,
  options: Options = {},
  format: NumberFormat = 'integer'
): ComputedComponent {
  return {
    ...base(key, label, layout, { editableBy: 'gm', ...options }),
    type: 'computed',
    formula,
    format
  }
}

export interface RollOptions extends Options {
  /** Sem isto, nenhum crítico: marcar 20 natural faria parecer que a regra existe. */
  critical?: CriticalRule
  criticalFailureOnOne?: boolean
}

export function roll(
  key: string,
  label: string,
  layout: GridPosition,
  formula: string,
  options: RollOptions = {}
): RollButtonComponent {
  return {
    ...base(key, label, layout, options),
    type: 'rollButton',
    formula,
    critical: options.critical ?? { kind: 'none' },
    criticalFailureOnOne: options.criticalFailureOnOne ?? false
  }
}

export function table(
  key: string,
  label: string,
  layout: GridPosition,
  columns: TableColumn[],
  rows: TableRowTemplate[],
  shape: { playerCanAddRows: boolean; showRowLabels: boolean },
  options: Options = {}
): TableComponent {
  return { ...base(key, label, layout, options), type: 'table', columns, rows, ...shape }
}

export function column(
  key: string,
  label: string,
  kind: TableColumnKind,
  width: number,
  extra: Partial<TableColumn> = {}
): TableColumn {
  return { id: `col_${key}`, key, label, kind, width, ...extra }
}

/**
 * Coluna calculada de largura zero: na tabela ela some (o texto dela é cortado em nada), e
 * serve para os contadores somarem com `soma(tabela.coluna)`. A linguagem não tem soma
 * condicional, então "quantas de nível 2 estão marcadas" precisa de uma coluna de 0 e 1.
 */
export function hiddenColumn(key: string, formula: string): TableColumn {
  return column(key, `${key} (oculta)`, 'computed', 0, { formula })
}

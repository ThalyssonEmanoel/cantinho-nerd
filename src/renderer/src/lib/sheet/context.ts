import {
  evaluateFormula,
  FormulaException,
  toNumber,
  withValues,
  type FormulaContext,
  type FormulaError,
  type FormulaValue
} from '../formula'
import {
  allComponents,
  isDecorative,
  type ComponentRole,
  type SheetComponent,
  type SheetSchema,
  type TableColumn
} from './types'
import {
  createDefaultValues,
  createSampleValues,
  isResourceValue,
  isTableValue,
  type SheetValue,
  type SheetValues,
  type TableRowValue
} from './values'

/**
 * Transforma uma ficha (modelo + valores) num contexto de fórmulas.
 *
 * É a peça que liga as duas metades do app: o motor de fórmulas da Fase 1 só sabe pedir
 * `resolve(['forca','mod'])`, e é aqui que isso vira "pega o atributo força e roda a
 * fórmula do modificador dele".
 *
 * Tudo é calculado sob demanda e memorizado. Um campo que se refere a si mesmo (direta ou
 * indiretamente) vira erro de dependência circular em vez de travar o app.
 */

export interface SheetContextResult {
  context: FormulaContext
  /** Erros que apareceram ao calcular campos derivados, por caminho (`vida.max`). */
  errors: Map<string, FormulaError>
}

export function createSheetContext(schema: SheetSchema, values: SheetValues): SheetContextResult {
  const byKey = new Map<string, SheetComponent>()
  for (const component of allComponents(schema)) {
    if (!isDecorative(component)) byKey.set(component.key, component)
  }

  const cache = new Map<string, FormulaValue | undefined>()
  const resolving = new Set<string>()
  const errors = new Map<string, FormulaError>()

  /** Roda uma fórmula derivada, repassando o erro para quem dependia dela. */
  function evaluateDerived(
    path: string,
    formula: string,
    context: FormulaContext
  ): FormulaValue | undefined {
    const result = evaluateFormula(formula, context)
    if (result.ok) return result.value

    errors.set(path, result.error)
    // Quem dependia deste campo precisa saber o motivo de verdade, e não só
    // "campo não existe" — então repassamos o erro para cima.
    throw new FormulaException({
      ...result.error,
      message: `"${path}": ${result.error.message}`
    })
  }

  function resolve(path: readonly string[]): FormulaValue | undefined {
    const cacheKey = path.join('.')
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    if (resolving.has(cacheKey)) {
      throw new FormulaException({
        code: 'cycle',
        message: `Dependência circular em "${cacheKey}".`
      })
    }

    resolving.add(cacheKey)
    try {
      const value = compute(path)
      cache.set(cacheKey, value)
      return value
    } finally {
      resolving.delete(cacheKey)
    }
  }

  function compute(path: readonly string[]): FormulaValue | undefined {
    const [head, ...rest] = path
    if (head === undefined) return undefined

    const component = byKey.get(head)
    if (component === undefined) return undefined

    if (component.type === 'table') return computeTablePath(component, rest)
    if (rest.length === 0) return ownValue(component)
    if (rest.length !== 1) return undefined

    const [segment] = rest
    if (component.type === 'attribute' && segment === 'mod') {
      return attributeModifier(component)
    }
    if (component.type === 'resource' && segment === 'max') {
      return resourceMax(component)
    }

    return undefined
  }

  /** Valor próprio do componente, do jeito que a fórmula espera recebê-lo. */
  function ownValue(component: SheetComponent): FormulaValue | undefined {
    const raw = values[component.id]

    switch (component.type) {
      case 'text':
      case 'textarea':
      case 'image':
        return typeof raw === 'string' ? raw : ''
      case 'number':
      case 'markers':
      case 'attribute':
        return typeof raw === 'number' ? raw : toNumberOrZero(raw)
      case 'checkbox':
        return typeof raw === 'boolean' ? raw : Boolean(raw)
      case 'select':
        return selectValue(component, raw)
      case 'resource':
        return isResourceValue(raw) ? raw.current : toNumberOrZero(raw)
      case 'computed':
        return evaluateDerived(component.key, component.formula, context)
      default:
        // Botão de rolagem e título não têm valor.
        return undefined
    }
  }

  /** Lista de opções devolve o valor numérico da opção, se houver; senão, o rótulo (5.4). */
  function selectValue(
    component: Extract<SheetComponent, { type: 'select' }>,
    raw: SheetValue | undefined
  ): FormulaValue {
    const optionId = typeof raw === 'string' ? raw : ''
    const option = component.options.find((item) => item.id === optionId)
    if (option === undefined) return ''
    return option.value ?? option.label
  }

  function attributeModifier(
    component: Extract<SheetComponent, { type: 'attribute' }>
  ): FormulaValue {
    const value = ownValue(component) ?? 0
    const formula = component.modifierFormula
    if (formula === undefined || formula.trim() === '') return 0

    // `valor` é o próprio valor do atributo dentro da fórmula do modificador.
    const local = withValues(context, new Map([['valor', value]]))
    return evaluateDerived(`${component.key}.mod`, formula, local) ?? 0
  }

  function resourceMax(
    component: Extract<SheetComponent, { type: 'resource' }>
  ): FormulaValue | undefined {
    const formula = component.maxFormula
    if (formula !== undefined && formula.trim() !== '') {
      return evaluateDerived(`${component.key}.max`, formula, context)
    }

    const raw = values[component.id]
    if (isResourceValue(raw) && raw.max !== undefined) return raw.max
    return component.maxValue ?? 0
  }

  // -------------------------------------------------------------------------
  // Tabelas
  // -------------------------------------------------------------------------

  function tableRows(component: Extract<SheetComponent, { type: 'table' }>): TableRowValue[] {
    const raw = values[component.id]
    return isTableValue(raw) ? raw : []
  }

  function rowName(row: TableRowValue, index: number): string {
    return row.key ?? row.id ?? String(index)
  }

  function computeTablePath(
    component: Extract<SheetComponent, { type: 'table' }>,
    rest: readonly string[]
  ): FormulaValue | undefined {
    // A tabela em si não é valor escalar; `soma`/`contar` passam por resolveList.
    if (rest.length !== 2) return undefined

    const [rowKey, columnKey] = rest
    const rows = tableRows(component)
    const index = rows.findIndex((row, position) => rowName(row, position) === rowKey)
    const row = rows[index]
    if (row === undefined || columnKey === undefined) return undefined

    return cellValue(component, row, index, columnKey)
  }

  function cellValue(
    component: Extract<SheetComponent, { type: 'table' }>,
    row: TableRowValue,
    index: number,
    columnKey: string
  ): FormulaValue | undefined {
    const column = component.columns.find((item) => item.key === columnKey)
    if (column === undefined) return undefined

    if (column.kind === 'computed') {
      const formula = column.formula
      if (formula === undefined || formula.trim() === '') return 0
      const path = `${component.key}.${rowName(row, index)}.${column.key}`
      return evaluateDerived(path, formula, rowContext(component, row, index))
    }

    if (column.kind === 'rollButton') return undefined

    return rawCellValue(column, row.cells[column.key])
  }

  function rawCellValue(column: TableColumn, raw: FormulaValue | undefined): FormulaValue {
    switch (column.kind) {
      case 'number':
        return toNumberOrZero(raw)
      case 'checkbox':
        return raw === true
      case 'select': {
        const option = column.options?.find((item) => item.id === raw)
        if (option === undefined) return ''
        return option.value ?? option.label
      }
      default:
        return typeof raw === 'string' ? raw : (raw ?? '')
    }
  }

  /**
   * Contexto de uma linha: as colunas da própria linha valem como chave, e o resto da
   * ficha continua acessível (seção 5.4).
   */
  function rowContext(
    component: Extract<SheetComponent, { type: 'table' }>,
    row: TableRowValue,
    index: number
  ): FormulaContext {
    return {
      resolve: (path) => {
        if (path.length === 1) {
          const columnKey = path[0] as string
          const column = component.columns.find((item) => item.key === columnKey)
          if (column !== undefined) {
            // Passa pelo resolve principal para aproveitar o cache e a detecção de ciclo.
            return resolve([component.key, rowName(row, index), columnKey])
          }
        }
        return resolve(path)
      },
      resolveList: (path) => resolveList(path)
    }
  }

  function resolveList(path: readonly string[]): readonly FormulaValue[] | undefined {
    const [head, ...rest] = path
    if (head === undefined) return undefined

    const component = byKey.get(head)
    if (component === undefined || component.type !== 'table') return undefined

    const rows = tableRows(component)

    if (rest.length === 0) return rows.map((row, index) => rowName(row, index))

    if (rest.length === 1) {
      const columnKey = rest[0] as string
      const column = component.columns.find((item) => item.key === columnKey)
      if (column === undefined) return undefined

      const list: FormulaValue[] = []
      rows.forEach((row, index) => {
        const value = cellValue(component, row, index, columnKey)
        if (value !== undefined) list.push(value)
      })
      return list
    }

    return undefined
  }

  const context: FormulaContext = { resolve, resolveList }

  return { context, errors }
}

/**
 * Preenche o atual de cada barra com o máximo **calculado**.
 *
 * `createDefaultValues` não tem como fazer isso: quando o máximo vem de fórmula
 * (`10 + constituicao.mod * nivel`), só dá para saber o número depois de montar o
 * contexto. Sem este passo, uma ficha nova nasceria com 0 de vida de 16.
 *
 * `onlyIds` limita o preenchimento a algumas barras. A migração usa isso: uma barra que
 * acabou de aparecer no modelo nasce cheia, mas as que já existiam não podem ser curadas
 * só porque o mestre publicou uma versão nova (5.7).
 */
export function fillResourceCurrents(
  schema: SheetSchema,
  values: SheetValues,
  onlyIds?: readonly string[]
): SheetValues {
  const { context } = createSheetContext(schema, values)
  const filled: SheetValues = { ...values }

  for (const component of allComponents(schema)) {
    if (component.type !== 'resource') continue
    if (onlyIds !== undefined && !onlyIds.includes(component.id)) continue

    let max: number
    try {
      const resolved = context.resolve([component.key, 'max'])
      max = resolved === undefined ? 0 : Math.max(0, toNumber(resolved))
    } catch {
      // Fórmula de máximo quebrada: a barra começa vazia e a ficha mostra o erro.
      max = 0
    }

    filled[component.id] =
      component.maxValue === undefined
        ? { current: max }
        : { current: max, max: component.maxValue }
  }

  return filled
}

/** Ficha nova a partir do modelo, já com as barras cheias. */
export function createInitialValues(schema: SheetSchema): SheetValues {
  return fillResourceCurrents(schema, createDefaultValues(schema))
}

/** Valores de teste do "Visualizar como jogador" (5.2), com as barras cheias. */
export function createPreviewValues(schema: SheetSchema): SheetValues {
  return fillResourceCurrents(schema, createSampleValues(schema))
}

/**
 * Quantas bolinhas os marcadores mostram. Fica aqui porque depende de fórmula, e a
 * interface precisa do número para desenhar.
 */
export function resolveMarkersCount(
  component: Extract<SheetComponent, { type: 'markers' }>,
  context: FormulaContext
): number {
  const formula = component.countFormula
  if (formula === undefined || formula.trim() === '') return Math.max(0, component.count ?? 0)

  const result = evaluateFormula(formula, context)
  if (!result.ok) return 0
  try {
    return Math.max(0, Math.trunc(toNumber(result.value)))
  } catch {
    return 0
  }
}

function toNumberOrZero(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (typeof raw === 'string') {
    try {
      return toNumber(raw)
    } catch {
      return 0
    }
  }
  return 0
}

// ---------------------------------------------------------------------------
// computed e bars (seção 5.6)
// ---------------------------------------------------------------------------

export interface BarValue {
  current: number
  max: number
}

/**
 * Resumo dos papéis, salvo junto com a ficha. O banco copia isto para os tokens, então
 * todos veem as barras no mapa sem ter acesso à ficha (seção 5.6).
 */
export interface SheetSummary {
  name?: string
  portrait?: string
  defense?: number
  vision?: number
  bars: Partial<Record<'hp' | 'bar2' | 'bar3', BarValue>>
}

export interface ComputeSheetResult {
  /** Cache dos campos calculados, por chave. */
  computed: Record<string, FormulaValue>
  /** Erros por chave de campo calculado, para a ficha mostrar `#ERRO` com o motivo. */
  errors: Map<string, FormulaError>
  summary: SheetSummary
  context: FormulaContext
}

/** Calcula os campos derivados e o resumo dos papéis de uma ficha. */
export function computeSheet(schema: SheetSchema, values: SheetValues): ComputeSheetResult {
  // Reaproveita o mapa de erros do contexto: os campos derivados (modificador, máximo,
  // coluna calculada) registram os problemas deles lá dentro.
  const { context, errors } = createSheetContext(schema, values)
  const computed: Record<string, FormulaValue> = {}

  for (const component of allComponents(schema)) {
    if (component.type === 'computed') {
      const result = evaluateFormula(component.formula, context)
      if (result.ok) computed[component.key] = result.value
      else errors.set(component.key, result.error)
      continue
    }

    if (component.type === 'attribute' && (component.modifierFormula ?? '').trim() !== '') {
      readInto(context, [component.key, 'mod'], `${component.key}.mod`, computed, errors)
    }

    if (component.type === 'resource') {
      readInto(context, [component.key, 'max'], `${component.key}.max`, computed, errors)
    }
  }

  return { computed, errors, summary: buildSummary(schema, values, context, errors), context }
}

function readInto(
  context: FormulaContext,
  path: readonly string[],
  key: string,
  computed: Record<string, FormulaValue>,
  errors: Map<string, FormulaError>
): void {
  try {
    const value = context.resolve(path)
    if (value !== undefined) computed[key] = value
  } catch (error) {
    if (error instanceof FormulaException) errors.set(key, error.error)
    else throw error
  }
}

function buildSummary(
  schema: SheetSchema,
  values: SheetValues,
  context: FormulaContext,
  errors: Map<string, FormulaError>
): SheetSummary {
  const summary: SheetSummary = { bars: {} }
  const roleOf = (role: ComponentRole): SheetComponent | undefined =>
    allComponents(schema).find((component) => component.role === role)

  const nameComponent = roleOf('name')
  if (nameComponent !== undefined) {
    const raw = values[nameComponent.id]
    if (typeof raw === 'string' && raw.trim() !== '') summary.name = raw
  }

  const portraitComponent = roleOf('portrait')
  if (portraitComponent !== undefined) {
    const raw = values[portraitComponent.id]
    if (typeof raw === 'string' && raw !== '') summary.portrait = raw
  }

  for (const role of ['hp', 'bar2', 'bar3'] as const) {
    const component = roleOf(role)
    if (component === undefined || component.type !== 'resource') continue

    const raw = values[component.id]
    const current = isResourceValue(raw) ? raw.current : 0
    let max = 0
    try {
      const resolved = context.resolve([component.key, 'max'])
      max = resolved === undefined ? 0 : toNumber(resolved)
    } catch (error) {
      if (error instanceof FormulaException) errors.set(`${component.key}.max`, error.error)
    }
    summary.bars[role] = { current, max }
  }

  for (const role of ['defense', 'vision'] as const) {
    const component = roleOf(role)
    if (component === undefined) continue
    try {
      const value = context.resolve([component.key])
      if (value !== undefined) summary[role] = toNumber(value)
    } catch (error) {
      if (error instanceof FormulaException) errors.set(component.key, error.error)
    }
  }

  return summary
}

/**
 * Lê um caminho sem deixar erro escapar: a ficha mostra `#ERRO` com o motivo no tooltip
 * em vez de quebrar a tela (seção 5.4).
 */
export function readFormulaValue(
  context: FormulaContext,
  path: readonly string[]
): { value?: FormulaValue; error?: FormulaError } {
  try {
    const value = context.resolve(path)
    return value === undefined ? {} : { value }
  } catch (error) {
    if (error instanceof FormulaException) return { error: error.error }
    throw error
  }
}

/**
 * Contexto de uma linha de tabela para o botão de rolagem da própria linha: as colunas
 * daquela linha viram chaves simples, e o resto da ficha continua acessível.
 */
export function createRowFormulaContext(
  context: FormulaContext,
  table: Extract<SheetComponent, { type: 'table' }>,
  rowName: string
): FormulaContext {
  const local = new Map<string, FormulaValue>()

  for (const column of table.columns) {
    const { value } = readFormulaValue(context, [table.key, rowName, column.key])
    if (value !== undefined) local.set(column.key, value)
  }

  return withValues(context, local)
}

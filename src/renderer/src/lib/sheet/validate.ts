import { collectReferencePaths, parseFormula, planFromDependencies } from '../formula'
import { validateRollNotation } from '../dice'
import {
  collectFormulaSlots,
  slotExpressions,
  slotReferencedKeys,
  type FormulaSlot
} from './formula-refs'
import { isReservedKey, isValidKeyFormat } from './keys'
import {
  allComponents,
  isDecorative,
  ROLE_ALLOWED_TYPES,
  ROLE_LABELS,
  type ComponentRole,
  type SheetComponent,
  type SheetSchema
} from './types'

/**
 * Validação do modelo (seção 5.2). Roda no botão Validar e antes de publicar.
 *
 * A ideia é pegar aqui tudo que só apareceria na mesa, no meio da sessão: chave repetida,
 * fórmula que não compila, referência a campo que não existe, dependência circular e campo
 * que o jogador vê mas que depende de dado só do mestre (vazaria informação).
 */

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
  tabId?: string
  componentId?: string
  field?: string
}

export interface ValidationReport {
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  /** Sem erros. Avisos não impedem publicar. */
  ok: boolean
}

/** Campos cuja fórmula produz valor — são esses que podem formar dependência circular. */
function producesValue(slot: FormulaSlot): boolean {
  if (slot.kind === 'roll') return false
  if (slot.field === 'visibleWhen' || slot.field === 'critical.threshold') return false
  return true
}

export function validateSchema(schema: SheetSchema): ValidationReport {
  const issues: ValidationIssue[] = []
  const components = allComponents(schema)

  checkTabs(schema, issues)
  checkKeys(schema, components, issues)
  checkComponentShape(schema, components, issues)
  checkRoles(components, issues)
  checkFormulas(schema, issues)
  checkCycles(schema, issues)
  checkVisibilityLeaks(schema, issues)

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return { issues, errors, warnings, ok: errors.length === 0 }
}

function tabOf(schema: SheetSchema, componentId: string): string | undefined {
  return schema.tabs.find((tab) => tab.components.some((c) => c.id === componentId))?.id
}

function checkTabs(schema: SheetSchema, issues: ValidationIssue[]): void {
  if (schema.tabs.length === 0) {
    issues.push({
      severity: 'error',
      code: 'no-tabs',
      message: 'O modelo precisa de pelo menos uma aba.'
    })
  }

  for (const tab of schema.tabs) {
    if (tab.label.trim() === '') {
      issues.push({
        severity: 'warning',
        code: 'tab-no-label',
        message: 'Há uma aba sem nome.',
        tabId: tab.id
      })
    }
  }
}

function checkKeys(
  schema: SheetSchema,
  components: readonly SheetComponent[],
  issues: ValidationIssue[]
): void {
  const seen = new Map<string, SheetComponent>()

  for (const component of components) {
    const name = component.label.trim() === '' ? component.key : component.label
    const tabId = tabOf(schema, component.id)

    if (isDecorative(component)) continue

    if (component.key.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'key-empty',
        message: `"${name}" está sem chave.`,
        componentId: component.id,
        tabId,
        field: 'key'
      })
      continue
    }

    if (!isValidKeyFormat(component.key)) {
      issues.push({
        severity: 'error',
        code: 'key-format',
        message: `A chave "${component.key}" não serve: use letras, números e _, começando por letra.`,
        componentId: component.id,
        tabId,
        field: 'key'
      })
    }

    if (isReservedKey(component.key)) {
      issues.push({
        severity: 'error',
        code: 'key-reserved',
        message: `"${component.key}" é uma palavra reservada das fórmulas. Escolha outra chave.`,
        componentId: component.id,
        tabId,
        field: 'key'
      })
    }

    const previous = seen.get(component.key)
    if (previous !== undefined) {
      issues.push({
        severity: 'error',
        code: 'key-duplicate',
        message: `A chave "${component.key}" está repetida em "${previous.label}" e "${name}".`,
        componentId: component.id,
        tabId,
        field: 'key'
      })
    } else {
      seen.set(component.key, component)
    }
  }
}

function checkComponentShape(
  schema: SheetSchema,
  components: readonly SheetComponent[],
  issues: ValidationIssue[]
): void {
  for (const component of components) {
    const tabId = tabOf(schema, component.id)
    const name = component.label.trim() === '' ? component.key : component.label

    if (component.type === 'select' && component.options.length === 0) {
      issues.push({
        severity: 'error',
        code: 'select-no-options',
        message: `A lista "${name}" não tem nenhuma opção.`,
        componentId: component.id,
        tabId,
        field: 'options'
      })
    }

    if (component.type === 'table') {
      if (component.columns.length === 0) {
        issues.push({
          severity: 'error',
          code: 'table-no-columns',
          message: `A tabela "${name}" não tem nenhuma coluna.`,
          componentId: component.id,
          tabId,
          field: 'columns'
        })
      }

      const columnKeys = new Set<string>()
      for (const column of component.columns) {
        if (!isValidKeyFormat(column.key)) {
          issues.push({
            severity: 'error',
            code: 'column-key-format',
            message: `A coluna "${column.label}" de "${name}" tem chave inválida.`,
            componentId: component.id,
            tabId
          })
        }
        if (columnKeys.has(column.key)) {
          issues.push({
            severity: 'error',
            code: 'column-key-duplicate',
            message: `A chave de coluna "${column.key}" está repetida em "${name}".`,
            componentId: component.id,
            tabId
          })
        }
        columnKeys.add(column.key)
      }

      const rowKeys = new Set<string>()
      for (const row of component.rows) {
        if (rowKeys.has(row.key)) {
          issues.push({
            severity: 'error',
            code: 'row-key-duplicate',
            message: `A linha "${row.key}" está repetida em "${name}".`,
            componentId: component.id,
            tabId
          })
        }
        rowKeys.add(row.key)
      }
    }

    if (component.type === 'resource' && component.maxValue === undefined) {
      const hasFormula = (component.maxFormula ?? '').trim() !== ''
      if (!hasFormula) {
        issues.push({
          severity: 'error',
          code: 'resource-no-max',
          message: `A barra "${name}" precisa de um máximo fixo ou de uma fórmula de máximo.`,
          componentId: component.id,
          tabId,
          field: 'maxValue'
        })
      }
    }

    if (component.type === 'markers' && component.count === undefined) {
      const hasFormula = (component.countFormula ?? '').trim() !== ''
      if (!hasFormula) {
        issues.push({
          severity: 'error',
          code: 'markers-no-count',
          message: `Os marcadores "${name}" precisam de uma quantidade fixa ou de uma fórmula.`,
          componentId: component.id,
          tabId,
          field: 'count'
        })
      }
    }
  }
}

function checkRoles(components: readonly SheetComponent[], issues: ValidationIssue[]): void {
  const byRole = new Map<ComponentRole, SheetComponent[]>()

  for (const component of components) {
    if (component.role === undefined) continue
    const list = byRole.get(component.role) ?? []
    list.push(component)
    byRole.set(component.role, list)
  }

  for (const [role, list] of byRole) {
    if (list.length > 1) {
      const names = list.map((c) => c.label || c.key).join(', ')
      issues.push({
        severity: 'error',
        code: 'role-duplicate',
        message: `O papel "${ROLE_LABELS[role]}" está em mais de um componente: ${names}.`,
        componentId: list[1]?.id,
        field: 'role'
      })
    }

    const allowed = ROLE_ALLOWED_TYPES[role]
    for (const component of list) {
      if (!allowed.includes(component.type)) {
        issues.push({
          severity: 'error',
          code: 'role-type',
          message: `"${component.label || component.key}" não pode ter o papel "${ROLE_LABELS[role]}".`,
          componentId: component.id,
          field: 'role'
        })
      }
    }
  }

  if (!byRole.has('hp')) {
    issues.push({
      severity: 'warning',
      code: 'role-missing-hp',
      message:
        'Nenhuma barra está marcada como Vida. Sem isso, o token não mostra barra de vida e o dano não tem onde cair.'
    })
  }
}

function checkFormulas(schema: SheetSchema, issues: ValidationIssue[]): void {
  const components = allComponents(schema)

  for (const slot of collectFormulaSlots(schema)) {
    for (const expression of slotExpressions(slot)) {
      if (expression.trim() === '') continue

      const parsed = parseFormula(expression)
      if (!parsed.ok) {
        issues.push({
          severity: 'error',
          code: 'formula-invalid',
          message: `${slot.label}: ${parsed.error.message}`,
          componentId: slot.componentId,
          tabId: slot.tabId,
          field: slot.field
        })
        continue
      }

      for (const path of collectReferencePaths(parsed.value)) {
        const problem = describeReferenceProblem(path, slot, components)
        if (problem !== null) {
          issues.push({
            severity: 'error',
            code: 'formula-unknown-reference',
            message: `${slot.label}: ${problem}`,
            componentId: slot.componentId,
            tabId: slot.tabId,
            field: slot.field
          })
        }
      }
    }

    if (slot.kind === 'roll') {
      // Troca cada `{…}` por 1 para conferir se o resto é notação de dados válida.
      const probe = slot.formula.replace(/\{[^}]*\}/g, '1')
      const notation = validateRollNotation(probe)
      if (!notation.ok) {
        issues.push({
          severity: 'error',
          code: 'notation-invalid',
          message: `${slot.label}: ${notation.error.message}`,
          componentId: slot.componentId,
          tabId: slot.tabId,
          field: slot.field
        })
      }
    }
  }
}

/** Devolve a explicação do problema, ou null quando a referência está boa. */
function describeReferenceProblem(
  path: readonly string[],
  slot: FormulaSlot,
  components: readonly SheetComponent[]
): string | null {
  const [head, ...rest] = path
  if (head === undefined) return null
  if (slot.localKeys.includes(head)) return null

  const target = components.find((component) => component.key === head)
  if (target === undefined) return `o campo "${head}" não existe.`
  if (isDecorative(target)) return `"${head}" é só um título e não tem valor.`
  if (target.type === 'rollButton') return `"${head}" é um botão de rolagem e não tem valor.`

  if (rest.length === 0) return null

  switch (target.type) {
    case 'attribute':
      return rest.length === 1 && rest[0] === 'mod'
        ? null
        : `o atributo "${head}" só aceita "${head}.mod".`
    case 'resource':
      return rest.length === 1 && rest[0] === 'max'
        ? null
        : `a barra "${head}" só aceita "${head}.max".`
    case 'table':
      return describeTableReferenceProblem(head, rest, target)
    default:
      return `"${head}" não tem "${rest.join('.')}".`
  }
}

function describeTableReferenceProblem(
  head: string,
  rest: readonly string[],
  table: Extract<SheetComponent, { type: 'table' }>
): string | null {
  const columnKeys = table.columns.map((column) => column.key)
  const rowKeys = table.rows.map((row) => row.key)

  if (rest.length === 1) {
    const [name] = rest
    if (name !== undefined && columnKeys.includes(name)) return null
    return `a tabela "${head}" não tem a coluna "${rest[0] ?? ''}".`
  }

  if (rest.length === 2) {
    const [rowKey, columnKey] = rest
    if (rowKey !== undefined && !rowKeys.includes(rowKey)) {
      return `a tabela "${head}" não tem a linha "${rowKey}".`
    }
    if (columnKey !== undefined && !columnKeys.includes(columnKey)) {
      return `a tabela "${head}" não tem a coluna "${columnKey}".`
    }
    return null
  }

  return `"${head}.${rest.join('.')}" não é um caminho de tabela válido.`
}

function checkCycles(schema: SheetSchema, issues: ValidationIssue[]): void {
  const valueSlots = collectFormulaSlots(schema).filter(producesValue)
  const componentsById = new Map(allComponents(schema).map((c) => [c.id, c]))

  const byKey = new Map<string, Set<string>>()
  for (const slot of valueSlots) {
    const component = componentsById.get(slot.componentId)
    if (component === undefined) continue
    const dependencies = byKey.get(component.key) ?? new Set<string>()
    for (const key of slotReferencedKeys(slot)) {
      // A coluna calculada referencia colunas da própria linha: isso não é dependência
      // entre componentes.
      if (slot.localKeys.includes(key)) continue
      dependencies.add(key)
    }
    byKey.set(component.key, dependencies)
  }

  const plan = planFromDependencies(
    [...byKey].map(([key, dependsOn]) => ({ key, dependsOn: [...dependsOn] }))
  )
  if (plan.cycle === null) return

  const cycleText = plan.cycle.join(' → ')
  for (const key of plan.cyclic) {
    const component = allComponents(schema).find((c) => c.key === key)
    issues.push({
      severity: 'error',
      code: 'formula-cycle',
      message:
        plan.cycle?.includes(key) === true
          ? `Dependência circular: ${cycleText}.`
          : `"${key}" depende de um campo com dependência circular.`,
      componentId: component?.id,
      tabId: component === undefined ? undefined : tabOf(schema, component.id)
    })
  }
}

/**
 * Campo que o jogador vê não pode depender de campo só do mestre: o valor calculado
 * entregaria a informação escondida (seção 5.2).
 */
function checkVisibilityLeaks(schema: SheetSchema, issues: ValidationIssue[]): void {
  const components = allComponents(schema)
  const gmOnlyKeys = new Set(
    components.filter((c) => c.visibleTo === 'gm' && !isDecorative(c)).map((c) => c.key)
  )
  if (gmOnlyKeys.size === 0) return

  const componentsById = new Map(components.map((c) => [c.id, c]))

  for (const slot of collectFormulaSlots(schema)) {
    const component = componentsById.get(slot.componentId)
    if (component === undefined || component.visibleTo === 'gm') continue

    for (const key of slotReferencedKeys(slot)) {
      if (slot.localKeys.includes(key) || !gmOnlyKeys.has(key)) continue
      issues.push({
        severity: 'error',
        code: 'visibility-leak',
        message: `${slot.label}: o jogador vê este campo, mas ele depende de "${key}", que é só do mestre.`,
        componentId: component.id,
        tabId: slot.tabId,
        field: slot.field
      })
    }
  }
}

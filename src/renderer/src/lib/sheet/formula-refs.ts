import { collectReferencedKeys, parseFormula, stripFormulaPrefix, tokenize } from '../formula'
import type { SheetComponent, SheetSchema, SheetTab } from './types'

/**
 * Onde moram as fórmulas de um modelo, num só lugar.
 *
 * Validação, renomear chave e "esta chave é usada em quais fórmulas?" todas passam por
 * aqui: assim, quando um componente novo ganhar uma fórmula, basta ensiná-la nesta lista.
 */

export type FormulaSlotKind =
  /** Expressão comum, como num campo calculado. */
  | 'expression'
  /** Notação de rolagem, onde só o que está entre `{…}` é fórmula. */
  | 'roll'

export interface FormulaSlot {
  tabId: string
  componentId: string
  /** Descrição para a mensagem de erro: "Vida → máximo". */
  label: string
  /** Campo do componente (ou `columns[2].formula`). */
  field: string
  kind: FormulaSlotKind
  formula: string
  /**
   * Chaves que valem só dentro desta fórmula: `valor` no modificador de atributo e as
   * colunas da própria linha numa coluna calculada.
   */
  localKeys: readonly string[]
}

export function collectFormulaSlots(schema: SheetSchema): FormulaSlot[] {
  return schema.tabs.flatMap((tab) => tab.components.flatMap((c) => componentSlots(tab, c)))
}

function componentSlots(tab: SheetTab, component: SheetComponent): FormulaSlot[] {
  const slots: FormulaSlot[] = []
  const base = { tabId: tab.id, componentId: component.id }
  const name = component.label === '' ? component.key : component.label

  const push = (
    field: string,
    formula: string | undefined,
    kind: FormulaSlotKind,
    suffix: string,
    localKeys: readonly string[] = []
  ): void => {
    if (formula === undefined || formula.trim() === '') return
    slots.push({ ...base, label: `${name} → ${suffix}`, field, kind, formula, localKeys })
  }

  push('visibleWhen', component.visibleWhen, 'expression', 'condição de visibilidade')

  switch (component.type) {
    case 'attribute':
      // `valor` é o próprio valor do atributo (ex.: `piso((valor - 10) / 2)`).
      push('modifierFormula', component.modifierFormula, 'expression', 'modificador', ['valor'])
      break
    case 'resource':
      push('maxFormula', component.maxFormula, 'expression', 'máximo')
      break
    case 'markers':
      push('countFormula', component.countFormula, 'expression', 'quantidade')
      break
    case 'computed':
      push('formula', component.formula, 'expression', 'fórmula')
      break
    case 'rollButton':
      push('formula', component.formula, 'roll', 'rolagem')
      if (
        component.critical.kind === 'margin' &&
        typeof component.critical.threshold === 'string'
      ) {
        push('critical.threshold', component.critical.threshold, 'expression', 'margem de crítico')
      }
      break
    case 'table': {
      // Numa coluna calculada, as outras colunas da mesma linha valem como chave.
      const columnKeys = component.columns.map((column) => column.key)
      component.columns.forEach((column, index) => {
        if (column.kind === 'computed') {
          push(
            `columns[${index}].formula`,
            column.formula,
            'expression',
            `coluna ${column.label}`,
            columnKeys
          )
        }
        if (column.kind === 'rollButton') {
          push(
            `columns[${index}].formula`,
            column.formula,
            'roll',
            `coluna ${column.label}`,
            columnKeys
          )
        }
      })
      break
    }
    default:
      break
  }

  return slots
}

/** Trechos entre chaves de uma notação de rolagem. */
export function braceSegments(formula: string): string[] {
  const segments: string[] = []
  const pattern = /\{([^}]*)\}/g
  let match = pattern.exec(formula)
  while (match !== null) {
    segments.push(match[1] ?? '')
    match = pattern.exec(formula)
  }
  return segments
}

/** As expressões de um slot: a própria fórmula, ou os trechos entre chaves. */
export function slotExpressions(slot: FormulaSlot): string[] {
  return slot.kind === 'roll' ? braceSegments(slot.formula) : [slot.formula]
}

/** Chaves que o slot usa. Fórmula que não compila devolve lista vazia. */
export function slotReferencedKeys(slot: FormulaSlot): string[] {
  const keys = new Set<string>()
  for (const expression of slotExpressions(slot)) {
    const parsed = parseFormula(expression)
    if (!parsed.ok) continue
    for (const key of collectReferencedKeys(parsed.value)) keys.add(key)
  }
  return [...keys]
}

export interface KeyUsage {
  slot: FormulaSlot
}

/** Em quais fórmulas esta chave aparece — o aviso ao excluir um componente (5.2). */
export function findKeyUsages(schema: SheetSchema, key: string): KeyUsage[] {
  return collectFormulaSlots(schema)
    .filter((slot) => slotReferencedKeys(slot).includes(key))
    .map((slot) => ({ slot }))
}

/**
 * Troca o nome de uma chave dentro de uma expressão, mexendo só nas referências.
 *
 * Usa os tokens em vez de busca e substituição de texto: assim `forca` não é trocado
 * dentro de `forca_bruta`, de `"forca"` (texto) nem de `outra.forca` (segmento de caminho).
 */
export function renameKeyInExpression(source: string, oldKey: string, newKey: string): string {
  const { text, offset } = stripFormulaPrefix(source)
  if (text === '') return source

  let tokens
  try {
    tokens = tokenize(text)
  } catch {
    // Fórmula que nem tokeniza: deixamos como está para não piorar.
    return source
  }

  const edits: { start: number; end: number }[] = []
  tokens.forEach((token, index) => {
    if (token.type !== 'identifier' || token.text !== oldKey) return
    const previous = tokens[index - 1]
    const next = tokens[index + 1]
    // Segmento de caminho (`vida.forca`) e chamada de função (`forca(...)`) não são a chave.
    if (previous?.type === 'dot') return
    if (next?.type === 'lparen') return
    edits.push({ start: token.position, end: token.position + token.text.length })
  })

  if (edits.length === 0) return source

  let rewritten = text
  for (const edit of [...edits].reverse()) {
    rewritten = rewritten.slice(0, edit.start) + newKey + rewritten.slice(edit.end)
  }

  return source.slice(0, offset) + rewritten
}

/** Numa notação de rolagem, só o conteúdo entre chaves é fórmula. */
export function renameKeyInRollFormula(source: string, oldKey: string, newKey: string): string {
  return source.replace(/\{([^}]*)\}/g, (_match, inner: string) => {
    return `{${renameKeyInExpression(inner, oldKey, newKey)}}`
  })
}

export function renameKeyInSlotFormula(slot: FormulaSlot, oldKey: string, newKey: string): string {
  return slot.kind === 'roll'
    ? renameKeyInRollFormula(slot.formula, oldKey, newKey)
    : renameKeyInExpression(slot.formula, oldKey, newKey)
}

/**
 * Aplica uma transformação em todas as fórmulas de um componente, devolvendo uma cópia.
 *
 * Existe para o "renomear a chave atualiza as fórmulas que a usam" (5.2): escrever de volta
 * pelo caminho do campo (`columns[2].formula`) seria frágil, então o lugar de cada fórmula
 * fica descrito uma única vez, aqui.
 */
export function mapComponentFormulas(
  component: SheetComponent,
  transform: (formula: string, kind: FormulaSlotKind) => string
): SheetComponent {
  const next = structuredClone(component)

  if (next.visibleWhen !== undefined) {
    next.visibleWhen = transform(next.visibleWhen, 'expression')
  }

  switch (next.type) {
    case 'attribute':
      if (next.modifierFormula !== undefined) {
        next.modifierFormula = transform(next.modifierFormula, 'expression')
      }
      break
    case 'resource':
      if (next.maxFormula !== undefined) {
        next.maxFormula = transform(next.maxFormula, 'expression')
      }
      break
    case 'markers':
      if (next.countFormula !== undefined) {
        next.countFormula = transform(next.countFormula, 'expression')
      }
      break
    case 'computed':
      next.formula = transform(next.formula, 'expression')
      break
    case 'rollButton':
      next.formula = transform(next.formula, 'roll')
      if (next.critical.kind === 'margin' && typeof next.critical.threshold === 'string') {
        next.critical = {
          kind: 'margin',
          threshold: transform(next.critical.threshold, 'expression')
        }
      }
      break
    case 'table':
      next.columns = next.columns.map((column) => {
        if (column.formula === undefined) return column
        const kind = column.kind === 'rollButton' ? 'roll' : 'expression'
        return { ...column, formula: transform(column.formula, kind) }
      })
      break
    default:
      break
  }

  return next
}

/** Troca a chave no componente dono dela e em todas as fórmulas do modelo. */
export function renameKeyInSchema(
  schema: SheetSchema,
  componentId: string,
  newKey: string
): SheetSchema {
  const owner = schema.tabs
    .flatMap((tab) => tab.components)
    .find((component) => component.id === componentId)
  if (owner === undefined || owner.key === newKey) return schema

  const oldKey = owner.key

  return {
    ...schema,
    tabs: schema.tabs.map((tab) => ({
      ...tab,
      components: tab.components.map((component) => {
        const rewritten = mapComponentFormulas(component, (formula, kind) =>
          kind === 'roll'
            ? renameKeyInRollFormula(formula, oldKey, newKey)
            : renameKeyInExpression(formula, oldKey, newKey)
        )
        return component.id === componentId ? { ...rewritten, key: newKey } : rewritten
      })
    }))
  }
}

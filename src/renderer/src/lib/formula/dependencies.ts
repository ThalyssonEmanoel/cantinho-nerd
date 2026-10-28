import { withValues } from './context'
import { evaluateAst } from './evaluate'
import { parseFormula, type FormulaNode } from './parser'
import type { FormulaContext, FormulaResult, FormulaValue } from './types'

/** Um campo calculado: a chave do componente e a fórmula dele. */
export interface FormulaEntry {
  key: string
  formula: string
}

export interface EvaluationPlan {
  /** Ordem segura de cálculo: cada campo só aparece depois do que ele usa. */
  order: string[]
  /** Campos que não podem ser calculados por causa de dependência circular. */
  cyclic: string[]
  /** Um ciclo concreto, para a mensagem (ex.: `['a','b','a']`). Null quando não há ciclo. */
  cycle: string[] | null
}

/**
 * Chaves que a fórmula usa. Só o primeiro segmento importa: `forca.mod` e `vida.max`
 * dependem dos componentes `forca` e `vida`, e é por componente que o recálculo acontece.
 */
export function collectReferencedKeys(node: FormulaNode): string[] {
  const keys = new Set<string>()
  collectInto(node, keys)
  return [...keys]
}

/**
 * Caminhos completos usados pela fórmula (`[['forca','mod'], ['pericias','furtividade','total']]`).
 * A validação do construtor precisa do caminho inteiro para dizer, por exemplo, que um
 * texto não tem `.mod`.
 */
export function collectReferencePaths(node: FormulaNode): string[][] {
  const paths: string[][] = []
  collectPathsInto(node, paths)
  return paths
}

function collectPathsInto(node: FormulaNode, paths: string[][]): void {
  switch (node.kind) {
    case 'reference':
      paths.push([...node.path])
      return
    case 'call':
      for (const arg of node.args) collectPathsInto(arg, paths)
      return
    case 'unary':
      collectPathsInto(node.operand, paths)
      return
    case 'binary':
      collectPathsInto(node.left, paths)
      collectPathsInto(node.right, paths)
      return
    default:
      return
  }
}

function collectInto(node: FormulaNode, keys: Set<string>): void {
  switch (node.kind) {
    case 'reference':
      if (node.path.length > 0) keys.add(node.path[0] as string)
      return
    case 'call':
      for (const arg of node.args) collectInto(arg, keys)
      return
    case 'unary':
      collectInto(node.operand, keys)
      return
    case 'binary':
      collectInto(node.left, keys)
      collectInto(node.right, keys)
      return
    default:
      return
  }
}

/**
 * Ordena os campos calculados por dependência (ordenação topológica) e separa os que estão
 * em ciclo. Referências a chaves que não são campos calculados são entradas da ficha, e por
 * isso não entram no grafo.
 */
export function planEvaluation(entries: readonly FormulaEntry[]): EvaluationPlan {
  return planFromDependencies(
    entries.map((entry) => ({ key: entry.key, dependsOn: dependenciesOf(entry.formula) }))
  )
}

/** Uma chave e as chaves de que ela depende. */
export interface DependencyEntry {
  key: string
  dependsOn: readonly string[]
}

/**
 * Mesma ordenação, para quem já sabe as dependências. A validação do construtor usa isto,
 * porque lá um componente pode ter várias fórmulas (máximo, visibilidade, modificador…).
 */
export function planFromDependencies(entries: readonly DependencyEntry[]): EvaluationPlan {
  const known = new Set(entries.map((entry) => entry.key))
  const dependencies = new Map<string, Set<string>>()
  for (const entry of entries) {
    const existing = dependencies.get(entry.key) ?? new Set<string>()
    // Referência a chave que não é calculada é entrada da ficha: não entra no grafo.
    for (const dependency of entry.dependsOn) {
      if (known.has(dependency)) existing.add(dependency)
    }
    dependencies.set(entry.key, existing)
  }

  const keys = [...dependencies.keys()]

  const pending = new Map<string, Set<string>>()
  for (const key of keys) pending.set(key, new Set(dependencies.get(key)))

  const order: string[] = []
  let progressed = true

  // Kahn na mão, percorrendo na ordem de entrada: a saída fica estável entre execuções.
  while (progressed) {
    progressed = false
    for (const key of keys) {
      const remaining = pending.get(key)
      if (remaining === undefined || remaining.size > 0) continue
      pending.delete(key)
      order.push(key)
      progressed = true
      for (const other of pending.values()) other.delete(key)
    }
  }

  const cyclic = keys.filter((key) => pending.has(key))
  return {
    order,
    cyclic,
    cycle: cyclic.length > 0 ? findCycle(dependencies, cyclic) : null
  }
}

/** Chaves que uma fórmula usa. Fórmula que não compila não tem dependência: o erro
 * aparece na hora de calcular. */
function dependenciesOf(formula: string): string[] {
  const parsed = parseFormula(formula)
  return parsed.ok ? collectReferencedKeys(parsed.value) : []
}

/** Busca em profundidade para extrair um ciclo de verdade, para a mensagem de erro. */
function findCycle(dependencies: Map<string, Set<string>>, candidates: string[]): string[] | null {
  const inProgress = new Set<string>()
  const done = new Set<string>()
  const stack: string[] = []

  const visit = (key: string): string[] | null => {
    if (inProgress.has(key)) return [...stack.slice(stack.indexOf(key)), key]
    if (done.has(key)) return null

    inProgress.add(key)
    stack.push(key)

    for (const next of dependencies.get(key) ?? []) {
      const cycle = visit(next)
      if (cycle !== null) return cycle
    }

    stack.pop()
    inProgress.delete(key)
    done.add(key)
    return null
  }

  for (const key of candidates) {
    const cycle = visit(key)
    if (cycle !== null) return cycle
  }

  return null
}

/**
 * Calcula todos os campos na ordem certa, deixando cada um ver o resultado dos anteriores.
 * É o que a Fase 3 usa para montar o `computed` da ficha. Nunca lança: cada chave recebe o
 * seu próprio resultado, com erro quando for o caso.
 */
export function evaluateEntries(
  entries: readonly FormulaEntry[],
  context: FormulaContext
): Map<string, FormulaResult> {
  const plan = planEvaluation(entries)
  const formulas = new Map(entries.map((entry) => [entry.key, entry.formula]))
  const results = new Map<string, FormulaResult>()
  const computed = new Map<string, FormulaValue>()
  const layered = withValues(context, computed)

  for (const key of plan.order) {
    const parsed = parseFormula(formulas.get(key) ?? '')
    const result = parsed.ok ? evaluateAst(parsed.value, layered) : parsed
    results.set(key, result)
    if (result.ok) computed.set(key, result.value)
  }

  const cycleText = plan.cycle === null ? '' : plan.cycle.join(' → ')
  for (const key of plan.cyclic) {
    const inCycle = plan.cycle?.includes(key) === true
    results.set(key, {
      ok: false,
      error: {
        code: 'cycle',
        message: inCycle
          ? `Dependência circular: ${cycleText}.`
          : 'Depende de um campo com dependência circular.'
      }
    })
  }

  return results
}

/** Valores calculados com sucesso, prontos para virar o cache `computed` da ficha. */
export function collectComputedValues(
  results: ReadonlyMap<string, FormulaResult>
): Map<string, FormulaValue> {
  const computed = new Map<string, FormulaValue>()
  for (const [key, result] of results) {
    if (result.ok) computed.set(key, result.value)
  }
  return computed
}

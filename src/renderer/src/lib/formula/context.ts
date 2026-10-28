import type { FormulaContext, FormulaValue } from './types'

/**
 * Contexto a partir de um objeto simples. Serve para os testes, para a pré-visualização do
 * construtor ("Visualizar como jogador") e como referência de como a Fase 3 deve resolver
 * os caminhos a partir dos valores de verdade da ficha.
 *
 * Convenções, iguais às do armazenamento das fichas:
 * - barra de recurso é `{ current, max }`: `vida` dá o atual e `vida.max` o máximo;
 * - atributo é `{ value, mod }`: `forca` dá o valor e `forca.mod` o modificador;
 * - tabela é uma lista de linhas; a linha pode ter `key` (ou `id`) para ser acessada pelo
 *   nome, como em `pericias.furtividade.total`.
 */
export type SheetLikeValue = FormulaValue | SheetLikeRecord | readonly SheetLikeRecord[] | undefined

export interface SheetLikeRecord {
  readonly [key: string]: SheetLikeValue
}

export function createObjectContext(source: SheetLikeRecord): FormulaContext {
  return {
    resolve: (path) => unwrap(resolveNode(source, path)),
    resolveList: (path) => resolveList(source, path)
  }
}

/** Contexto sem nenhum valor: toda referência vira erro "campo não existe". */
export const emptyContext: FormulaContext = {
  resolve: () => undefined,
  resolveList: () => undefined
}

/**
 * Coloca valores locais na frente de um contexto existente, resolvidos por chave simples.
 *
 * Serve a dois usos da seção 5.4:
 * - recálculo em lote, para um campo calculado ver o resultado de outro;
 * - coluna calculada dentro de uma tabela, que usa as colunas da **própria linha** pelo
 *   nome (`total = atributo + treino`) sem perder acesso ao resto da ficha.
 */
export function withValues(
  base: FormulaContext,
  local: ReadonlyMap<string, FormulaValue>
): FormulaContext {
  return {
    resolve: (path) => {
      if (path.length === 1) {
        const value = local.get(path[0] as string)
        if (value !== undefined) return value
      }
      return base.resolve(path)
    },
    resolveList: (path) => base.resolveList(path)
  }
}

function isRecord(value: SheetLikeValue): value is SheetLikeRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTable(value: SheetLikeValue): value is readonly SheetLikeRecord[] {
  return Array.isArray(value)
}

/** Caminha pelo objeto sem desembrulhar o nó final. */
function resolveNode(root: SheetLikeRecord, path: readonly string[]): SheetLikeValue {
  let node: SheetLikeValue = root

  for (const segment of path) {
    if (isTable(node)) {
      node = findRow(node, segment)
    } else if (isRecord(node)) {
      node = node[segment]
    } else {
      return undefined
    }
    if (node === undefined) return undefined
  }

  return node
}

function findRow(rows: readonly SheetLikeRecord[], segment: string): SheetLikeValue {
  return rows.find((row) => rowName(row) === segment)
}

function rowName(row: SheetLikeRecord): string | undefined {
  const name = row['key'] ?? row['id']
  return typeof name === 'string' || typeof name === 'number' ? String(name) : undefined
}

/** Valor escalar de um nó, aplicando as convenções de barra e atributo. */
function unwrap(node: SheetLikeValue): FormulaValue | undefined {
  if (node === undefined || isTable(node)) return undefined

  if (isRecord(node)) {
    const current = node['current']
    if (isScalar(current)) return current
    const value = node['value']
    if (isScalar(value)) return value
    return undefined
  }

  return node
}

function isScalar(value: SheetLikeValue): value is FormulaValue {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
}

/**
 * Lista para agregação. `['inventario']` devolve uma entrada por linha (para `contar`) e
 * `['inventario','peso']` devolve a coluna `peso` de cada linha (para `soma`).
 */
function resolveList(
  root: SheetLikeRecord,
  path: readonly string[]
): readonly FormulaValue[] | undefined {
  const node = resolveNode(root, path)
  if (isTable(node)) {
    return node.map((row, index) => rowName(row) ?? String(index))
  }

  if (path.length >= 2) {
    const parent = resolveNode(root, path.slice(0, -1))
    const column = path[path.length - 1] as string
    if (isTable(parent)) {
      const values: FormulaValue[] = []
      for (const row of parent) {
        const cell = unwrap(row[column])
        // Linha sem a coluna preenchida simplesmente não entra na soma.
        if (cell !== undefined) values.push(cell)
      }
      return values
    }
  }

  return undefined
}

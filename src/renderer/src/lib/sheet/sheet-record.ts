import type { FormulaValue } from '../formula'
import { computeSheet, createInitialValues, fillResourceCurrents, type SheetSummary } from './context'
import { newId } from './factory'
import { canPatchField, holdsValue, isGmOnly, type SheetAudience } from './permissions'
import {
  findComponentById,
  findComponentByKey,
  type SheetSchema,
  type SheetTemplate,
  type SheetTemplateVersion
} from './types'
import { migrateValues, type SheetValue, type SheetValues } from './values'

/**
 * A ficha preenchida (seção 5.7).
 *
 * O formato segue de perto a tabela `sheets` da seção 10.1, porque na Fase 5 este mesmo
 * objeto passa a ser uma linha do Postgres: `values` é o jsonb compartilhado, `gmValues`
 * é a tabela `sheet_gm_data` (que o jogador nem recebe), `computed` e `summary` são o
 * cache que o banco copia para os tokens, e `orphaned` guarda o que saiu do modelo.
 */

export type SheetKind = 'character' | 'creature_instance'

export interface SheetRecord {
  id: string
  templateId: string
  /** Guardado junto para a lista não precisar carregar o modelo inteiro. */
  templateName: string
  /** Versão **publicada** à qual a ficha está presa. */
  templateVersion: number
  kind: SheetKind
  /** Dono da ficha. Vira `owner_id` quando as contas existirem (Fase 4). */
  ownerName: string
  values: SheetValues
  /** Campos "só mestre", separados para o jogador nunca recebê-los (5.7). */
  gmValues: SheetValues
  /** Cache dos campos calculados (5.6). */
  computed: Record<string, FormulaValue>
  /** Resumo dos papéis. Vai para a coluna `bars` e daí para os tokens (5.6). */
  summary: SheetSummary
  /** Valores de componentes que saíram do modelo: guardados, escondidos (5.7). */
  orphaned: SheetValues
  createdAt: string
  updatedAt: string
}

/**
 * Alteração de alguns campos, nunca da ficha inteira (5.7).
 *
 * Separado em duas tabelas porque é assim que vai para o banco. Se o mestre aplicar dano
 * enquanto o jogador mexe no inventário, cada um grava só o seu campo e nada se perde.
 */
export interface SheetPatch {
  values?: Record<string, SheetValue>
  gmValues?: Record<string, SheetValue>
}

/** Divide os valores entre a tabela compartilhada e a do mestre. */
export function splitValues(
  schema: SheetSchema,
  values: SheetValues
): { values: SheetValues; gmValues: SheetValues } {
  const shared: SheetValues = {}
  const gmOnly: SheetValues = {}

  for (const [id, value] of Object.entries(values)) {
    const component = findComponentById(schema, id)
    if (component === undefined) continue
    if (isGmOnly(component)) gmOnly[id] = value
    else shared[id] = value
  }

  return { values: shared, gmValues: gmOnly }
}

/** A ficha como as fórmulas precisam ver: as duas tabelas juntas. */
export function mergedValues(sheet: SheetRecord): SheetValues {
  // Os ids não se repetem entre as duas tabelas, então a ordem não importa.
  return { ...sheet.values, ...sheet.gmValues }
}

export interface CreateSheetRecordInput {
  template: SheetTemplate
  version: SheetTemplateVersion
  ownerName: string
  kind?: SheetKind
}

/** Ficha nova a partir de uma versão publicada do modelo. */
export function createSheetRecord(input: CreateSheetRecordInput): SheetRecord {
  const schema = input.version.schema
  const { values, gmValues } = splitValues(schema, createInitialValues(schema))
  const now = new Date().toISOString()

  return recomputeSheet(
    {
      id: newId('sheet'),
      templateId: input.template.id,
      templateName: input.template.name,
      templateVersion: input.version.version,
      kind: input.kind ?? 'character',
      ownerName: input.ownerName,
      values,
      gmValues,
      computed: {},
      summary: { bars: {} },
      orphaned: {},
      createdAt: now,
      updatedAt: now
    },
    schema
  )
}

/** Recalcula o cache dos calculados e o resumo dos papéis (5.6). */
export function recomputeSheet(sheet: SheetRecord, schema: SheetSchema): SheetRecord {
  const { computed, summary } = computeSheet(schema, mergedValues(sheet))
  return { ...sheet, computed, summary }
}

/** Monta o patch de um punhado de campos, já roteados pela tabela certa. */
export function buildPatch(schema: SheetSchema, changes: SheetValues): SheetPatch {
  const patch: SheetPatch = {}

  for (const [id, value] of Object.entries(changes)) {
    const component = findComponentById(schema, id)
    if (component === undefined || !holdsValue(component)) continue

    if (isGmOnly(component)) (patch.gmValues ??= {})[id] = value
    else (patch.values ??= {})[id] = value
  }

  return patch
}

/** Campos do patch que quem está pedindo não tem direito de gravar. */
export function rejectedPatchFields(
  schema: SheetSchema,
  patch: SheetPatch,
  audience: SheetAudience
): string[] {
  return patchedIds(patch).filter((id) => !canPatchField(schema, id, audience))
}

export function patchedIds(patch: SheetPatch): string[] {
  return [...Object.keys(patch.values ?? {}), ...Object.keys(patch.gmValues ?? {})]
}

/**
 * Aplica o patch campo a campo e devolve a ficha nova.
 *
 * A tabela de destino de cada campo vem do modelo, não de quem mandou o patch: um campo
 * "só mestre" nunca cai na tabela compartilhada por erro de quem chamou.
 */
export function patchFields(
  sheet: SheetRecord,
  schema: SheetSchema,
  patch: SheetPatch
): SheetRecord {
  const values = { ...sheet.values }
  const gmValues = { ...sheet.gmValues }

  for (const [id, value] of Object.entries({ ...patch.values, ...patch.gmValues })) {
    const component = findComponentById(schema, id)
    // Campo que não existe mais nesta versão do modelo é ignorado em silêncio.
    if (component === undefined || !holdsValue(component)) continue

    if (isGmOnly(component)) {
      gmValues[id] = value
      delete values[id]
    } else {
      values[id] = value
      delete gmValues[id]
    }
  }

  return recomputeSheet(
    { ...sheet, values, gmValues, updatedAt: new Date().toISOString() },
    schema
  )
}

export interface SheetMigrationResult {
  sheet: SheetRecord
  fromVersion: number
  toVersion: number
  /** Rótulos dos campos que entraram agora, para avisar quem abriu a ficha. */
  addedLabels: string[]
  /** Quantos valores ficaram guardados porque o campo saiu do modelo. */
  orphanedCount: number
}

/**
 * Leva a ficha para outra versão do modelo (5.7).
 *
 * Componente novo recebe o padrão; valor de componente que saiu fica guardado em
 * `orphaned` em vez de ser apagado — e volta sozinho se o campo reaparecer numa versão
 * seguinte, porque o id é o mesmo.
 */
export function migrateSheetRecord(
  sheet: SheetRecord,
  schema: SheetSchema,
  toVersion: number
): SheetMigrationResult {
  // O que já estava guardado entra na mistura: um campo que voltou recupera o valor antigo.
  const pool: SheetValues = { ...sheet.orphaned, ...sheet.values, ...sheet.gmValues }
  const migrated = migrateValues(schema, pool)

  const live: SheetValues = {}
  const orphaned: SheetValues = {}
  for (const [id, value] of Object.entries(migrated.values)) {
    if (migrated.orphanedIds.includes(id)) orphaned[id] = value
    else live[id] = value
  }

  // Barra que acabou de nascer começa cheia; as que já existiam não são curadas.
  const filled = fillResourceCurrents(schema, live, migrated.addedIds)
  const { values, gmValues } = splitValues(schema, filled)

  const addedLabels = migrated.addedIds.flatMap((id) => {
    const component = findComponentById(schema, id)
    return component === undefined || component.label === '' ? [] : [component.label]
  })

  return {
    sheet: recomputeSheet(
      {
        ...sheet,
        templateVersion: toVersion,
        values,
        gmValues,
        orphaned,
        updatedAt: new Date().toISOString()
      },
      schema
    ),
    fromVersion: sheet.templateVersion,
    toVersion,
    addedLabels,
    orphanedCount: Object.keys(orphaned).length
  }
}

/**
 * A ficha do jeito que cada um pode recebê-la (5.7).
 *
 * Para o jogador, a tabela do mestre e o cache dos campos só-do-mestre simplesmente não
 * vão: esconder na interface não bastaria, porque o dado já estaria na máquina dele.
 */
export function projectSheetFor(
  schema: SheetSchema,
  sheet: SheetRecord,
  audience: SheetAudience
): SheetRecord {
  if (audience === 'gm') return sheet

  const computed: Record<string, FormulaValue> = {}
  for (const [path, value] of Object.entries(sheet.computed)) {
    const component = findComponentByKey(schema, path.split('.')[0] ?? '')
    if (component !== undefined && !isGmOnly(component)) computed[path] = value
  }

  return { ...sheet, gmValues: {}, orphaned: {}, computed }
}

/** Nome do personagem pelo papel `name` (5.6), ou vazio se o modelo não tiver um. */
export function sheetNameOf(sheet: SheetRecord): string {
  return sheet.summary.name?.trim() ?? ''
}

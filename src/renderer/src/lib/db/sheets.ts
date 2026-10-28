import {
  computeSheet,
  createSheetRecord,
  mergedValues,
  migrateSheetRecord,
  parseSheetSchema,
  patchFields,
  recomputeSheet,
  SheetPermissionError,
  splitComputed,
  type SheetMigrationResult,
  type SheetRecord,
  type SheetRepository,
  type SheetSchema,
  type SheetSummaryRow,
  type SheetTemplate,
  type SheetValues
} from '@/lib/sheet'
import { getSupabase } from './client'
import type { Json } from './database.types'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'
import { sheetFromRow, summaryRowFromRow } from './sheet-rows'

/**
 * Fichas no Supabase (seção 5.7), atrás da mesma interface que a ficha preenchível já
 * usava com o armazenamento local.
 *
 * Toda escrita passa pelas RPCs: `patch_sheet` grava só os campos alterados e confere no
 * servidor quem pode mexer em cada um; `rewrite_sheet` (só o mestre) leva a ficha para
 * uma versão nova do modelo.
 */

const SHEET_COLUMNS =
  'id, session_id, owner_id, template_id, template_version, template_name, kind, values, computed, summary, created_at, updated_at, owner:profiles!sheets_owner_id_fkey(display_name), sheet_gm_data(values, computed, orphaned)'

const LIST_COLUMNS =
  'id, session_id, owner_id, template_id, template_name, template_version, summary, updated_at, owner:profiles!sheets_owner_id_fkey(display_name), session:sessions!sheets_session_id_fkey(name)'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

const asJson = (value: unknown): Json => value as Json

interface Caches {
  computed: Json
  gmComputed: Json
  summary: Json
}

/** O cache que vai junto com cada gravação: calculados (divididos) e resumo dos papéis. */
function cachesOf(schema: SheetSchema, values: SheetValues): Caches {
  const { computed, summary } = computeSheet(schema, values)
  const { shared, gmOnly } = splitComputed(schema, computed)
  return { computed: asJson(shared), gmComputed: asJson(gmOnly), summary: asJson(summary) }
}

export function createSupabaseSheetRepository(): SheetRepository {
  // Versão publicada é imutável: depois de buscada, vale para sempre.
  const schemaCache = new Map<string, SheetSchema>()
  // Última ficha conhecida de cada id, para montar o cache da próxima gravação.
  const known = new Map<string, SheetRecord>()

  async function fetchSheet(id: string): Promise<SheetRecord | null> {
    const { data, error } = await getSupabase()
      .from('sheets')
      .select(SHEET_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error !== null) throw fail(error)
    if (data === null) return null

    const sheet = sheetFromRow(data)
    if (sheet === null) throw new FriendlyError('Esta ficha está com dados ilegíveis.')
    known.set(id, sheet)
    return sheet
  }

  async function versionSchema(templateId: string, version: number): Promise<SheetSchema | null> {
    const key = `${templateId}#${version}`
    const cached = schemaCache.get(key)
    if (cached !== undefined) return cached

    const { data, error } = await getSupabase()
      .from('sheet_template_versions')
      .select('schema')
      .eq('template_id', templateId)
      .eq('version', version)
      .maybeSingle()
    if (error !== null) throw fail(error)
    const schema = data === null ? null : parseSheetSchema(data.schema)
    if (schema !== null) schemaCache.set(key, schema)
    return schema
  }

  async function latestVersion(
    templateId: string
  ): Promise<{ version: number; schema: SheetSchema } | null> {
    const { data, error } = await getSupabase()
      .from('sheet_template_versions')
      .select('version, schema')
      .eq('template_id', templateId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error !== null) throw fail(error)
    if (data === null) return null
    const schema = parseSheetSchema(data.schema)
    if (schema === null) return null
    schemaCache.set(`${templateId}#${data.version}`, schema)
    return { version: data.version, schema }
  }

  async function isGmOf(sessionId: string): Promise<boolean> {
    const { data, error } = await getSupabase().rpc('is_gm', { p_session_id: sessionId })
    if (error !== null) throw fail(error)
    return data
  }

  /** `null` = nada a migrar; `retry` = a ficha mudou no meio e precisa ser relida. */
  async function migrate(sheet: SheetRecord): Promise<SheetMigrationResult | null | 'retry'> {
    const latest = await latestVersion(sheet.templateId)
    if (latest === null || latest.version <= sheet.templateVersion) return null

    const result = migrateSheetRecord(sheet, latest.schema, latest.version)
    const migrated = result.sheet
    const caches = cachesOf(latest.schema, mergedValues(migrated))

    const { data, error } = await getSupabase().rpc('rewrite_sheet', {
      p_sheet_id: sheet.id,
      p_expected_updated_at: sheet.updatedAt,
      p_template_version: latest.version,
      p_values: asJson(migrated.values),
      p_gm_values: asJson(migrated.gmValues),
      p_orphaned: asJson(migrated.orphaned),
      p_computed: caches.computed,
      p_gm_computed: caches.gmComputed,
      p_summary: caches.summary
    })
    if (error !== null) {
      if (error.code === '40001') return 'retry'
      throw fail(error)
    }

    const saved = { ...migrated, updatedAt: data }
    known.set(sheet.id, saved)
    return { ...result, sheet: saved }
  }

  return {
    list: async (sessionId) => {
      let query = getSupabase()
        .from('sheets')
        .select(LIST_COLUMNS)
        .order('updated_at', { ascending: false })
      if (sessionId !== undefined) query = query.eq('session_id', sessionId)

      const { data, error } = await query
      if (error !== null) throw fail(error)
      return data.map(summaryRowFromRow)
    },

    get: fetchSheet,

    schemaOf: (sheet) => versionSchema(sheet.templateId, sheet.templateVersion),

    create: async (input) => {
      if (input.sessionId === undefined) {
        throw new FriendlyError('Personagem novo precisa de uma sessão.')
      }

      const latest = await latestVersion(input.templateId)
      if (latest === null) {
        throw new FriendlyError('O mestre ainda não publicou uma versão do sistema desta mesa.')
      }

      // Os valores iniciais saem das fórmulas (vida máxima, por exemplo), por isso nascem aqui.
      const template = { id: input.templateId, name: '' } as SheetTemplate
      const record = createSheetRecord({
        template,
        version: { version: latest.version, schema: latest.schema, publishedAt: '' },
        ownerName: input.ownerName
      })
      const caches = cachesOf(latest.schema, mergedValues(record))

      const { data, error } = await getSupabase().rpc('create_character_sheet', {
        p_session_id: input.sessionId,
        p_template_version: latest.version,
        p_values: asJson(record.values),
        p_gm_values: asJson(record.gmValues),
        p_computed: caches.computed,
        p_gm_computed: caches.gmComputed,
        p_summary: caches.summary
      })
      if (error !== null) throw fail(error)

      const created = await fetchSheet(data)
      if (created === null)
        throw new FriendlyError('O personagem foi criado, mas não consegui abri-lo.')
      return created
    },

    patch: async (id, patch, audience) => {
      const sheet = known.get(id) ?? (await fetchSheet(id))
      if (sheet === null) throw new FriendlyError('Ficha não encontrada.')
      const schema = await versionSchema(sheet.templateId, sheet.templateVersion)
      if (schema === null) throw new FriendlyError('O modelo desta ficha não está disponível.')

      // O cache vai junto, calculado com o que esta tela sabe da ficha agora.
      const local = patchFields(sheet, schema, patch)
      const sent = cachesOf(schema, mergedValues(local))
      const isGm = audience === 'gm'

      const supabase = getSupabase()
      const { data, error } = await supabase.rpc('patch_sheet', {
        p_sheet_id: id,
        p_changes: asJson({ ...patch.values, ...patch.gmValues }),
        p_computed: sent.computed,
        p_summary: sent.summary,
        ...(isGm ? { p_gm_computed: sent.gmComputed } : {})
      })
      if (error !== null) {
        if (error.code === '42501' && /Sem permissão/.test(error.message)) {
          throw new SheetPermissionError(
            (error.details ?? '').split(',').filter((field) => field !== '')
          )
        }
        throw fail(error)
      }

      const result = data as {
        values: SheetValues
        gm_values: SheetValues | null
        updated_at: string
      }
      const saved = recomputeSheet(
        {
          ...sheet,
          values: result.values,
          gmValues: result.gm_values ?? sheet.gmValues,
          updatedAt: result.updated_at
        },
        schema
      )
      known.set(id, saved)

      /*
        Se alguém gravou outro campo nesse meio-tempo, o cache mandado acima foi calculado
        sem a alteração dele. Recalcula com o que o banco devolveu e, se mudou, regrava só o
        cache — é determinístico, então converge numa volta.
      */
      const confirmed = cachesOf(schema, mergedValues(saved))
      if (
        JSON.stringify(confirmed.computed) !== JSON.stringify(sent.computed) ||
        JSON.stringify(confirmed.summary) !== JSON.stringify(sent.summary)
      ) {
        await supabase.rpc('patch_sheet', {
          p_sheet_id: id,
          p_changes: {},
          p_computed: confirmed.computed,
          p_summary: confirmed.summary,
          ...(isGm ? { p_gm_computed: confirmed.gmComputed } : {})
        })
      }

      return saved
    },

    remove: async (id) => {
      const { error } = await getSupabase().from('sheets').delete().eq('id', id)
      if (error !== null) throw fail(error)
      known.delete(id)
    },

    /**
     * Só o mestre migra: ele é o único que enxerga a ficha inteira (5.7). Para o jogador
     * isto não faz nada — a ficha dele sobe de versão quando o mestre a abrir.
     */
    syncToLatestVersion: async (id) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const sheet = await fetchSheet(id)
        if (sheet === null || sheet.sessionId === undefined) return null
        if (!(await isGmOf(sheet.sessionId))) return null

        const result = await migrate(sheet)
        if (result !== 'retry') return result
        // A ficha mudou durante a migração: relê e tenta mais uma vez.
      }
      return null
    }
  }
}

/**
 * Sobe para a versão nova as fichas desatualizadas de uma sessão. O mestre chama ao abrir a
 * mesa: assim o jogador já encontra a ficha na última versão publicada (5.1), mesmo que o
 * mestre não abra a ficha dele. Devolve quantas mudaram.
 */
export async function migrateOutdatedSheets(
  repository: SheetRepository,
  sheets: readonly SheetSummaryRow[]
): Promise<number> {
  const templateIds = [...new Set(sheets.map((sheet) => sheet.templateId))]
  if (templateIds.length === 0) return 0

  const { data, error } = await getSupabase()
    .from('sheet_template_versions')
    .select('template_id, version')
    .in('template_id', templateIds)
  if (error !== null) return 0

  const latest = new Map<string, number>()
  for (const row of data) {
    latest.set(row.template_id, Math.max(latest.get(row.template_id) ?? 0, row.version))
  }

  let migrated = 0
  for (const sheet of sheets) {
    if ((latest.get(sheet.templateId) ?? 0) <= sheet.templateVersion) continue
    try {
      if ((await repository.syncToLatestVersion(sheet.id)) !== null) migrated += 1
    } catch (error) {
      console.warn('Não consegui atualizar a versão da ficha', sheet.id, error)
    }
  }
  return migrated
}

import type { SheetAudience } from './permissions'
import { parseSheetRecord } from './schema'
import {
  createSheetRecord,
  migrateSheetRecord,
  patchFields,
  rejectedPatchFields,
  type SheetMigrationResult,
  type SheetPatch,
  type SheetRecord
} from './sheet-record'
import type { TemplateRepository } from './repository'
import { publishedVersionOf, type SheetSchema, type SheetTemplate } from './types'

/**
 * As fichas preenchidas (seção 5.7), atrás de uma interface.
 *
 * Na Fase 3 ficam no armazenamento local; na Fase 5 entram as tabelas `sheets` e
 * `sheet_gm_data` com RLS e o RPC `patch_sheet`. As telas não mudam porque conversam só
 * com esta interface — e o `patch` já tem a forma do RPC: recebe só os campos alterados e
 * devolve a ficha recalculada.
 */

export interface SheetSummaryRow {
  id: string
  templateId: string
  templateName: string
  templateVersion: number
  ownerName: string
  /** Nome do personagem pelo papel `name`, ou vazio. */
  name: string
  /** Barras dos papéis, para a lista mostrar a vida sem abrir a ficha. */
  bars: SheetRecord['summary']['bars']
  updatedAt: string
}

export interface CreateSheetInput {
  templateId: string
  ownerName: string
}

export class SheetPermissionError extends Error {
  constructor(public readonly fields: readonly string[]) {
    super('Sem permissão para alterar este campo.')
    this.name = 'SheetPermissionError'
  }
}

export interface SheetRepository {
  list: () => Promise<SheetSummaryRow[]>
  get: (id: string) => Promise<SheetRecord | null>
  /** Esquema da versão publicada à qual a ficha está presa. */
  schemaOf: (sheet: SheetRecord) => Promise<SheetSchema | null>
  /** Cria a ficha a partir da última versão publicada do modelo. */
  create: (input: CreateSheetInput) => Promise<SheetRecord>
  /** Grava só os campos do patch. Recusa o que `audience` não pode alterar. */
  patch: (id: string, patch: SheetPatch, audience: SheetAudience) => Promise<SheetRecord>
  remove: (id: string) => Promise<void>
  /** Puxa a ficha para a última versão publicada, se houver uma mais nova (5.7). */
  syncToLatestVersion: (id: string) => Promise<SheetMigrationResult | null>
}

const STORAGE_KEY = 'cantinho-nerd:sheets'

export function summarizeSheet(sheet: SheetRecord): SheetSummaryRow {
  return {
    id: sheet.id,
    templateId: sheet.templateId,
    templateName: sheet.templateName,
    templateVersion: sheet.templateVersion,
    ownerName: sheet.ownerName,
    name: sheet.summary.name ?? '',
    bars: sheet.summary.bars,
    updatedAt: sheet.updatedAt
  }
}

/**
 * Troca o modelo das fichas locais pelos ids novos (`idMap`: antigo → novo). Usado quando
 * os modelos locais sobem para a conta: sem isso, as fichas apontariam para modelos que não
 * existem mais. Devolve quantas fichas mudaram.
 */
export function relinkLocalSheets(
  idMap: ReadonlyMap<string, string>,
  storage: Storage = globalThis.localStorage
): number {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return 0
  }
  if (raw === null) return 0

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return 0
  }
  if (!Array.isArray(data)) return 0

  let changed = 0
  const relinked = data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) return item
    const sheet = item as { templateId?: unknown }
    const next = typeof sheet.templateId === 'string' ? idMap.get(sheet.templateId) : undefined
    if (next === undefined) return item
    changed += 1
    return { ...sheet, templateId: next }
  })

  if (changed > 0) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(relinked))
    } catch (error) {
      console.error('Não consegui religar as fichas locais aos modelos novos:', error)
      return 0
    }
  }
  return changed
}

/** Implementação local. O armazenamento pode falhar (janela privada), então é tolerante. */
export function createLocalSheetRepository(
  templates: TemplateRepository,
  storage: Storage = globalThis.localStorage
): SheetRepository {
  function readAll(): SheetRecord[] {
    let raw: string | null
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      return []
    }
    if (raw === null) return []

    try {
      const data: unknown = JSON.parse(raw)
      if (!Array.isArray(data)) return []
      // Valida cada ficha: dado corrompido no armazenamento não pode quebrar a tela.
      return data.flatMap((item) => {
        const sheet = parseSheetRecord(item)
        return sheet === null ? [] : [sheet]
      })
    } catch {
      return []
    }
  }

  function writeAll(sheets: readonly SheetRecord[]): void {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(sheets))
    } catch (error) {
      console.error('Não consegui salvar as fichas no armazenamento local:', error)
    }
  }

  function save(sheet: SheetRecord): SheetRecord {
    const sheets = readAll()
    const index = sheets.findIndex((item) => item.id === sheet.id)
    if (index === -1) sheets.push(sheet)
    else sheets[index] = sheet
    writeAll(sheets)
    return sheet
  }

  /*
    Versão publicada é imutável (5.1), então o esquema dela pode ficar em memória para
    sempre. Desde a Fase 4 os modelos vêm do Supabase, e sem isto cada campo editado
    buscaria o modelo inteiro de novo só para conferir permissões.
  */
  const versionCache = new Map<string, SheetSchema>()
  const cacheKey = (templateId: string, version: number): string => `${templateId}#${version}`

  function rememberVersions(template: SheetTemplate): void {
    for (const version of template.versions) {
      versionCache.set(cacheKey(template.id, version.version), version.schema)
    }
  }

  /**
   * Esquema congelado da versão a que a ficha está presa. `fresh` busca de novo: é o que
   * a abertura da ficha usa, para notar quando o modelo foi excluído. O patch, que roda a
   * cada campo, se contenta com o que já foi buscado.
   */
  async function schemaFor(
    sheet: SheetRecord,
    { fresh }: { fresh: boolean }
  ): Promise<SheetSchema | null> {
    const key = cacheKey(sheet.templateId, sheet.templateVersion)
    const cached = versionCache.get(key)
    if (!fresh && cached !== undefined) return cached

    const template = await templates.get(sheet.templateId)
    if (template === null) return null
    rememberVersions(template)
    return versionCache.get(key) ?? null
  }

  async function requireTemplate(templateId: string): Promise<SheetTemplate> {
    const template = await templates.get(templateId)
    if (template === null) throw new Error('Modelo não encontrado.')
    rememberVersions(template)
    return template
  }

  return {
    list: async () => readAll().map(summarizeSheet),

    get: async (id) => readAll().find((sheet) => sheet.id === id) ?? null,

    schemaOf: (sheet) => schemaFor(sheet, { fresh: true }),

    create: async (input) => {
      const template = await requireTemplate(input.templateId)
      const version = publishedVersionOf(template)
      if (version === null) {
        // A ficha fica presa a uma versão imutável (5.1); sem publicar, não há a que prender.
        throw new Error('Publique uma versão do modelo antes de criar fichas com ele.')
      }

      return save(createSheetRecord({ template, version, ownerName: input.ownerName }))
    },

    patch: async (id, patch, audience) => {
      const sheet = readAll().find((item) => item.id === id)
      if (sheet === undefined) throw new Error('Ficha não encontrada.')

      const schema = await schemaFor(sheet, { fresh: false })
      if (schema === null) throw new Error('O modelo desta ficha não está mais disponível.')

      const rejected = rejectedPatchFields(schema, patch, audience)
      if (rejected.length > 0) throw new SheetPermissionError(rejected)

      // Relê de dentro para fora: o patch entra na ficha que está gravada agora, não na
      // que a tela tinha em mãos. É o que impede uma alteração de sobrescrever a outra.
      return save(patchFields(sheet, schema, patch))
    },

    remove: async (id) => {
      writeAll(readAll().filter((sheet) => sheet.id !== id))
    },

    syncToLatestVersion: async (id) => {
      const sheet = readAll().find((item) => item.id === id)
      if (sheet === undefined) return null

      const template = await templates.get(sheet.templateId)
      if (template === null) return null
      rememberVersions(template)

      const latest = publishedVersionOf(template)
      if (latest === null || latest.version <= sheet.templateVersion) return null

      const result = migrateSheetRecord(sheet, latest.schema, latest.version)
      // O nome do modelo também pode ter mudado desde que a ficha foi criada.
      return { ...result, sheet: save({ ...result.sheet, templateName: template.name }) }
    }
  }
}

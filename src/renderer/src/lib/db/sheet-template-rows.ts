import {
  allComponents,
  parseSheetSchema,
  type SheetSchema,
  type SheetTemplate,
  type SheetTemplateSummary,
  type SheetTemplateVersion,
  type TemplateKind
} from '@/lib/sheet'
import type { Json } from './database.types'

/**
 * Conversão entre as linhas de `sheet_templates`/`sheet_template_versions` e os tipos do
 * construtor. Separado do acesso ao banco para ser testado sem rede.
 *
 * O jsonb vem de fora do app (outra versão, edição pelo painel), então todo esquema passa
 * pelo zod antes de chegar numa tela — igual ao que já acontecia com o armazenamento local.
 */

export interface TemplateRow {
  id: string
  name: string
  kind: string
  draft_schema: Json
  created_at: string
  updated_at: string
}

export interface VersionRow {
  version: number
  schema: Json
  published_at: string
}

export function templateKindFrom(value: string): TemplateKind | null {
  return value === 'character' || value === 'creature' ? value : null
}

/** Modelo completo. Linha com rascunho corrompido vira `null` em vez de quebrar a tela. */
export function templateFromRow(
  row: TemplateRow & { sheet_template_versions: VersionRow[] }
): SheetTemplate | null {
  const kind = templateKindFrom(row.kind)
  const draftSchema = parseSheetSchema(row.draft_schema)
  if (kind === null || draftSchema === null) return null

  return {
    id: row.id,
    name: row.name,
    kind,
    draftSchema,
    versions: versionsFromRows(row.sheet_template_versions),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** Resumo da lista da biblioteca: só os números das versões, sem os esquemas. */
export function summaryFromRow(
  row: TemplateRow & { sheet_template_versions: { version: number }[] }
): SheetTemplateSummary | null {
  const kind = templateKindFrom(row.kind)
  const draftSchema = parseSheetSchema(row.draft_schema)
  if (kind === null || draftSchema === null) return null

  const versions = row.sheet_template_versions.map((item) => item.version)
  return {
    id: row.id,
    name: row.name,
    kind,
    publishedVersion: versions.length === 0 ? null : Math.max(...versions),
    componentCount: allComponents(draftSchema).length,
    updatedAt: row.updated_at
  }
}

/** Versões em ordem crescente; uma versão corrompida fica de fora, as outras seguem. */
export function versionsFromRows(rows: readonly VersionRow[]): SheetTemplateVersion[] {
  return [...rows]
    .sort((a, b) => a.version - b.version)
    .flatMap((row) => {
      const schema = parseSheetSchema(row.schema)
      return schema === null
        ? []
        : [{ version: row.version, schema, publishedAt: row.published_at }]
    })
}

/**
 * O esquema vai para uma coluna jsonb. Os tipos do construtor são interfaces sem assinatura
 * de índice, e o TypeScript não as aceita como `Json` sozinho — mas são JSON puro (o próprio
 * zod garante isso ao ler), então a conversão é segura.
 */
export function schemaToJson(schema: SheetSchema): Json {
  return schema as unknown as Json
}

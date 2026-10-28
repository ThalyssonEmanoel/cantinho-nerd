import {
  createEmptySchema,
  createExampleSchema,
  EXAMPLE_TEMPLATE_NAME,
  type SheetTemplate,
  type TemplateRepository
} from '@/lib/sheet'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'
import { isTemplateInUse } from './sessions'
import { schemaToJson, summaryFromRow, templateFromRow } from './sheet-template-rows'

/**
 * Biblioteca de modelos no Supabase (seção 5.1), atrás da mesma interface que o construtor
 * já usava com o armazenamento local. Nenhuma tela mudou para isto entrar.
 *
 * Quem pode ver e mexer em cada modelo é decidido pelo RLS no banco (só o dono); aqui não
 * se filtra por dono de propósito, para não existir uma segunda regra que possa divergir.
 */

const LIST_COLUMNS =
  'id, name, kind, draft_schema, created_at, updated_at, sheet_template_versions(version)'
const FULL_COLUMNS =
  'id, name, kind, draft_schema, created_at, updated_at, sheet_template_versions(version, schema, published_at)'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

const NOT_FOUND = 'Este modelo não existe mais ou não é seu.'

export function createSupabaseTemplateRepository(): TemplateRepository {
  async function fetchTemplate(id: string): Promise<SheetTemplate | null> {
    // Ids antigos (`tpl_…`, do armazenamento local) nunca existem aqui; o banco recusaria
    // o formato com erro, mas a resposta certa é só "não encontrado".
    if (!UUID.test(id)) return null

    const { data, error } = await getSupabase()
      .from('sheet_templates')
      .select(FULL_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error !== null) throw fail(error)
    return data === null ? null : templateFromRow(data)
  }

  /** Atualiza e confere que alguma linha mudou: com RLS, "não é seu" chega como zero linhas. */
  async function updateTemplate(
    id: string,
    change: { name?: string; draft_schema?: ReturnType<typeof schemaToJson> }
  ): Promise<void> {
    if (!UUID.test(id)) throw new FriendlyError(NOT_FOUND)

    const { data, error } = await getSupabase()
      .from('sheet_templates')
      .update(change)
      .eq('id', id)
      .select('id')

    if (error !== null) throw fail(error)
    if (data.length === 0) throw new FriendlyError(NOT_FOUND)
  }

  return {
    list: async () => {
      const { data, error } = await getSupabase()
        .from('sheet_templates')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: true })

      if (error !== null) throw fail(error)
      return data.flatMap((row) => {
        const summary = summaryFromRow(row)
        if (summary === null) console.warn(`Modelo ${row.id} com rascunho inválido; ignorado.`)
        return summary === null ? [] : [summary]
      })
    },

    get: fetchTemplate,

    create: async (input) => {
      const { data, error } = await getSupabase()
        .from('sheet_templates')
        .insert({
          name: input.name.trim(),
          kind: input.kind,
          draft_schema: schemaToJson(input.schema ?? createEmptySchema())
        })
        .select(FULL_COLUMNS)
        .single()

      if (error !== null) throw fail(error)
      const template = templateFromRow(data)
      if (template === null) throw new FriendlyError('O modelo foi criado, mas voltou ilegível.')
      return template
    },

    rename: async (id, name) => {
      await updateTemplate(id, { name: name.trim() })
    },

    saveDraft: async (id, schema) => {
      await updateTemplate(id, { draft_schema: schemaToJson(schema) })
    },

    duplicate: async (id) => {
      const original = await fetchTemplate(id)
      if (original === null) throw new FriendlyError(NOT_FOUND)

      // A cópia começa como rascunho, sem as versões: publicar é decisão do mestre.
      const { data, error } = await getSupabase()
        .from('sheet_templates')
        .insert({
          name: `${original.name} (cópia)`.slice(0, 120),
          kind: original.kind,
          draft_schema: schemaToJson(original.draftSchema)
        })
        .select(FULL_COLUMNS)
        .single()

      if (error !== null) throw fail(error)
      const copy = templateFromRow(data)
      if (copy === null) throw new FriendlyError('A cópia foi criada, mas voltou ilegível.')
      return copy
    },

    remove: async (id) => {
      if (!UUID.test(id)) return
      const { error } = await getSupabase().from('sheet_templates').delete().eq('id', id)
      if (error !== null) throw fail(error)
    },

    publish: async (id) => {
      const { data, error } = await getSupabase().rpc('publish_sheet_template', {
        p_template_id: id
      })
      if (error !== null) throw fail(error)
      return data
    },

    // O banco também impede (chave estrangeira); perguntar antes dá uma mensagem melhor.
    isInUse: (id) => (UUID.test(id) ? isTemplateInUse(id) : Promise.resolve(false))
  }
}

/**
 * Coloca o "Exemplo d20" na conta na primeira vez que a biblioteca abre (5.1). O banco
 * marca a conta junto, então o exemplo não volta depois de excluído. Devolve `true` se
 * criou agora.
 */
export async function seedAccountExampleTemplate(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('seed_example_template', {
    p_name: EXAMPLE_TEMPLATE_NAME,
    p_schema: schemaToJson(createExampleSchema())
  })
  if (error !== null) throw fail(error)
  // A função devolve null quando a conta já tinha recebido o exemplo.
  return (data as string | null) !== null
}

/**
 * Sobe um modelo que vivia só no armazenamento local, com o histórico de versões (as
 * fichas antigas estão presas a essas versões). Devolve o id novo.
 */
export async function importTemplateWithVersions(template: SheetTemplate): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('sheet_templates')
    .insert({
      name: template.name.trim().slice(0, 120) || 'Modelo sem nome',
      kind: template.kind,
      draft_schema: schemaToJson(template.draftSchema),
      created_at: template.createdAt
    })
    .select('id')
    .single()

  if (error !== null) throw fail(error)
  const id = data.id

  if (template.versions.length > 0) {
    const { error: versionsError } = await supabase.from('sheet_template_versions').insert(
      template.versions.map((version) => ({
        template_id: id,
        version: version.version,
        schema: schemaToJson(version.schema),
        published_at: version.publishedAt
      }))
    )

    if (versionsError !== null) {
      // Sem as versões o modelo subiria pela metade; melhor desfazer e avisar.
      await supabase.from('sheet_templates').delete().eq('id', id)
      throw fail(versionsError)
    }
  }

  return id
}

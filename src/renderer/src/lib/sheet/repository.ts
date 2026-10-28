import { createExampleSchema, EXAMPLE_TEMPLATE_NAME } from './example-template'
import { createTemplate, newId } from './factory'
import { parseSheetSchema } from './schema'
import {
  allComponents,
  type SheetSchema,
  type SheetTemplate,
  type SheetTemplateSummary,
  type TemplateKind
} from './types'

/**
 * Biblioteca de modelos do mestre (seção 5.1), atrás de uma interface.
 *
 * Na Fase 2 os modelos ficam no armazenamento local; na Fase 4 entra uma implementação
 * que fala com o Supabase. Como a interface é a mesma, a interface gráfica não muda.
 */

export interface CreateTemplateInput {
  name: string
  kind: TemplateKind
  /** Quando vem preenchido (importação ou duplicação), entra como rascunho. */
  schema?: SheetSchema
}

export interface TemplateRepository {
  list: () => Promise<SheetTemplateSummary[]>
  get: (id: string) => Promise<SheetTemplate | null>
  create: (input: CreateTemplateInput) => Promise<SheetTemplate>
  rename: (id: string, name: string) => Promise<void>
  saveDraft: (id: string, schema: SheetSchema) => Promise<void>
  duplicate: (id: string) => Promise<SheetTemplate>
  remove: (id: string) => Promise<void>
  /** Publica o rascunho como versão imutável e devolve o número dela. */
  publish: (id: string) => Promise<number>
  /**
   * Um modelo em uso por alguma sessão não pode ser excluído (5.1). Sessões só existem a
   * partir da Fase 5, então hoje nada está em uso.
   */
  isInUse: (id: string) => Promise<boolean>
}

const STORAGE_KEY = 'cantinho-nerd:sheet-templates'
const SEEDED_KEY = 'cantinho-nerd:sheet-templates:seeded'

function summarize(template: SheetTemplate): SheetTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    publishedVersion: template.versions.at(-1)?.version ?? null,
    componentCount: allComponents(template.draftSchema).length,
    updatedAt: template.updatedAt
  }
}

/** Implementação local. O armazenamento pode falhar (modo privado), então tudo é tolerante. */
export function createLocalTemplateRepository(
  storage: Storage = globalThis.localStorage
): TemplateRepository {
  function readAll(): SheetTemplate[] {
    let raw: string | null
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      // Armazenamento bloqueado (janela privada, por exemplo): biblioteca vazia.
      return []
    }
    if (raw === null) return []

    try {
      const data: unknown = JSON.parse(raw)
      if (!Array.isArray(data)) return []
      // Valida cada esquema: dado corrompido no armazenamento não pode quebrar a tela.
      return data.flatMap((item) => {
        const template = item as SheetTemplate
        const schema = parseSheetSchema(template.draftSchema)
        if (schema === null) return []
        return [{ ...template, draftSchema: schema }]
      })
    } catch {
      return []
    }
  }

  function writeAll(templates: readonly SheetTemplate[]): void {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(templates))
    } catch (error) {
      console.error('Não consegui salvar os modelos no armazenamento local:', error)
    }
  }

  function update(id: string, change: (template: SheetTemplate) => SheetTemplate): void {
    const templates = readAll()
    const index = templates.findIndex((template) => template.id === id)
    if (index === -1) return
    const current = templates[index] as SheetTemplate
    templates[index] = { ...change(current), updatedAt: new Date().toISOString() }
    writeAll(templates)
  }

  return {
    list: async () => readAll().map(summarize),

    get: async (id) => readAll().find((template) => template.id === id) ?? null,

    create: async (input) => {
      const template = createTemplate(input)
      writeAll([...readAll(), template])
      return template
    },

    rename: async (id, name) => {
      update(id, (template) => ({ ...template, name }))
    },

    saveDraft: async (id, schema) => {
      update(id, (template) => ({ ...template, draftSchema: schema }))
    },

    duplicate: async (id) => {
      const original = readAll().find((template) => template.id === id)
      if (original === null || original === undefined) {
        throw new Error('Modelo não encontrado.')
      }

      const copy: SheetTemplate = {
        ...structuredClone(original),
        id: newId('tpl'),
        name: `${original.name} (cópia)`,
        // A cópia começa como rascunho: publicar é uma decisão do mestre.
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      writeAll([...readAll(), copy])
      return copy
    },

    remove: async (id) => {
      writeAll(readAll().filter((template) => template.id !== id))
    },

    publish: async (id) => {
      const templates = readAll()
      const template = templates.find((item) => item.id === id)
      if (template === undefined) throw new Error('Modelo não encontrado.')

      const version = (template.versions.at(-1)?.version ?? 0) + 1
      update(id, (current) => ({
        ...current,
        versions: [
          ...current.versions,
          {
            version,
            // Congelado: a versão publicada não muda mais, nem se o rascunho mudar.
            schema: structuredClone(current.draftSchema),
            publishedAt: new Date().toISOString()
          }
        ]
      }))
      return version
    },

    isInUse: async () => false
  }
}

/**
 * Coloca o "Exemplo d20" na biblioteca na primeira vez (5.1). A marca de "já semeei" é
 * separada da lista, para o mestre poder excluir o exemplo sem ele voltar sozinho.
 */
export async function seedExampleTemplate(repository: TemplateRepository): Promise<void> {
  let alreadySeeded: boolean
  try {
    alreadySeeded = globalThis.localStorage.getItem(SEEDED_KEY) === '1'
  } catch {
    alreadySeeded = false
  }
  if (alreadySeeded) return

  await repository.create({
    name: EXAMPLE_TEMPLATE_NAME,
    kind: 'character',
    schema: createExampleSchema()
  })

  try {
    globalThis.localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    // Sem armazenamento, o exemplo pode reaparecer; não é problema grave.
  }
}

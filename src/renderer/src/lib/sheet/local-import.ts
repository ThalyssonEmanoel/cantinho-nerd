import { createExampleSchema, EXAMPLE_TEMPLATE_NAME } from './example-template'
import { parseSheetSchema } from './schema'
import type { SheetTemplate } from './types'

/**
 * Modelos de antes das contas (Fases 2 e 3), que viviam só no armazenamento local.
 *
 * Na Fase 4 a biblioteca passa a ser a da conta no Supabase. Para o mestre não perder o
 * que montou, o app oferece enviar esses modelos para a conta — com o histórico de
 * versões, porque as fichas locais estão presas a elas.
 */

export interface LocalImportPlan {
  /** Vão para a conta. */
  upload: SheetTemplate[]
  /** Ficam de fora (e podem ser apagados do armazenamento local). */
  skip: SheetTemplate[]
}

/**
 * O "Exemplo d20" que o app semeou e ninguém mexeu. A conta já ganha o dela, então enviar
 * este só duplicaria.
 */
export function isPristineExample(template: SheetTemplate): boolean {
  if (template.name !== EXAMPLE_TEMPLATE_NAME || template.versions.length > 0) return false

  // Os dois passam pelo zod para a ordem das chaves ser a mesma na comparação.
  const draft = parseSheetSchema(template.draftSchema)
  const pristine = parseSheetSchema(createExampleSchema())
  return draft !== null && JSON.stringify(draft) === JSON.stringify(pristine)
}

export function planLocalImport(templates: readonly SheetTemplate[]): LocalImportPlan {
  const upload: SheetTemplate[] = []
  const skip: SheetTemplate[] = []
  for (const template of templates) {
    if (isPristineExample(template)) skip.push(template)
    else upload.push(template)
  }
  return { upload, skip }
}

import type { TemplateRepository } from '@/lib/sheet'
import {
  createSupabaseTemplateRepository,
  seedAccountExampleTemplate
} from '@/lib/db/sheet-templates'

/**
 * A biblioteca de modelos usada pelo app.
 *
 * Desde a Fase 4 é a da conta, no Supabase. As telas não mudaram com a troca, porque
 * conversam só com a interface `TemplateRepository`.
 */
export const templateRepository: TemplateRepository = createSupabaseTemplateRepository()

/** O "Exemplo d20" entra na conta na primeira vez que a biblioteca abre (5.1). */
export async function ensureExampleTemplate(): Promise<void> {
  await seedAccountExampleTemplate()
}

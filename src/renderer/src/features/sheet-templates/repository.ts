import { createLocalTemplateRepository, type TemplateRepository } from '@/lib/sheet'

/**
 * A biblioteca de modelos usada pelo app.
 *
 * Na Fase 4 este arquivo passa a devolver a implementação que fala com o Supabase; as telas
 * não mudam, porque conversam só com a interface `TemplateRepository`.
 */
export const templateRepository: TemplateRepository = createLocalTemplateRepository()

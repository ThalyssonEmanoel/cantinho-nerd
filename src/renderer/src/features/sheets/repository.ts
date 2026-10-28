import { createLocalSheetRepository, type SheetRepository } from '@/lib/sheet'
import { templateRepository } from '@/features/sheet-templates/repository'

/**
 * As fichas preenchidas usadas pelo app.
 *
 * Na Fase 5 este arquivo passa a devolver a implementação que fala com as tabelas `sheets`
 * e `sheet_gm_data` do Supabase; as telas não mudam, porque conversam só com a interface
 * `SheetRepository`.
 */
export const sheetRepository: SheetRepository = createLocalSheetRepository(templateRepository)

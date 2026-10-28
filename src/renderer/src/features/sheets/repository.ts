import type { SheetRepository } from '@/lib/sheet'
import { createSupabaseSheetRepository } from '@/lib/db/sheets'

/**
 * As fichas preenchidas usadas pelo app.
 *
 * Desde a Fase 5 ficam nas tabelas `sheets` e `sheet_gm_data` do Supabase, dentro das
 * sessões. As telas não mudaram com a troca, porque conversam só com a interface
 * `SheetRepository` — como a Fase 3 já previa.
 */
export const sheetRepository: SheetRepository = createSupabaseSheetRepository()

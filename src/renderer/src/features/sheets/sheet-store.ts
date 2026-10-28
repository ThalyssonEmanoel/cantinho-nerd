import { create } from 'zustand'
import {
  buildPatch,
  mergedValues,
  patchedIds,
  patchFields,
  SheetPermissionError,
  type SheetAudience,
  type SheetMigrationResult,
  type SheetRecord,
  type SheetRepository,
  type SheetSchema,
  type SheetValue,
  type SheetValues
} from '@/lib/sheet'
import { errorMessage } from '@/lib/db/errors'

/**
 * Estado da ficha aberta (seção 5.7).
 *
 * O coração daqui é o salvamento **campo a campo**: cada alteração entra na tela na hora,
 * junta-se às outras por um instante e vai ao repositório como um patch com só os campos
 * que mudaram. A ficha inteira nunca é regravada — na Fase 5, duas pessoas vão editar a
 * mesma ficha ao mesmo tempo, e quem aplicar dano não pode apagar o inventário do outro.
 *
 * Se a gravação for recusada (um campo que só o mestre pode mexer, por exemplo), os campos
 * voltam ao último valor gravado e a tela avisa.
 */

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** `error`: não deu para abrir (sem internet, por exemplo — o modelo vem da conta). */
export type LoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'no-template' | 'error'

/** Espera antes de gravar, para não mandar um patch por tecla digitada. */
const SAVE_DELAY_MS = 400

interface SheetFillState {
  repository: SheetRepository | null
  /** Ficha que a tela pediu. Usado para descartar resposta de uma ficha que já fechou. */
  sheetId: string | null
  sheet: SheetRecord | null
  /** Esquema da versão publicada a que a ficha está presa. */
  schema: SheetSchema | null
  audience: SheetAudience
  activeTabId: string | null
  loadState: LoadState
  saveState: SaveState
  lastError: string | null
  /** Por que a ficha não abriu, quando `loadState` é `error`. */
  loadError: string | null
  /** Campos esperando gravação, por id de componente. */
  pending: SheetValues
  /** Valor gravado de cada campo pendente, para desfazer se a gravação for recusada. */
  rollback: SheetValues
  /** Aviso de que a ficha subiu de versão ao abrir (5.7). */
  migration: SheetMigrationResult | null

  attach: (repository: SheetRepository) => void
  open: (sheetId: string) => Promise<void>
  close: () => void
  setAudience: (audience: SheetAudience) => void
  setActiveTab: (tabId: string) => void
  dismissMigration: () => void
  /** Edita um campo: entra na tela agora e vai para a fila de gravação. */
  changeField: (componentId: string, value: SheetValue) => void
  /** Grava o que está pendente. A tela chama ao sair; o resto é automático. */
  flush: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function clearSaveTimer(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer)
  saveTimer = undefined
}

const emptySheetState = {
  sheetId: null,
  sheet: null,
  schema: null,
  activeTabId: null,
  loadState: 'idle' as LoadState,
  saveState: 'idle' as SaveState,
  lastError: null,
  loadError: null,
  pending: {},
  rollback: {},
  migration: null
}

export const useSheetStore = create<SheetFillState>()((set, get) => {
  function scheduleFlush(): void {
    clearSaveTimer()
    saveTimer = setTimeout(() => {
      void get().flush()
    }, SAVE_DELAY_MS)
  }

  return {
    repository: null,
    audience: 'player',
    ...emptySheetState,

    attach: (repository) => set({ repository }),

    close: () => {
      clearSaveTimer()
      set({ ...emptySheetState })
    },

    setAudience: (audience) => set({ audience }),

    setActiveTab: (activeTabId) => set({ activeTabId }),

    dismissMigration: () => set({ migration: null }),

    open: async (sheetId) => {
      const { repository } = get()
      if (repository === null) return

      clearSaveTimer()
      set({ ...emptySheetState, sheetId, loadState: 'loading' })

      try {
        // O jogador usa sempre a última versão publicada (5.1), então a ficha é puxada para
        // ela ao abrir; quem avisa o que mudou é o `migration`.
        const migration = await repository.syncToLatestVersion(sheetId)
        const sheet = migration?.sheet ?? (await repository.get(sheetId))
        // Trocou de ficha (ou fechou a tela) enquanto isso: a resposta velha é descartada.
        if (get().sheetId !== sheetId) return
        if (sheet === null) {
          set({ loadState: 'missing' })
          return
        }

        const schema = await repository.schemaOf(sheet)
        if (get().sheetId !== sheetId) return
        if (schema === null) {
          // O modelo foi excluído: a ficha continua guardada, mas não há como desenhá-la.
          set({ sheet, loadState: 'no-template' })
          return
        }

        set({
          sheet,
          schema,
          migration,
          activeTabId: schema.tabs[0]?.id ?? null,
          loadState: 'ready'
        })
      } catch (error) {
        // Desde a Fase 4 o modelo vem da conta: sem rede, a tela explica em vez de girar
        // para sempre.
        if (get().sheetId !== sheetId) return
        set({ loadState: 'error', loadError: errorMessage(error) })
      }
    },

    changeField: (componentId, value) => {
      const { sheet, schema, pending, rollback } = get()
      if (sheet === null || schema === null) return

      const patch = buildPatch(schema, { [componentId]: value })
      // Campo decorativo, calculado ou que não existe no modelo: não há o que gravar.
      if (patchedIds(patch).length === 0) return

      const previous = mergedValues(sheet)[componentId]

      set({
        sheet: patchFields(sheet, schema, patch),
        pending: { ...pending, [componentId]: value },
        // O valor para voltar é o que estava gravado, não o do último toque de tecla.
        rollback:
          componentId in rollback || previous === undefined
            ? rollback
            : { ...rollback, [componentId]: previous },
        saveState: 'dirty'
      })

      scheduleFlush()
    },

    flush: async () => {
      clearSaveTimer()
      const { repository, sheet, schema, pending, rollback, audience } = get()
      if (repository === null || sheet === null || schema === null) return
      if (Object.keys(pending).length === 0) return

      set({ saveState: 'saving', pending: {} })

      try {
        const saved = await repository.patch(sheet.id, buildPatch(schema, pending), audience)
        // A tela já fechou ou abriu outra ficha: a gravação valeu, mas o estado não é mais
        // desta ficha.
        if (get().sheet?.id !== sheet.id) return

        // Quem digitou durante a gravação não pode ver a tela pular para trás: o que
        // ficou pendente nesse meio-tempo é reaplicado em cima do que voltou do banco.
        const stillPending = get().pending
        const waiting = Object.keys(stillPending).length > 0

        set({
          sheet: waiting ? patchFields(saved, schema, buildPatch(schema, stillPending)) : saved,
          rollback: waiting ? get().rollback : {},
          saveState: waiting ? 'dirty' : 'saved',
          lastError: null
        })

        if (waiting) scheduleFlush()
      } catch (error) {
        const current = get().sheet
        if (current !== null && current.id !== sheet.id) return
        set({
          // Reversão: os campos recusados voltam ao último valor gravado.
          sheet:
            current === null ? null : patchFields(current, schema, buildPatch(schema, rollback)),
          pending: {},
          rollback: {},
          saveState: 'error',
          lastError: describeSaveError(error)
        })
      }
    }
  }
})

function describeSaveError(error: unknown): string {
  if (error instanceof SheetPermissionError) {
    return 'Este campo só o mestre pode alterar.'
  }
  if (error instanceof Error) return error.message
  return 'Não consegui salvar a alteração.'
}

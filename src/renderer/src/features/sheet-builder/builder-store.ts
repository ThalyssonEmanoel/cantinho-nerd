import { create } from 'zustand'
import type { SheetSchema, SheetTemplate, TemplateRepository } from '@/lib/sheet'

/**
 * Estado do construtor de fichas.
 *
 * O Desfazer/Refazer é uma pilha de esquemas inteiros (5.2): como as mudanças devolvem um
 * objeto novo, guardar o esquema anterior é barato e evita a ginástica de desfazer cada
 * tipo de alteração na mão.
 */

/** Teto da pilha: 50 passos cobrem o uso real sem crescer sem limite. */
const MAX_HISTORY = 50

/** Espera antes de salvar o rascunho, para não gravar a cada tecla. */
const SAVE_DELAY_MS = 600

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface BuilderState {
  repository: TemplateRepository | null
  templateId: string | null
  name: string
  template: SheetTemplate | null
  schema: SheetSchema | null
  past: SheetSchema[]
  future: SheetSchema[]
  activeTabId: string | null
  selectedId: string | null
  saveState: SaveState
  previewing: boolean

  attach: (repository: TemplateRepository) => void
  load: (template: SheetTemplate) => void
  reset: () => void

  /** Troca o esquema registrando um passo no histórico. */
  commit: (next: SheetSchema) => void
  /** Troca sem registrar passo (usado durante o arrasto, que vale um passo só no fim). */
  replace: (next: SheetSchema) => void
  /** Registra um passo com um esquema anterior guardado à mão (fim de arrasto). */
  pushHistory: (previous: SheetSchema) => void
  undo: () => void
  redo: () => void

  setName: (name: string) => void
  select: (componentId: string | null) => void
  setActiveTab: (tabId: string) => void
  setPreviewing: (previewing: boolean) => void
  markPublished: (template: SheetTemplate) => void
  saveNow: () => Promise<void>
  /**
   * Grava agora o que estava esperando o atraso do salvamento automático. A tela chama ao
   * sair: sem isto, a última alteração feita a menos de 600 ms se perdia no `reset`.
   */
  flush: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Fila das gravações. Com o banco na rede, duas gravações em voo podem chegar fora de ordem
 * — e o rascunho mais velho ganharia. Uma de cada vez, na ordem em que foram pedidas.
 */
let saveQueue: Promise<void> = Promise.resolve()

interface SaveSnapshot {
  repository: TemplateRepository
  templateId: string
  schema: SheetSchema
  name: string
  template: SheetTemplate | null
}

export const useBuilderStore = create<BuilderState>()((set, get) => {
  /** Agenda a gravação do rascunho. */
  function scheduleSave(): void {
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().saveNow()
    }, SAVE_DELAY_MS)
  }

  async function performSave(snapshot: SaveSnapshot): Promise<void> {
    const { repository, templateId, schema, name, template } = snapshot

    // Nome vazio não vai para o banco (ele recusa); fica valendo o último nome bom.
    const trimmed = name.trim()
    const rename = template !== null && trimmed !== '' && trimmed !== template.name

    if (get().templateId === templateId) set({ saveState: 'saving' })
    try {
      await repository.saveDraft(templateId, schema)
      if (rename) await repository.rename(templateId, trimmed)

      // Outro modelo pode ter sido aberto (ou a tela fechada) enquanto a gravação viajava.
      const current = get()
      if (current.templateId !== templateId) return
      set({
        // Se o mestre mexeu de novo nesse meio-tempo, continua "não salvo".
        saveState: current.saveState === 'saving' ? 'saved' : current.saveState,
        ...(rename && current.template !== null
          ? { template: { ...current.template, name: trimmed } }
          : {})
      })
    } catch (error) {
      console.error('Falha ao salvar o rascunho do modelo:', error)
      if (get().templateId === templateId) set({ saveState: 'error' })
    }
  }

  return {
    repository: null,
    templateId: null,
    name: '',
    template: null,
    schema: null,
    past: [],
    future: [],
    activeTabId: null,
    selectedId: null,
    saveState: 'idle',
    previewing: false,

    attach: (repository) => set({ repository }),

    load: (template) =>
      set({
        template,
        templateId: template.id,
        name: template.name,
        schema: template.draftSchema,
        past: [],
        future: [],
        activeTabId: template.draftSchema.tabs[0]?.id ?? null,
        selectedId: null,
        saveState: 'idle',
        previewing: false
      }),

    reset: () => {
      if (saveTimer !== undefined) clearTimeout(saveTimer)
      saveTimer = undefined
      set({
        template: null,
        templateId: null,
        name: '',
        schema: null,
        past: [],
        future: [],
        activeTabId: null,
        selectedId: null,
        saveState: 'idle',
        previewing: false
      })
    },

    commit: (next) => {
      const { schema, past } = get()
      if (schema === null) return
      set({
        schema: next,
        past: [...past, schema].slice(-MAX_HISTORY),
        future: [],
        saveState: 'dirty'
      })
      scheduleSave()
    },

    replace: (next) => {
      set({ schema: next, saveState: 'dirty' })
      scheduleSave()
    },

    pushHistory: (previous) => {
      const { past, schema } = get()
      // Arrasto que terminou onde começou não merece um passo de Desfazer.
      if (schema === null || JSON.stringify(previous) === JSON.stringify(schema)) return
      set({ past: [...past, previous].slice(-MAX_HISTORY), future: [] })
    },

    undo: () => {
      const { past, future, schema } = get()
      const previous = past.at(-1)
      if (previous === undefined || schema === null) return
      set({
        schema: previous,
        past: past.slice(0, -1),
        future: [schema, ...future].slice(0, MAX_HISTORY),
        saveState: 'dirty'
      })
      scheduleSave()
    },

    redo: () => {
      const { past, future, schema } = get()
      const next = future[0]
      if (next === undefined || schema === null) return
      set({
        schema: next,
        past: [...past, schema].slice(-MAX_HISTORY),
        future: future.slice(1),
        saveState: 'dirty'
      })
      scheduleSave()
    },

    setName: (name) => {
      set({ name, saveState: 'dirty' })
      scheduleSave()
    },

    select: (componentId) => set({ selectedId: componentId }),

    setActiveTab: (tabId) => set({ activeTabId: tabId, selectedId: null }),

    setPreviewing: (previewing) => set({ previewing }),

    markPublished: (template) => set({ template }),

    saveNow: () => {
      if (saveTimer !== undefined) clearTimeout(saveTimer)
      saveTimer = undefined

      // O retrato é tirado agora, e não quando a vez dele chegar na fila: assim a tela pode
      // sair (e o store ser limpo) logo depois, e o que foi pedido ainda chega ao banco.
      const { repository, templateId, schema, name, template } = get()
      if (repository === null || templateId === null || schema === null) return saveQueue

      const run = saveQueue.then(() =>
        performSave({ repository, templateId, schema, name, template })
      )
      saveQueue = run.catch(() => undefined)
      return run
    },

    flush: async () => {
      if (saveTimer === undefined) return
      await get().saveNow()
    }
  }
})

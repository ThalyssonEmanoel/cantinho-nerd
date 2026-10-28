import { duplicateComponent, newId, takenKeysOf } from './factory'
import type { GridPosition, SheetComponent, SheetSchema, SheetTab } from './types'

/**
 * Mudanças no esquema, sempre devolvendo um esquema novo.
 *
 * Ficam fora dos componentes React (e fora do store) para poderem ser testadas sozinhas —
 * é o que a regra de "lógica pura com testes" pede. Imutabilidade também é o que faz o
 * Desfazer/Refazer do construtor ser só uma pilha de esquemas.
 */

export function addComponent(
  schema: SheetSchema,
  tabId: string,
  component: SheetComponent
): SheetSchema {
  return {
    ...schema,
    tabs: schema.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, components: [...tab.components, component] } : tab
    )
  }
}

export function updateComponent(
  schema: SheetSchema,
  componentId: string,
  change: (component: SheetComponent) => SheetComponent
): SheetSchema {
  return {
    ...schema,
    tabs: schema.tabs.map((tab) => ({
      ...tab,
      components: tab.components.map((component) =>
        component.id === componentId ? change(component) : component
      )
    }))
  }
}

export function removeComponent(schema: SheetSchema, componentId: string): SheetSchema {
  return {
    ...schema,
    tabs: schema.tabs.map((tab) => ({
      ...tab,
      components: tab.components.filter((component) => component.id !== componentId)
    }))
  }
}

/** Duplica um componente dentro da mesma aba, com id e chave novos. */
export function duplicateComponentInSchema(
  schema: SheetSchema,
  componentId: string
): { schema: SheetSchema; componentId: string | null } {
  const tab = schema.tabs.find((item) => item.components.some((c) => c.id === componentId))
  const original = tab?.components.find((component) => component.id === componentId)
  if (tab === undefined || original === undefined) return { schema, componentId: null }

  const copy = duplicateComponent(original, takenKeysOf(schema))
  return { schema: addComponent(schema, tab.id, copy), componentId: copy.id }
}

/** Aplica as posições que vieram da grade arrastável. */
export function applyLayouts(
  schema: SheetSchema,
  tabId: string,
  layouts: readonly (GridPosition & { id: string })[]
): SheetSchema {
  const byId = new Map(layouts.map((layout) => [layout.id, layout]))

  return {
    ...schema,
    tabs: schema.tabs.map((tab) =>
      tab.id !== tabId
        ? tab
        : {
            ...tab,
            components: tab.components.map((component) => {
              const layout = byId.get(component.id)
              if (layout === undefined) return component
              return {
                ...component,
                layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h }
              }
            })
          }
    )
  }
}

export function addTab(schema: SheetSchema, label: string): { schema: SheetSchema; tab: SheetTab } {
  const tab: SheetTab = { id: newId('tab'), label, components: [] }
  return { schema: { ...schema, tabs: [...schema.tabs, tab] }, tab }
}

export function renameTab(schema: SheetSchema, tabId: string, label: string): SheetSchema {
  return {
    ...schema,
    tabs: schema.tabs.map((tab) => (tab.id === tabId ? { ...tab, label } : tab))
  }
}

/** Exclui a aba (e o que estiver nela). A última aba não pode ser excluída. */
export function removeTab(schema: SheetSchema, tabId: string): SheetSchema {
  if (schema.tabs.length <= 1) return schema
  return { ...schema, tabs: schema.tabs.filter((tab) => tab.id !== tabId) }
}

export function moveTab(schema: SheetSchema, tabId: string, direction: -1 | 1): SheetSchema {
  const index = schema.tabs.findIndex((tab) => tab.id === tabId)
  const target = index + direction
  if (index === -1 || target < 0 || target >= schema.tabs.length) return schema

  const tabs = [...schema.tabs]
  const [moved] = tabs.splice(index, 1)
  if (moved === undefined) return schema
  tabs.splice(target, 0, moved)
  return { ...schema, tabs }
}

/** Move um componente para outra aba, mantendo o tamanho e indo para o fim. */
export function moveComponentToTab(
  schema: SheetSchema,
  componentId: string,
  targetTabId: string
): SheetSchema {
  const source = schema.tabs.find((tab) => tab.components.some((c) => c.id === componentId))
  const component = source?.components.find((item) => item.id === componentId)
  if (source === undefined || component === undefined || source.id === targetTabId) return schema

  const target = schema.tabs.find((tab) => tab.id === targetTabId)
  if (target === undefined) return schema

  const bottom = target.components.reduce(
    (max, item) => Math.max(max, item.layout.y + item.layout.h),
    0
  )

  return {
    ...schema,
    tabs: schema.tabs.map((tab) => {
      if (tab.id === source.id) {
        return { ...tab, components: tab.components.filter((item) => item.id !== componentId) }
      }
      if (tab.id === targetTabId) {
        return {
          ...tab,
          components: [
            ...tab.components,
            { ...component, layout: { ...component.layout, y: bottom } }
          ]
        }
      }
      return tab
    })
  }
}

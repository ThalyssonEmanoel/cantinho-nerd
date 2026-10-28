import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SheetSchema } from '@/lib/sheet'
import { cn } from '@/lib/utils'

interface TabsBarProps {
  schema: SheetSchema
  activeTabId: string | null
  onSelect: (tabId: string) => void
  onAdd: () => void
  onRename: (tabId: string, label: string) => void
  onRemove: (tabId: string) => void
  onMove: (tabId: string, direction: -1 | 1) => void
}

/** Abas do modelo (5.2): criar, renomear, reordenar e excluir. */
export function TabsBar({
  schema,
  activeTabId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onMove
}: TabsBarProps): React.JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function startRename(tabId: string, label: string): void {
    setEditingId(tabId)
    setDraft(label)
  }

  function confirmRename(): void {
    if (editingId !== null && draft.trim() !== '') onRename(editingId, draft.trim())
    setEditingId(null)
  }

  const activeIndex = schema.tabs.findIndex((tab) => tab.id === activeTabId)

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
      {schema.tabs.map((tab) =>
        editingId === tab.id ? (
          <Input
            key={tab.id}
            autoFocus
            className="h-7 w-32 text-sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={confirmRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirmRename()
              if (event.key === 'Escape') setEditingId(null)
            }}
          />
        ) : (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => startRename(tab.id, tab.label)}
            title="Clique duplo para renomear"
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors',
              tab.id === activeTabId
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
          >
            {tab.label === '' ? 'Sem nome' : tab.label}
            <span className="text-muted-foreground/60 text-xs">{tab.components.length}</span>
          </button>
        )
      )}

      <Button variant="ghost" size="icon" className="size-7" onClick={onAdd} aria-label="Nova aba">
        <Plus className="size-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={activeTabId === null || activeIndex <= 0}
          onClick={() => activeTabId !== null && onMove(activeTabId, -1)}
          aria-label="Mover aba para a esquerda"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={activeTabId === null || activeIndex === schema.tabs.length - 1}
          onClick={() => activeTabId !== null && onMove(activeTabId, 1)}
          aria-label="Mover aba para a direita"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={activeTabId === null}
          onClick={() => {
            const tab = schema.tabs.find((item) => item.id === activeTabId)
            if (tab !== undefined) startRename(tab.id, tab.label)
          }}
          aria-label="Renomear aba"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={activeTabId === null || schema.tabs.length <= 1}
          onClick={() => activeTabId !== null && onRemove(activeTabId)}
          aria-label="Excluir aba"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

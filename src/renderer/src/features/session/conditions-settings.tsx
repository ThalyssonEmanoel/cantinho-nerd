import { useState } from 'react'
import { Plus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  conditionListProblem,
  DEFAULT_CONDITIONS,
  MAX_CONDITION_ICON,
  MAX_CONDITION_NAME,
  MAX_CONDITIONS,
  type ConditionDef
} from '@/lib/board'

interface DraftRow extends ConditionDef {
  /** Só da tela: a chave de verdade sai do nome ao salvar, e muda enquanto se digita. */
  rowId: number
}

let nextRowId = 0

function toRows(list: readonly ConditionDef[]): DraftRow[] {
  return list.map((item) => {
    nextRowId += 1
    return { ...item, rowId: nextRowId }
  })
}

interface ConditionsSettingsProps {
  conditions: readonly ConditionDef[]
  busy: boolean
  onSave: (list: ConditionDef[]) => void
}

/**
 * A lista de condições da mesa (6.3): nome e ícone (um emoji) de cada uma. É a lista que
 * aparece ao pôr condições num token. O app não sabe o que nenhuma faz — é só o rótulo.
 *
 * Quem monta isto passa uma `key` com a lista salva, então depois de salvar (ou de outra
 * janela mudar) o rascunho recomeça do que está no banco.
 */
export function ConditionsSettings({
  conditions,
  busy,
  onSave
}: ConditionsSettingsProps): React.JSX.Element {
  const [rows, setRows] = useState<DraftRow[]>(() => toRows(conditions))

  const list: ConditionDef[] = rows.map(({ key, name, icon }) => ({ key, name, icon }))
  const problem = conditionListProblem(list)
  const changed =
    JSON.stringify(list.map(({ name, icon }) => [name.trim(), icon.trim()])) !==
    JSON.stringify(conditions.map(({ name, icon }) => [name, icon]))

  function update(rowId: number, patch: Partial<ConditionDef>): void {
    setRows(rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2">
      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {rows.map((row) => (
          <li key={row.rowId} className="flex items-center gap-1.5">
            <Input
              value={row.icon}
              maxLength={MAX_CONDITION_ICON}
              onChange={(event) => update(row.rowId, { icon: event.target.value })}
              className="h-8 w-12 px-1 text-center text-base"
              aria-label={`Ícone de ${row.name || 'condição nova'}`}
            />
            <Input
              value={row.name}
              maxLength={MAX_CONDITION_NAME}
              onChange={(event) => update(row.rowId, { name: event.target.value })}
              className="h-8 flex-1"
              placeholder="Nome da condição"
              aria-label="Nome da condição"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setRows(rows.filter((item) => item.rowId !== row.rowId))}
              aria-label={`Tirar ${row.name || 'condição'} da lista`}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-muted-foreground text-sm">
            Nenhuma condição: os tokens ficam sem a opção.
          </li>
        )}
      </ul>

      {problem !== null && <p className="text-destructive text-xs">{problem}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length >= MAX_CONDITIONS}
          onClick={() => setRows([...rows, ...toRows([{ key: '', name: '', icon: '⭐' }])])}
        >
          <Plus className="size-4" />
          Adicionar condição
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRows(toRows(DEFAULT_CONDITIONS))}>
          <RotateCcw className="size-4" />
          Lista padrão
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          disabled={busy || problem !== null || !changed}
          onClick={() => onSave(list)}
        >
          Salvar condições
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Tirar uma condição da lista não a tira dos tokens que já estão com ela.
      </p>
    </div>
  )
}

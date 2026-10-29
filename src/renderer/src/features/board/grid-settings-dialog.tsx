import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ColorPicker } from '@/components/color-picker'
import {
  clampGridSize,
  DEFAULT_GRID,
  DIAGONAL_LABELS,
  normalizeGrid,
  type BoardMap,
  type DiagonalRule,
  type GridSettings,
  type SessionScale
} from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import { updateMapGrid } from '@/lib/db/maps'
import { setSessionScale } from '@/lib/db/sessions'
import { useSessionStore } from '@/features/session/session-store'
import { useBoardStore } from './board-store'

interface GridSettingsDialogProps {
  open: boolean
  map: BoardMap
  scale: SessionScale
  onClose: () => void
}

/**
 * Grade e escala (6.2). Só o mestre abre, e o que ele muda todos passam a ver.
 *
 * A grade é **do mapa** (cada imagem tem o próprio quadriculado); a escala é **da mesa**
 * (metros por quadrado e regra de diagonal valem para a régua e para a névoa).
 */
export function GridSettingsDialog({
  open,
  map,
  scale,
  onClose
}: GridSettingsDialogProps): React.JSX.Element {
  const [grid, setGrid] = useState<GridSettings>(map.grid)
  const [meters, setMeters] = useState(String(scale.metersPerSquare))
  const [diagonal, setDiagonal] = useState<DiagonalRule>(scale.diagonal)
  const [saving, setSaving] = useState(false)

  const change = (patch: Partial<GridSettings>): void =>
    setGrid((current) => normalizeGrid({ ...current, ...patch }))

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      const nextScale: SessionScale = {
        metersPerSquare: Number(meters.replace(',', '.')) || scale.metersPerSquare,
        diagonal
      }

      await updateMapGrid(map.id, grid)
      await setSessionScale(map.sessionId, nextScale)

      // Local na hora; os outros recebem pelo tempo real.
      useBoardStore.setState({
        maps: useBoardStore.getState().maps.map((item) =>
          item.id === map.id ? { ...item, grid } : item
        ),
        scale: nextScale
      })
      await useSessionStore.getState().reload()
      onClose()
    } catch (error) {
      toast.error('Não consegui salvar a grade', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title="Grade e escala"
      description="A grade é deste mapa. A escala vale para a mesa inteira."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={grid.enabled}
            onChange={(event) => change({ enabled: event.target.checked })}
          />
          Mostrar a grade
        </label>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="grade-tamanho">Quadrado (px)</Label>
            <Input
              id="grade-tamanho"
              type="number"
              min={8}
              max={600}
              value={grid.size}
              onChange={(event) => change({ size: clampGridSize(Number(event.target.value)) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade-x">Deslocar X</Label>
            <Input
              id="grade-x"
              type="number"
              value={Math.round(grid.offsetX)}
              onChange={(event) => change({ offsetX: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade-y">Deslocar Y</Label>
            <Input
              id="grade-y"
              type="number"
              value={Math.round(grid.offsetY)}
              onChange={(event) => change({ offsetY: Number(event.target.value) })}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Meça um quadrado da imagem e use o deslocamento para encaixar a grade na que já
          está desenhada no mapa.
        </p>

        <div className="grid grid-cols-2 items-end gap-3">
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <ColorPicker
              value={grid.color}
              onChange={(value) => change({ color: value ?? DEFAULT_GRID.color })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade-opacidade">
              Opacidade: {Math.round(grid.opacity * 100)}%
            </Label>
            <input
              id="grade-opacidade"
              type="range"
              className="accent-primary w-full"
              min={0}
              max={1}
              step={0.05}
              value={grid.opacity}
              onChange={(event) => change({ opacity: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="escala-metros">Metros por quadrado</Label>
            <Input
              id="escala-metros"
              inputMode="decimal"
              value={meters}
              onChange={(event) => setMeters(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="escala-diagonal">Diagonal</Label>
            <Select
              id="escala-diagonal"
              value={diagonal}
              onChange={(event) => setDiagonal(event.target.value as DiagonalRule)}
            >
              {(Object.keys(DIAGONAL_LABELS) as DiagonalRule[]).map((rule) => (
                <option key={rule} value={rule}>
                  {DIAGONAL_LABELS[rule]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

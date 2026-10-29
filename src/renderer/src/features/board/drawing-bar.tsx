import { useState, type ReactNode } from 'react'
import { Circle, Eraser, Pencil, Slash, Square, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/color-picker'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { STROKE_LEVELS, type DrawingTool, type StrokeLevel } from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import type { SessionRole } from '@/lib/db/sessions'
import { useBoardStore } from './board-store'
import { clearAllDrawings, clearMyDrawings, undoLastDrawing } from './drawing-actions'

const SHAPES: ReadonlyArray<{ tool: DrawingTool; label: string; icon: ReactNode }> = [
  { tool: 'pencil', label: 'Lápis', icon: <Pencil className="size-4" /> },
  { tool: 'line', label: 'Linha', icon: <Slash className="size-4" /> },
  { tool: 'circle', label: 'Círculo', icon: <Circle className="size-4" /> },
  { tool: 'rect', label: 'Retângulo', icon: <Square className="size-4" /> }
]

const LEVEL_NAMES: Record<StrokeLevel, string> = {
  0: 'Fina',
  1: 'Média',
  2: 'Grossa',
  3: 'Bem grossa'
}

/** Tamanho da bolinha que mostra cada espessura no botão. */
const LEVEL_DOTS: Record<StrokeLevel, number> = { 0: 3, 1: 5, 2: 8, 3: 12 }

interface DrawingBarProps {
  role: SessionRole
  userId: string | null
}

/**
 * Segunda linha da barra, só com régua, desenho ou borracha na mão (6.5): forma, cor e
 * espessura do traço, desfazer e apagar.
 */
export function DrawingBar({ role, userId }: DrawingBarProps): React.JSX.Element | null {
  const tool = useBoardStore((state) => state.tool)
  const drawTool = useBoardStore((state) => state.drawTool)
  const drawColor = useBoardStore((state) => state.drawColor)
  const strokeLevel = useBoardStore((state) => state.strokeLevel)
  const hasMine = useBoardStore((state) =>
    state.drawings.some((drawing) => drawing.authorId === userId)
  )
  const hasAny = useBoardStore((state) => state.drawings.length > 0)
  const [confirm, setConfirm] = useState<'mine' | 'all' | null>(null)

  if (tool === 'ruler') {
    return (
      <Bar>
        <p className="text-muted-foreground px-1 text-xs">
          Arraste para medir em metros, pela escala e pela diagonal da mesa. Com a grade ligada,
          a régua vai de centro a centro de quadrado — segure <Kbd>Shift</Kbd> para medir
          livre. Todos veem a medição enquanto você segura.
        </p>
      </Bar>
    )
  }

  if (tool !== 'draw' && tool !== 'erase') return null

  async function handleClear(): Promise<void> {
    const which = confirm
    setConfirm(null)
    try {
      if (which === 'all') await clearAllDrawings()
      else if (which === 'mine' && userId !== null) await clearMyDrawings(userId)
    } catch (error) {
      toast.error('Não consegui apagar os desenhos', { description: errorMessage(error) })
    }
  }

  return (
    <Bar>
      {tool === 'draw' ? (
        <>
          <div className="flex items-center gap-0.5" role="group" aria-label="Forma">
            {SHAPES.map((shape) => (
              <Button
                key={shape.tool}
                variant={drawTool === shape.tool ? 'secondary' : 'ghost'}
                size="icon"
                className="size-8"
                onClick={() => useBoardStore.getState().setDrawTool(shape.tool)}
                aria-label={shape.label}
                aria-pressed={drawTool === shape.tool}
                title={shape.label}
              >
                {shape.icon}
              </Button>
            ))}
          </div>

          <Divider />

          <ColorPicker
            value={drawColor}
            onChange={(color) => {
              if (color !== undefined) useBoardStore.getState().setDrawColor(color)
            }}
            aria-label="Cor do traço"
          />

          <div className="flex items-center gap-0.5" role="group" aria-label="Espessura">
            {STROKE_LEVELS.map((level) => (
              <Button
                key={level}
                variant={strokeLevel === level ? 'secondary' : 'ghost'}
                size="icon"
                className="size-8"
                onClick={() => useBoardStore.getState().setStrokeLevel(level)}
                aria-label={`Espessura ${LEVEL_NAMES[level].toLowerCase()}`}
                aria-pressed={strokeLevel === level}
                title={`Espessura: ${LEVEL_NAMES[level].toLowerCase()} (acompanha o tamanho do quadrado)`}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: LEVEL_DOTS[level],
                    height: LEVEL_DOTS[level],
                    background: drawColor
                  }}
                />
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
          <Eraser className="size-3.5" />
          Passe sobre um traço para apagá-lo inteiro.
          {role === 'player' && ' Você apaga só os seus.'}
        </p>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasMine}
          onClick={() => {
            void undoLastDrawing(userId).catch((error: unknown) => {
              toast.error('Não consegui desfazer', { description: errorMessage(error) })
            })
          }}
          title="Desfaz o seu último traço (Ctrl+Z)"
        >
          <Undo2 className="size-4" />
          Desfazer
        </Button>
        <Button variant="ghost" size="sm" disabled={!hasMine} onClick={() => setConfirm('mine')}>
          <Eraser className="size-4" />
          Apagar meus desenhos
        </Button>
        {role === 'gm' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={!hasAny}
            onClick={() => setConfirm('all')}
          >
            <Trash2 className="size-4" />
            Limpar todos
          </Button>
        )}
      </div>

      <Dialog
        open={confirm !== null}
        title={confirm === 'all' ? 'Limpar todos os desenhos?' : 'Apagar os seus desenhos?'}
        description={
          confirm === 'all'
            ? 'Somem os desenhos de todo mundo neste mapa. Não tem como desfazer.'
            : 'Somem todos os traços que você fez neste mapa. Não tem como desfazer.'
        }
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleClear()}>
              {confirm === 'all' ? 'Limpar todos' : 'Apagar os meus'}
            </Button>
          </>
        }
      />
    </Bar>
  )
}

function Bar({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="bg-card/40 flex flex-wrap items-center gap-1.5 border-b px-2 py-1">
      {children}
    </div>
  )
}

function Divider(): React.JSX.Element {
  return <div className="bg-border mx-1 h-6 w-px" />
}

function Kbd({ children }: { children: ReactNode }): React.JSX.Element {
  return <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">{children}</kbd>
}

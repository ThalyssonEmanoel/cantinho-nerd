import { Circle, Layer, Rect } from 'react-konva'
import {
  measure,
  rulerLabel,
  type BoardMap,
  type Point,
  type Rect as WorldRect
} from '@/lib/board'
import { useBoardStore } from './board-store'
import { DrawingShape, RulerShape } from './drawing-shape'
import { useLiveStore } from './live-store'

/** Raio da borracha, em pixels de tela. */
export const ERASER_RADIUS_PX = 10

/** Cores da régua: a minha, e a dos outros (para não confundir quem está medindo). */
const MY_RULER_COLOR = '#38bdf8'
const OTHER_RULER_COLOR = '#fbbf24'

/**
 * Camada dos desenhos (6.5), entre o mapa e os tokens: os salvos, os que os outros estão
 * desenhando agora e o meu rascunho.
 */
export function DrawingLayer({ mapId }: { mapId: string }): React.JSX.Element {
  const drawings = useBoardStore((state) => state.drawings)
  const strokes = useLiveStore((state) => state.strokes)
  const draft = useLiveStore((state) => state.draft)

  return (
    <Layer listening={false}>
      {drawings.map((drawing) => (
        <DrawingShape
          key={drawing.id}
          tool={drawing.tool}
          points={drawing.points}
          color={drawing.color}
          width={drawing.width}
        />
      ))}
      {Object.values(strokes)
        .filter((stroke) => stroke.mapId === mapId)
        .map((stroke) => (
          <DrawingShape
            key={stroke.id}
            tool={stroke.tool}
            points={stroke.points}
            color={stroke.color}
            width={stroke.width}
            opacity={0.85}
          />
        ))}
      {draft !== null && draft.mapId === mapId && (
        <DrawingShape
          tool={draft.tool}
          points={draft.points}
          color={draft.color}
          width={draft.width}
        />
      )}
    </Layer>
  )
}

interface OverlayLayerProps {
  map: BoardMap
  /** Zoom da câmera. */
  scale: number
  userId: string | null
  /** Caixa de seleção do mestre, em coordenadas do mapa. */
  box: WorldRect | null
  nameOf: (userId: string) => string
}

/** Por cima dos tokens: réguas, o círculo da borracha e a caixa de seleção. */
export function OverlayLayer({
  map,
  scale,
  userId,
  box,
  nameOf
}: OverlayLayerProps): React.JSX.Element {
  const sessionScale = useBoardStore((state) => state.scale)
  const tool = useBoardStore((state) => state.tool)
  const rulers = useLiveStore((state) => state.rulers)
  const myRuler = useLiveStore((state) => state.myRuler)
  const eraser = useLiveStore((state) => state.eraser)

  const label = (from: Point, to: Point): string =>
    rulerLabel(measure(from, to, map.grid, sessionScale))

  return (
    <Layer listening={false}>
      {Object.values(rulers)
        .filter((ruler) => ruler.mapId === map.id && ruler.userId !== userId)
        .map((ruler) => {
          const name = nameOf(ruler.userId)
          const text = label(ruler.from, ruler.to)
          return (
            <RulerShape
              key={ruler.userId}
              from={ruler.from}
              to={ruler.to}
              label={name === '' ? text : `${name}: ${text}`}
              color={OTHER_RULER_COLOR}
              scale={scale}
            />
          )
        })}

      {myRuler !== null && (
        <RulerShape
          from={myRuler.from}
          to={myRuler.to}
          label={label(myRuler.from, myRuler.to)}
          color={MY_RULER_COLOR}
          scale={scale}
        />
      )}

      {tool === 'erase' && eraser !== null && (
        <Circle
          x={eraser.x}
          y={eraser.y}
          radius={ERASER_RADIUS_PX / scale}
          stroke="#f8fafc"
          strokeWidth={1.5 / scale}
          dash={[4 / scale, 3 / scale]}
          fill="#f8fafc22"
        />
      )}

      {box !== null && (
        <Rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="#38bdf822"
          stroke="#38bdf8"
          strokeWidth={1 / scale}
        />
      )}
    </Layer>
  )
}

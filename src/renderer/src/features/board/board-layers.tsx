import { Circle, Layer, Line, Rect } from 'react-konva'
import {
  measure,
  rulerLabel,
  visionCircles,
  type BoardMap,
  type FogShape,
  type Point,
  type Rect as WorldRect
} from '@/lib/board'
import { drawPosition, useBoardStore } from './board-store'
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
  const fogKind = useBoardStore((state) => state.fogKind)
  const fogBrush = useBoardStore((state) => state.fogBrush)

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

      {tool === 'fog' && fogKind === 'brush' && eraser !== null && (
        <Circle
          x={eraser.x}
          y={eraser.y}
          radius={fogBrush * map.grid.size}
          stroke="#f8fafc"
          strokeWidth={1.5 / scale}
          dash={[4 / scale, 3 / scale]}
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

/** A cor da névoa: o mesmo fundo do tabuleiro, para o escuro parecer "fora do mapa". */
const FOG_COLOR = '#020617'
/** O mestre vê através da névoa (6.4); editando com ela desligada, mais clara ainda. */
const GM_FOG_COLOR = 'rgba(2, 6, 23, 0.55)'
const GM_PREVIEW_COLOR = 'rgba(2, 6, 23, 0.35)'

interface FogLayerProps {
  map: BoardMap
  role: 'gm' | 'player'
  /** Visão padrão da mesa, em metros (6.4). */
  defaultVisionM: number
}

/**
 * A névoa de guerra (6.4), entre os desenhos e os tokens.
 *
 * Tudo numa camada só: um retângulo escuro do tamanho do mapa, as áreas do mestre na ordem
 * (revelar recorta, cobrir pinta de novo) e, por cima, os círculos de visão dos jogadores
 * recortando — com a borda esfumada. O jogador vê a névoa opaca; o mestre, semitransparente.
 *
 * Os círculos seguem a posição do arrasto (o meu e o dos outros pelo canal), então a névoa
 * acompanha o token enquanto ele anda.
 */
export function FogLayer({ map, role, defaultVisionM }: FogLayerProps): React.JSX.Element | null {
  const tokens = useBoardStore((state) => state.tokens)
  const dragging = useBoardStore((state) => state.dragging)
  const sessionScale = useBoardStore((state) => state.scale)
  const tool = useBoardStore((state) => state.tool)
  const draft = useLiveStore((state) => state.fogDraft)

  const isGm = role === 'gm'
  // O mestre vê a névoa enquanto edita, mesmo desligada, para saber o que vai aparecer.
  const editing = isGm && tool === 'fog'
  if (!map.fog.enabled && !editing) return null

  const circles = visionCircles(
    tokens.map((token) => ({ ...token, ...drawPosition(token, dragging) })),
    map.grid,
    sessionScale,
    defaultVisionM
  )
  const shapes = draft === null ? map.fog.shapes : [...map.fog.shapes, draft]
  // Transparência na cor, não em `opacity`: a opacidade da camada também enfraqueceria o
  // recorte, e a área revelada ficaria meio escura para o mestre.
  const color = !isGm ? FOG_COLOR : map.fog.enabled ? GM_FOG_COLOR : GM_PREVIEW_COLOR

  return (
    <Layer listening={false} name="nevoa">
      <Rect width={map.width} height={map.height} fill={color} />
      {shapes.map((shape, index) => (
        <FogShapeNode key={index} shape={shape} color={color} />
      ))}
      {circles.map((circle, index) => (
        <Circle
          key={index}
          x={circle.x}
          y={circle.y}
          radius={circle.radius}
          globalCompositeOperation="destination-out"
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={circle.radius}
          fillRadialGradientColorStops={[0, '#000', 0.8, '#000', 1, 'rgba(0,0,0,0)']}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  )
}

/**
 * Uma área do mestre. Revelar recorta a névoa. Cobrir recorta e pinta de novo: só pintar
 * por cima escureceria a sobreposição na névoa semitransparente do mestre.
 */
function FogShapeNode({ shape, color }: { shape: FogShape; color: string }): React.JSX.Element {
  const cut = <FogPiece shape={shape} color="#000" operation="destination-out" />
  if (shape.mode === 'reveal') return cut
  return (
    <>
      {cut}
      <FogPiece shape={shape} color={color} operation="source-over" />
    </>
  )
}

function FogPiece({
  shape,
  color,
  operation
}: {
  shape: FogShape
  color: string
  operation: 'destination-out' | 'source-over'
}): React.JSX.Element {
  if (shape.kind === 'rect') {
    const [x1 = 0, y1 = 0, x2 = x1, y2 = y1] = shape.points
    return (
      <Rect
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        fill={color}
        globalCompositeOperation={operation}
        perfectDrawEnabled={false}
      />
    )
  }
  const [x = 0, y = 0] = shape.points
  return (
    <Line
      points={shape.points.length === 2 ? [x, y, x + 0.1, y] : shape.points}
      stroke={color}
      strokeWidth={shape.radius * 2}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation={operation}
      perfectDrawEnabled={false}
    />
  )
}

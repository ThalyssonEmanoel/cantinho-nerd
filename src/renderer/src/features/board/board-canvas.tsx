import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Image as KonvaImage, Layer, Rect, Shape, Stage } from 'react-konva'
import { toast } from 'sonner'
import {
  appendPoint,
  byDrawOrder,
  DEFAULT_VISION_M,
  erasableAt,
  finishFogShape,
  finishStroke,
  gridLines,
  rulerPoint,
  samplesAlong,
  shapePoints,
  strokeWidthFor,
  tokenVisibleThroughFog,
  toWorld,
  visibleRect,
  visionCircles,
  type BoardMap,
  type BoardToken,
  type LiveStroke,
  type Point,
  type Rect as WorldRect
} from '@/lib/board'
import { currentEntry } from '@/lib/combat'
import { errorMessage } from '@/lib/db/errors'
import type { SessionRole } from '@/lib/db/sessions'
import { useCombatStore } from '@/features/combat/combat-store'
import { broadcastDrag } from './board-actions'
import { BoardEffects } from './board-effects'
import { DrawingLayer, ERASER_RADIUS_PX, FogLayer, OverlayLayer } from './board-layers'
import { drawPosition, useBoardStore } from './board-store'
import {
  broadcastStroke,
  cancelStroke,
  eraseDrawings,
  newDrawingId,
  saveDrawing,
  sendPing,
  shareRuler
} from './drawing-actions'
import { addFogArea } from './fog-actions'
import { useLiveStore } from './live-store'
import { TokenShape } from './token-shape'
import { useAssetImage } from './use-asset-image'

interface BoardCanvasProps {
  map: BoardMap
  role: SessionRole
  userId: string | null
  onOpenToken: (token: BoardToken) => void
  onTokenMenu: (token: BoardToken, screen: Point) => void
  onBoardMenu: (world: Point, screen: Point) => void
  /** Nome de quem mede ou pinga, para os outros saberem quem foi. */
  nameOf?: (userId: string) => string
  /** Visão padrão da mesa na névoa, em metros (6.4). */
  defaultVisionM?: number
}

/** Quem segura a régua reenvia a cada segundo: parado, ela não some da tela dos outros. */
const RULER_KEEPALIVE_MS = 1000

/** Acima disso, o lápis ao vivo vai simplificado pelo canal (o salvo é sempre simplificado). */
const LIVE_POINTS_LIMIT = 1000

const noName = (): string => ''

/**
 * O tabuleiro (6.1 a 6.3 e 6.5): mapa, grade, desenhos e tokens, com câmera própria de
 * cada um.
 *
 * O Stage inteiro é transladado e escalado pela câmera, então todo desenho aqui está em
 * coordenadas do mapa. É o que garante o aceite da fase: três janelas de tamanhos
 * diferentes mostram os tokens nas mesmas posições.
 */
export function BoardCanvas({
  map,
  role,
  userId,
  onOpenToken,
  onTokenMenu,
  onBoardMenu,
  nameOf = noName,
  defaultVisionM = DEFAULT_VISION_M
}: BoardCanvasProps): React.JSX.Element {
  const container = useRef<HTMLDivElement | null>(null)
  const stage = useRef<Konva.Stage | null>(null)

  const viewport = useBoardStore((state) => state.viewport)
  const camera = useBoardStore((state) => state.cameras[map.id]) ?? { x: 0, y: 0, scale: 1 }
  const tokens = useBoardStore((state) => state.tokens)
  const dragging = useBoardStore((state) => state.dragging)
  const selection = useBoardStore((state) => state.selection)
  const tool = useBoardStore((state) => state.tool)
  const sessionScale = useBoardStore((state) => state.scale)
  const measuring = useLiveStore((state) => state.myRuler !== null)
  // De quem é a vez no combate (7.3): o token ganha brilho.
  const activeTokenId = useCombatStore(
    (state) => currentEntry(state.entries, state.state)?.tokenId ?? null
  )

  const background = useAssetImage(map.imagePath)

  /** Arrasto da mãozinha: ponto da tela onde o botão desceu. */
  const panFrom = useRef<Point | null>(null)
  /** Caixa de seleção, em coordenadas do mapa. */
  const [box, setBox] = useState<WorldRect | null>(null)
  const boxFrom = useRef<Point | null>(null)
  /** Última posição da borracha com o botão apertado. */
  const eraseFrom = useRef<Point | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)

  // A janela manda no tamanho do Stage: o Konva precisa de pixels, não de CSS.
  useEffect(() => {
    const element = container.current
    if (element === null) return

    const measure = (): void => {
      useBoardStore.getState().setViewport({
        width: element.clientWidth,
        height: element.clientHeight
      })
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [map.id])

  // Barra de espaço = mãozinha enquanto segurada (6.1). Esc desiste do traço ou da régua.
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceHeld(true)
      }
      if (event.key === 'Escape') {
        const live = useLiveStore.getState()
        if (live.draft !== null) {
          cancelStroke(live.draft.id)
          live.setDraft(null)
        }
        if (live.myRuler !== null && userId !== null) {
          shareRuler(map.id, userId, live.myRuler.from, null)
          live.setMyRuler(null)
        }
        live.setFogDraft(null)
      }
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [map.id, userId])

  // A régua parada também continua na tela dos outros (6.5): reenvia de tempos em tempos.
  useEffect(() => {
    if (!measuring || userId === null) return
    const timer = setInterval(() => {
      const ruler = useLiveStore.getState().myRuler
      if (ruler !== null) shareRuler(map.id, userId, ruler.from, ruler.to)
    }, RULER_KEEPALIVE_MS)
    return () => clearInterval(timer)
  }, [measuring, map.id, userId])

  const panning = tool === 'pan' || spaceHeld

  /**
   * Para o jogador, monstro (ou NPC, ou objeto) no escuro nem é desenhado (6.4). Conta com a
   * posição do arrasto, então o goblin aparece no instante em que a visão do jogador chega
   * nele, e não só quando o token é solto.
   */
  const shownTokens = (() => {
    if (role === 'gm' || !map.fog.enabled) return tokens
    const placed = tokens.map((token) => ({ token, at: { ...token, ...drawPosition(token, dragging) } }))
    const circles = visionCircles(
      placed.map((item) => item.at),
      map.grid,
      sessionScale,
      defaultVisionM
    )
    return placed
      .filter((item) => tokenVisibleThroughFog(item.at, map.grid, map.fog, circles))
      .map((item) => item.token)
  })()
  const view = visibleRect(camera, viewport)
  const lines = gridLines(map.grid, { width: map.width, height: map.height }, view)

  /** Ponto do mapa sob o cursor. */
  function pointerWorld(): Point | null {
    const position = stage.current?.getPointerPosition()
    return position === null || position === undefined ? null : toWorld(camera, position)
  }

  function canMove(token: BoardToken): boolean {
    // O jogador mexe só nos próprios tokens; o mestre, em todos (6.3).
    return role === 'gm' || token.ownerId === userId
  }

  // --- desenho (6.5) ------------------------------------------------------------------

  function startStroke(world: Point): void {
    if (userId === null) return
    const { drawTool, drawColor, strokeLevel } = useBoardStore.getState()
    const draft: LiveStroke = {
      id: newDrawingId(),
      mapId: map.id,
      authorId: userId,
      tool: drawTool,
      points: drawTool === 'pencil' ? [world.x, world.y] : shapePoints(world, world),
      color: drawColor,
      width: strokeWidthFor(strokeLevel, map.grid)
    }
    useLiveStore.getState().setDraft(draft)
    broadcastStroke(draft)
  }

  function moveStroke(draft: LiveStroke, world: Point): void {
    const points =
      draft.tool === 'pencil'
        ? appendPoint(draft.points, world, 1.5 / camera.scale)
        : shapePoints({ x: draft.points[0] ?? world.x, y: draft.points[1] ?? world.y }, world)
    if (points === draft.points) return

    const next = { ...draft, points }
    useLiveStore.getState().setDraft(next)

    // Um traço de lápis muito longo vai simplificado pelo canal, para caber na mensagem.
    const minSize = 2 / camera.scale
    broadcastStroke(next, (live) =>
      live.length > LIVE_POINTS_LIMIT ? (finishStroke(next.tool, live, minSize) ?? live) : live
    )
  }

  function endStroke(draft: LiveStroke): void {
    useLiveStore.getState().setDraft(null)
    const points = finishStroke(draft.tool, draft.points, 2 / camera.scale)
    if (points === null) {
      cancelStroke(draft.id)
      return
    }
    void saveDrawing({ ...draft, points }).catch((error: unknown) => {
      toast.error('Não consegui salvar o desenho', { description: errorMessage(error) })
    })
  }

  // --- borracha (6.5) -----------------------------------------------------------------

  function eraseAlong(from: Point, to: Point): void {
    const radius = ERASER_RADIUS_PX / camera.scale
    const ids = erasableAt(
      useBoardStore.getState().drawings,
      samplesAlong(from, to, radius),
      radius,
      role,
      userId
    )
    if (ids.length === 0) return
    void eraseDrawings(ids).catch((error: unknown) => {
      toast.error('Não consegui apagar o desenho', { description: errorMessage(error) })
    })
  }

  // --- névoa (6.4, só o mestre) ------------------------------------------------------

  function startFog(world: Point): void {
    const { fogMode, fogKind, fogBrush } = useBoardStore.getState()
    useLiveStore.getState().setFogDraft({
      mode: fogMode,
      kind: fogKind,
      points: fogKind === 'brush' ? [world.x, world.y] : [world.x, world.y, world.x, world.y],
      radius: fogKind === 'brush' ? fogBrush * map.grid.size : 0
    })
  }

  function moveFog(world: Point): void {
    const live = useLiveStore.getState()
    const draft = live.fogDraft
    if (draft === null) return
    const points =
      draft.kind === 'brush'
        ? appendPoint(draft.points, world, 2 / camera.scale)
        : shapePoints({ x: draft.points[0] ?? world.x, y: draft.points[1] ?? world.y }, world)
    if (points !== draft.points) live.setFogDraft({ ...draft, points })
  }

  function endFog(): void {
    const live = useLiveStore.getState()
    const draft = live.fogDraft
    live.setFogDraft(null)
    if (draft === null) return
    const shape = finishFogShape(draft.mode, draft.kind, draft.points, draft.radius, 4 / camera.scale)
    if (shape === null) return
    void addFogArea(map, shape).catch((error: unknown) => {
      toast.error('Não consegui salvar a névoa', { description: errorMessage(error) })
    })
  }

  // --- régua (6.5) --------------------------------------------------------------------

  function moveRuler(world: Point, free: boolean): void {
    const live = useLiveStore.getState()
    const ruler = live.myRuler
    if (ruler === null || userId === null) return
    const to = rulerPoint(world, map.grid, free)
    if (to.x === ruler.to.x && to.y === ruler.to.y) return
    live.setMyRuler({ from: ruler.from, to })
    shareRuler(map.id, userId, ruler.from, to)
  }

  // --- mouse --------------------------------------------------------------------------

  function handleWheel(event: KonvaEventObject<WheelEvent>): void {
    event.evt.preventDefault()
    const position = stage.current?.getPointerPosition()
    if (position === null || position === undefined) return
    // Fator pequeno e exponencial: suave no touchpad e na roda do mouse.
    useBoardStore.getState().zoomAtPoint(position, Math.exp(-event.evt.deltaY * 0.0012))
  }

  function handleMouseDown(event: KonvaEventObject<MouseEvent>): void {
    const isMiddle = event.evt.button === 1
    const onEmpty = event.target === event.target.getStage() || event.target.name() === 'fundo'

    if (isMiddle || (panning && onEmpty)) {
      panFrom.current = { x: event.evt.clientX, y: event.evt.clientY }
      return
    }

    // Alt+clique é o ping (no `onClick`): não começa caixa, traço nem régua.
    if (event.evt.button !== 0 || event.evt.altKey || panning) return
    const world = pointerWorld()
    if (world === null) return

    if (tool === 'draw') {
      startStroke(world)
      return
    }

    if (tool === 'erase') {
      eraseFrom.current = world
      eraseAlong(world, world)
      return
    }

    if (tool === 'fog') {
      if (role === 'gm') startFog(world)
      return
    }

    if (tool === 'ruler') {
      if (userId === null) return
      const from = rulerPoint(world, map.grid, event.evt.shiftKey)
      useLiveStore.getState().setMyRuler({ from, to: from })
      shareRuler(map.id, userId, from, from)
      return
    }

    if (onEmpty) {
      useBoardStore.getState().clearSelection()
      // A caixa de seleção é do mestre (6.3); o jogador seleciona por clique.
      if (role === 'gm') {
        boxFrom.current = world
        setBox({ x: world.x, y: world.y, width: 0, height: 0 })
      }
    }
  }

  function handleMouseMove(event: KonvaEventObject<MouseEvent>): void {
    const from = panFrom.current
    if (from !== null) {
      useBoardStore.getState().pan(event.evt.clientX - from.x, event.evt.clientY - from.y)
      panFrom.current = { x: event.evt.clientX, y: event.evt.clientY }
      return
    }

    const world = pointerWorld()
    if (world === null) return
    const live = useLiveStore.getState()

    if (tool === 'fog') {
      live.setEraser(world)
      moveFog(world)
      return
    }

    if (tool === 'erase') {
      live.setEraser(world)
      const last = eraseFrom.current
      if (last !== null) {
        eraseAlong(last, world)
        eraseFrom.current = world
      }
      return
    }

    if (live.draft !== null) {
      moveStroke(live.draft, world)
      return
    }

    if (live.myRuler !== null) {
      moveRuler(world, event.evt.shiftKey)
      return
    }

    const start = boxFrom.current
    if (start !== null) {
      setBox({
        x: Math.min(start.x, world.x),
        y: Math.min(start.y, world.y),
        width: Math.abs(world.x - start.x),
        height: Math.abs(world.y - start.y)
      })
    }
  }

  function handleMouseUp(): void {
    panFrom.current = null
    eraseFrom.current = null

    const live = useLiveStore.getState()
    if (live.draft !== null) endStroke(live.draft)
    if (live.fogDraft !== null) endFog()
    if (live.myRuler !== null) {
      // A régua existe enquanto o botão está apertado: soltou, some para todos.
      if (userId !== null) shareRuler(map.id, userId, live.myRuler.from, null)
      live.setMyRuler(null)
    }

    const current = box
    boxFrom.current = null
    setBox(null)

    // Caixa de seleção: pega quem estiver dentro dela (6.3).
    if (current === null || current.width < 4 || current.height < 4) return
    const inside = tokens.filter((token) => {
      const side = token.size * map.grid.size
      return (
        token.x < current.x + current.width &&
        current.x < token.x + side &&
        token.y < current.y + current.height &&
        current.y < token.y + side
      )
    })
    useBoardStore.getState().select(inside.map((token) => token.id))
  }

  function handleMouseLeave(): void {
    useLiveStore.getState().setEraser(null)
    handleMouseUp()
  }

  /** Alt+clique: ping para todos (6.5). O Konva não dispara o clique depois de um arrasto. */
  function handleClick(event: KonvaEventObject<MouseEvent>): void {
    if (!event.evt.altKey || event.evt.button !== 0 || userId === null) return
    const world = pointerWorld()
    if (world !== null) sendPing(map.id, userId, world)
  }

  const cursor = panning
    ? 'grab'
    : tool === 'draw' || tool === 'ruler' || tool === 'fog'
      ? 'crosshair'
      : tool === 'erase'
        ? 'none'
        : 'default'

  return (
    <div
      ref={container}
      className="relative size-full overflow-hidden"
      style={{ cursor }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {viewport.width > 0 && (
        <Stage
          ref={stage}
          width={viewport.width}
          height={viewport.height}
          x={camera.x}
          y={camera.y}
          scaleX={camera.scale}
          scaleY={camera.scale}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onContextMenu={(event: KonvaEventObject<PointerEvent>) => {
            event.evt.preventDefault()
            const onEmpty = event.target === event.target.getStage() || event.target.name() === 'fundo'
            const world = pointerWorld()
            if (onEmpty && world !== null) {
              onBoardMenu(world, { x: event.evt.clientX, y: event.evt.clientY })
            }
          }}
        >
          <Layer listening>
            {/* O mapa. O retângulo embaixo marca o tamanho lógico mesmo sem a imagem. */}
            <Rect
              name="fundo"
              width={map.width}
              height={map.height}
              fill="#0b1120"
              stroke="#1e293b"
              strokeWidth={1 / camera.scale}
            />
            {background.image !== null && (
              <KonvaImage
                name="fundo"
                image={background.image}
                width={map.width}
                height={map.height}
              />
            )}

            {map.grid.enabled && (
              <Shape
                sceneFunc={(context, shape) => {
                  context.beginPath()
                  for (const x of lines.vertical) {
                    context.moveTo(x, Math.max(0, view.y))
                    context.lineTo(x, Math.min(map.height, view.y + view.height))
                  }
                  for (const y of lines.horizontal) {
                    context.moveTo(Math.max(0, view.x), y)
                    context.lineTo(Math.min(map.width, view.x + view.width), y)
                  }
                  context.strokeShape(shape)
                }}
                stroke={map.grid.color}
                strokeWidth={1 / camera.scale}
                opacity={map.grid.opacity}
                listening={false}
                perfectDrawEnabled={false}
              />
            )}
          </Layer>

          <DrawingLayer mapId={map.id} />

          <FogLayer map={map} role={role} defaultVisionM={defaultVisionM} />

          <Layer>
            {[...shownTokens].sort(byDrawOrder).map((token) => (
              <TokenShape
                key={token.id}
                token={token}
                grid={map.grid}
                position={drawPosition(token, dragging)}
                selected={selection.includes(token.id)}
                active={token.id === activeTokenId}
                // Com régua, lápis ou borracha na mão, o clique é da ferramenta, não do token.
                draggable={canMove(token) && tool === 'select' && !spaceHeld}
                isGm={role === 'gm'}
                scale={camera.scale}
                onSelect={(event) => {
                  if (tool !== 'select' || event.evt.altKey) return
                  if (event.evt.shiftKey) useBoardStore.getState().toggleSelected(token.id)
                  else useBoardStore.getState().select([token.id])
                }}
                onOpen={() => {
                  if (tool === 'select') onOpenToken(token)
                }}
                onContextMenu={(event) => {
                  event.evt.preventDefault()
                  useBoardStore.getState().select([token.id])
                  onTokenMenu(token, { x: event.evt.clientX, y: event.evt.clientY })
                }}
                onDragMove={(point) => {
                  useBoardStore.getState().dragTo(token.id, point)
                  // Os outros veem o movimento ao vivo (10.3); token oculto não é transmitido.
                  broadcastDrag(token, point)
                }}
                onDragEnd={(point, free) => {
                  void useBoardStore.getState().dropToken(token.id, point, !free)
                }}
              />
            ))}
          </Layer>

          <OverlayLayer
            map={map}
            scale={camera.scale}
            userId={userId}
            box={box}
            nameOf={nameOf}
          />
        </Stage>
      )}

      <BoardEffects map={map} camera={camera} nameOf={nameOf} tokens={shownTokens} />
    </div>
  )
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Image as KonvaImage, Layer, Rect, Shape, Stage } from 'react-konva'
import {
  byDrawOrder,
  gridLines,
  toWorld,
  visibleRect,
  type BoardMap,
  type BoardToken,
  type Point,
  type Rect as WorldRect
} from '@/lib/board'
import type { SessionRole } from '@/lib/db/sessions'
import { broadcastDrag } from './board-actions'
import { drawPosition, useBoardStore } from './board-store'
import { TokenShape } from './token-shape'
import { useAssetImage } from './use-asset-image'

interface BoardCanvasProps {
  map: BoardMap
  role: SessionRole
  userId: string | null
  onOpenToken: (token: BoardToken) => void
  onTokenMenu: (token: BoardToken, screen: Point) => void
  onBoardMenu: (world: Point, screen: Point) => void
}

/**
 * O tabuleiro (6.1 a 6.3): mapa, grade e tokens, com câmera própria de cada um.
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
  onBoardMenu
}: BoardCanvasProps): React.JSX.Element {
  const container = useRef<HTMLDivElement | null>(null)
  const stage = useRef<Konva.Stage | null>(null)

  const viewport = useBoardStore((state) => state.viewport)
  const camera = useBoardStore((state) => state.cameras[map.id]) ?? { x: 0, y: 0, scale: 1 }
  const tokens = useBoardStore((state) => state.tokens)
  const dragging = useBoardStore((state) => state.dragging)
  const selection = useBoardStore((state) => state.selection)
  const tool = useBoardStore((state) => state.tool)

  const background = useAssetImage(map.imagePath)

  /** Arrasto da mãozinha: ponto da tela onde o botão desceu. */
  const panFrom = useRef<Point | null>(null)
  /** Caixa de seleção, em coordenadas do mapa. */
  const [box, setBox] = useState<WorldRect | null>(null)
  const boxFrom = useRef<Point | null>(null)
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

  // Barra de espaço = mãozinha enquanto segurada (6.1).
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !isTyping(event.target)) {
        event.preventDefault()
        setSpaceHeld(true)
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
  }, [])

  const panning = tool === 'pan' || spaceHeld
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

    if (onEmpty && event.evt.button === 0) {
      useBoardStore.getState().clearSelection()
      const world = pointerWorld()
      // A caixa de seleção é do mestre (6.3); o jogador seleciona por clique.
      if (world !== null && !panning && role === 'gm') {
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

    const start = boxFrom.current
    const world = start === null ? null : pointerWorld()
    if (start !== null && world !== null) {
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

  return (
    <div
      ref={container}
      className="relative size-full overflow-hidden"
      style={{ cursor: panning ? 'grab' : 'default' }}
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
          onMouseLeave={handleMouseUp}
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

          <Layer>
            {[...tokens].sort(byDrawOrder).map((token) => (
              <TokenShape
                key={token.id}
                token={token}
                grid={map.grid}
                position={drawPosition(token, dragging)}
                selected={selection.includes(token.id)}
                draggable={canMove(token) && !panning}
                isGm={role === 'gm'}
                scale={camera.scale}
                onSelect={(event) => {
                  if (event.evt.shiftKey) useBoardStore.getState().toggleSelected(token.id)
                  else useBoardStore.getState().select([token.id])
                }}
                onOpen={() => onOpenToken(token)}
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

          {box !== null && (
            <Layer listening={false}>
              <Rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="#38bdf822"
                stroke="#38bdf8"
                strokeWidth={1 / camera.scale}
              />
            </Layer>
          )}
        </Stage>
      )}
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

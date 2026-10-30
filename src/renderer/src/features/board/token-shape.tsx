import { memo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Image as KonvaImage, Rect, Text } from 'react-konva'
import {
  hpColor,
  TOKEN_KIND_COLORS,
  tokenSourceRect,
  visibleBars,
  type BoardToken,
  type GridSettings,
  type Point
} from '@/lib/board'
import { useAssetImage } from '@/hooks/use-asset-image'

interface TokenShapeProps {
  token: BoardToken
  grid: GridSettings
  /** Onde desenhar agora (pode ser a posição do arrasto, não a do banco). */
  position: Point
  selected: boolean
  /** É a vez deste token no combate (7.3): brilho em volta. */
  active?: boolean
  draggable: boolean
  /** O mestre vê o token oculto semitransparente e sempre vê o nome de verdade (6.3). */
  isGm: boolean
  /**
   * Zoom da câmera: o que é medida de tela (moldura, texto) é dividido por ele. Chega
   * arredondado em duas casas, para um giro mínimo da roda não redesenhar 50 tokens.
   */
  scale: number
  onSelect: (event: KonvaEventObject<MouseEvent>) => void
  onDragMove: (point: Point) => void
  onDragEnd: (point: Point, free: boolean) => void
  onOpen: () => void
  onContextMenu: (event: KonvaEventObject<PointerEvent>) => void
}

/**
 * Um token no tabuleiro (6.3): imagem recortada no círculo, moldura colorida por tipo,
 * nome e barras.
 *
 * Tudo em coordenadas do mapa — é o Stage que aplica a câmera —, então o mesmo token
 * aparece no mesmo lugar em qualquer janela.
 */
export const TokenShape = memo(function TokenShape({
  token,
  grid,
  position,
  selected,
  active = false,
  draggable,
  isGm,
  scale,
  onSelect,
  onDragMove,
  onDragEnd,
  onOpen,
  onContextMenu
}: TokenShapeProps): React.JSX.Element {
  const { image } = useAssetImage(token.imagePath)
  const side = Math.max(4, token.size * grid.size)
  const radius = side / 2
  const frame = Math.max(1.5, 2 / scale)

  const crop =
    image === null
      ? null
      : tokenSourceRect(token.crop, {
          width: image.naturalWidth,
          height: image.naturalHeight
        })

  const bars = token.showBars || isGm ? visibleBars(token.bars) : []
  const label = token.showName ? token.name : isGm ? token.name : '???'
  const showLabel = label !== '' && (token.showName || isGm || token.name !== '')

  const fontSize = Math.max(8, 13 / scale)
  const barHeight = Math.max(2, 5 / scale)

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable={draggable}
      opacity={token.hidden ? 0.45 : 1}
      onMouseDown={onSelect}
      onDblClick={onOpen}
      onDblTap={onOpen}
      onContextMenu={onContextMenu}
      onDragMove={(event) => onDragMove({ x: event.target.x(), y: event.target.y() })}
      onDragEnd={(event) =>
        // Alt solta livre, sem encaixar na grade (6.2).
        onDragEnd(
          { x: event.target.x(), y: event.target.y() },
          (event.evt as MouseEvent | undefined)?.altKey === true
        )
      }
    >
      {/* Vez deste token no combate: um anel com brilho, por baixo de tudo. */}
      {active && (
        <Circle
          x={radius}
          y={radius}
          radius={radius + frame * 2.5}
          stroke="#fbbf24"
          strokeWidth={frame * 2}
          shadowColor="#fbbf24"
          shadowBlur={18}
          shadowOpacity={0.9}
          listening={false}
        />
      )}

      {/* Fundo: aparece quando não há imagem e por baixo dela enquanto carrega. É ele
          quem recebe o clique — as molduras por cima ficam fora da detecção. */}
      <Circle x={radius} y={radius} radius={radius} fill="#111827" perfectDrawEnabled={false} />

      {crop !== null && image !== null && (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(radius, radius, radius, 0, Math.PI * 2, false)
            context.closePath()
          }}
        >
          <KonvaImage
            image={image}
            width={side}
            height={side}
            crop={{ x: crop.sx, y: crop.sy, width: crop.sw, height: crop.sh }}
            listening={false}
          />
        </Group>
      )}

      <Circle
        x={radius}
        y={radius}
        radius={radius - frame / 2}
        stroke={TOKEN_KIND_COLORS[token.kind]}
        strokeWidth={frame}
        dash={token.hidden ? [frame * 3, frame * 2] : undefined}
        listening={false}
        perfectDrawEnabled={false}
      />

      {selected && (
        <Circle
          x={radius}
          y={radius}
          radius={radius + frame * 2}
          stroke="#ffffff"
          strokeWidth={frame}
          dash={[frame * 4, frame * 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {bars.map((item, index) => {
        const width = side * (item.bar.max <= 0 ? 0 : Math.min(1, Math.max(0, item.bar.current / item.bar.max)))
        const y = side + index * (barHeight + 1)
        return (
          <Group key={item.key} listening={false}>
            <Rect
              y={y}
              width={side}
              height={barHeight}
              fill="#00000080"
              cornerRadius={barHeight}
              perfectDrawEnabled={false}
            />
            <Rect
              y={y}
              width={width}
              height={barHeight}
              cornerRadius={barHeight}
              fill={item.key === 'hp' ? hpColor(item.bar) : item.key === 'bar2' ? '#60a5fa' : '#c084fc'}
              perfectDrawEnabled={false}
            />
          </Group>
        )
      })}

      <ConditionIcons conditions={token.conditions} side={side} scale={scale} />

      {showLabel && (
        <Text
          y={side + bars.length * (barHeight + 1) + 2}
          width={side}
          align="center"
          text={label}
          fontSize={fontSize}
          fill="#f8fafc"
          stroke="#020617"
          strokeWidth={fontSize / 6}
          fillAfterStrokeEnabled
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
})

/** Quantos ícones cabem em cima do token antes do "+N". */
const MAX_ICONS = 4

/**
 * Condições (6.3) sobre a borda de cima do token: o emoji de cada uma e, se tiver duração,
 * as rodadas que faltam num número pequeno no canto.
 */
function ConditionIcons({
  conditions,
  side,
  scale
}: {
  conditions: BoardToken['conditions']
  side: number
  scale: number
}): React.JSX.Element | null {
  if (conditions.length === 0) return null

  // Tamanho de tela, mas sem passar de metade do token (num token pequeno, longe).
  const size = Math.min(side * 0.45, Math.max(8, 16 / scale))
  const shown = conditions.slice(0, conditions.length > MAX_ICONS ? MAX_ICONS - 1 : MAX_ICONS)
  const hidden = conditions.length - shown.length
  const step = size * 0.95
  const y = -size * 0.6

  return (
    <Group listening={false}>
      {shown.map((item, index) => (
        <Group key={item.key} x={index * step} y={y}>
          <Text text={item.icon} fontSize={size} />
          {item.rounds !== null && (
            <Text
              x={size * 0.55}
              y={size * 0.55}
              text={String(item.rounds)}
              fontSize={size * 0.5}
              fontStyle="bold"
              fill="#fde68a"
              stroke="#020617"
              strokeWidth={size * 0.12}
              fillAfterStrokeEnabled
            />
          )}
        </Group>
      ))}
      {hidden > 0 && (
        <Text
          x={shown.length * step}
          y={y + size * 0.15}
          text={`+${hidden}`}
          fontSize={size * 0.7}
          fontStyle="bold"
          fill="#f8fafc"
          stroke="#020617"
          strokeWidth={size * 0.12}
          fillAfterStrokeEnabled
        />
      )}
    </Group>
  )
}

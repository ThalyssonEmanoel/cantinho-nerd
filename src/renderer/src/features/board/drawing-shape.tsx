import { memo } from 'react'
import { Circle, Group, Label, Line, Rect, Tag, Text } from 'react-konva'
import { circleRadius, rectFromPoints, type DrawingTool, type Point } from '@/lib/board'

interface DrawingShapeProps {
  tool: DrawingTool
  points: number[]
  color: string
  width: number
  opacity?: number
}

/**
 * Um desenho do mapa (6.5) — salvo, ao vivo de outra pessoa ou o meu rascunho. Os três usam
 * o mesmo componente, então o traço não muda de cara quando o banco confirma.
 *
 * Nada aqui escuta o mouse: a borracha decide o que tocou pela conta de `drawingHit`, e o
 * Konva não precisa manter a camada de acerto de centenas de traços.
 */
export const DrawingShape = memo(function DrawingShape({
  tool,
  points,
  color,
  width,
  opacity = 1
}: DrawingShapeProps): React.JSX.Element {
  const common = {
    stroke: color,
    strokeWidth: width,
    opacity,
    listening: false,
    perfectDrawEnabled: false
  }

  switch (tool) {
    case 'pencil': {
      // O primeiro ponto, sozinho, não desenharia nada: vira um traço mínimo de ponta redonda.
      const [x = 0, y = 0] = points
      const line = points.length === 2 ? [x, y, x + 0.1, y] : points
      return <Line points={line} lineCap="round" lineJoin="round" {...common} />
    }
    case 'line':
      return <Line points={points} lineCap="round" {...common} />
    case 'circle': {
      const [cx = 0, cy = 0] = points
      return <Circle x={cx} y={cy} radius={circleRadius(points)} {...common} />
    }
    case 'rect':
      return <Rect {...rectFromPoints(points)} lineJoin="round" {...common} />
  }
})

interface RulerShapeProps {
  from: Point
  to: Point
  label: string
  color: string
  /** Zoom da câmera: linha e texto têm tamanho de tela, não de mapa. */
  scale: number
}

/** A régua (6.5): tracejado entre as pontas e a medida perto do cursor. */
export function RulerShape({ from, to, label, color, scale }: RulerShapeProps): React.JSX.Element {
  const unit = 1 / scale
  const points = [from.x, from.y, to.x, to.y]

  return (
    <Group listening={false}>
      {/* Sombra por baixo: a régua precisa aparecer sobre mapa claro e escuro. */}
      <Line points={points} stroke="#020617" strokeWidth={5 * unit} opacity={0.45} lineCap="round" />
      <Line
        points={points}
        stroke={color}
        strokeWidth={2 * unit}
        dash={[8 * unit, 5 * unit]}
        lineCap="round"
      />
      <Circle x={from.x} y={from.y} radius={4 * unit} fill={color} />
      <Circle x={to.x} y={to.y} radius={4 * unit} fill={color} />
      <Label x={to.x + 12 * unit} y={to.y + 12 * unit}>
        {/* Transparência na cor, não em `opacity`: com preenchimento e contorno, o Konva
            desenharia o rótulo num canvas auxiliar a cada quadro. */}
        <Tag
          fill="rgba(2, 6, 23, 0.88)"
          cornerRadius={4 * unit}
          stroke={color}
          strokeWidth={unit}
        />
        <Text
          text={label}
          fontSize={13 * unit}
          padding={5 * unit}
          fill="#f8fafc"
          fontStyle="bold"
        />
      </Label>
    </Group>
  )
}

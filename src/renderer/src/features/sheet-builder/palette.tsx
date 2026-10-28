import {
  AlignLeft,
  CheckSquare,
  CircleDot,
  Dices,
  Hash,
  Heading,
  Image as ImageIcon,
  List,
  Sigma,
  Table,
  TextCursorInput,
  ToggleLeft,
  Type
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { COMPONENT_LABELS, type ComponentType } from '@/lib/sheet'

const ICONS: Record<ComponentType, LucideIcon> = {
  text: TextCursorInput,
  textarea: AlignLeft,
  number: Hash,
  checkbox: CheckSquare,
  select: List,
  image: ImageIcon,
  heading: Heading,
  attribute: Type,
  resource: ToggleLeft,
  markers: CircleDot,
  computed: Sigma,
  rollButton: Dices,
  table: Table
}

/** Ordem da paleta: o que se usa mais fica em cima. */
const ORDER: ComponentType[] = [
  'text',
  'textarea',
  'number',
  'checkbox',
  'select',
  'attribute',
  'resource',
  'markers',
  'computed',
  'rollButton',
  'table',
  'image',
  'heading'
]

interface PaletteProps {
  onAdd: (type: ComponentType) => void
  onDragStart: (type: ComponentType) => void
  onDragEnd: () => void
}

/**
 * Paleta de componentes (5.3). Dá para arrastar para a grade ou clicar, que adiciona no
 * fim da aba — clicar é mais rápido e funciona igual.
 */
export function Palette({ onAdd, onDragStart, onDragEnd }: PaletteProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <p className="text-muted-foreground px-3 py-2 text-xs font-medium uppercase tracking-wide">
        Componentes
      </p>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
        {ORDER.map((type) => {
          const Icon = ICONS[type]
          return (
            <button
              key={type}
              type="button"
              // A grade da react-grid-layout ouve os eventos nativos de arrastar do HTML5.
              draggable
              onDragStart={() => onDragStart(type)}
              onDragEnd={onDragEnd}
              onClick={() => onAdd(type)}
              title={`Adicionar ${COMPONENT_LABELS[type]}`}
              className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-grab items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-left text-sm transition-colors active:cursor-grabbing"
            >
              <Icon className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">{COMPONENT_LABELS[type]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

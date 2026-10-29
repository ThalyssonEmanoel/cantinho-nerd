import {
  Crosshair,
  Grid3x3,
  Hand,
  Images,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Square,
  UserPlus
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMeters, ZOOM_STEP, type BoardMap, type SessionScale } from '@/lib/board'
import type { SessionRole } from '@/lib/db/sessions'
import { cn } from '@/lib/utils'
import { useBoardStore } from './board-store'

interface BoardToolbarProps {
  map: BoardMap
  role: SessionRole
  scale: SessionScale
  /** O mapa aberto não é o que a mesa está vendo (o mestre está preparando). */
  preparing: boolean
  canPlaceMyToken: boolean
  onPlaceMyToken: () => void
  onOpenGallery: () => void
  onPlaceBlank: () => void
  onOpenGrid: () => void
  onFocusEveryone: () => void
}

/** Barra do tabuleiro: ferramenta, zoom, grade e o que dá para colocar no mapa. */
export function BoardToolbar({
  map,
  role,
  scale,
  preparing,
  canPlaceMyToken,
  onPlaceMyToken,
  onOpenGallery,
  onPlaceBlank,
  onOpenGrid,
  onFocusEveryone
}: BoardToolbarProps): React.JSX.Element {
  const tool = useBoardStore((state) => state.tool)
  const camera = useBoardStore((state) => state.cameras[map.id])
  const zoom = Math.round((camera?.scale ?? 1) * 100)

  return (
    <div className="bg-card/60 flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5 backdrop-blur">
      <div className="flex items-center gap-0.5">
        <Button
          variant={tool === 'select' ? 'default' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => useBoardStore.getState().setTool('select')}
          aria-label="Selecionar"
          title="Selecionar (clique, Shift+clique ou caixa)"
        >
          <MousePointer2 className="size-4" />
        </Button>
        <Button
          variant={tool === 'pan' ? 'default' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => useBoardStore.getState().setTool('pan')}
          aria-label="Mãozinha"
          title="Mãozinha (ou segure a barra de espaço / botão do meio)"
        >
          <Hand className="size-4" />
        </Button>
      </div>

      <div className="bg-border mx-1 h-6 w-px" />

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => useBoardStore.getState().zoomStep(1 / ZOOM_STEP)}
          aria-label="Afastar"
        >
          <Minus className="size-4" />
        </Button>
        <span className="text-muted-foreground w-10 text-center text-xs tabular-nums">
          {zoom}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => useBoardStore.getState().zoomStep(ZOOM_STEP)}
          aria-label="Aproximar"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => useBoardStore.getState().fit()}
          aria-label="Caber na tela"
          title="Caber na tela"
        >
          <Maximize className="size-4" />
        </Button>
      </div>

      <div className="bg-border mx-1 h-6 w-px" />

      {role === 'gm' ? (
        <>
          <Button variant="ghost" size="sm" onClick={onOpenGallery}>
            <Images className="size-4" />
            Galeria
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onPlaceBlank}
            aria-label="Token vazio"
            title="Token vazio (objeto)"
          >
            <Square className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onOpenGrid}
            aria-label="Grade e escala"
            title="Grade e escala"
          >
            <Grid3x3 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onFocusEveryone}
            aria-label="Focar a câmera de todos aqui"
            title="Focar a câmera de todos no centro da minha visão"
          >
            <Crosshair className="size-4" />
          </Button>
        </>
      ) : (
        canPlaceMyToken && (
          <Button variant="ghost" size="sm" onClick={onPlaceMyToken}>
            <UserPlus className="size-4" />
            Colocar meu token
          </Button>
        )
      )}

      <div className="ml-auto flex items-center gap-2">
        {preparing && (
          <Badge
            variant="outline"
            className="border-amber-500/50 text-amber-300"
            title="A mesa não está vendo este mapa"
          >
            preparando
          </Badge>
        )}
        <span className={cn('text-muted-foreground truncate text-xs')} title={map.name}>
          {map.name} · 1 quadrado = {formatMeters(scale.metersPerSquare)}
        </span>
      </div>
    </div>
  )
}

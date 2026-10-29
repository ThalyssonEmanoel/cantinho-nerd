import { useState } from 'react'
import { Brush, CloudFog, CloudOff, Eye, EyeOff, Square, Sun, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FOG_BRUSH_LEVELS, type BoardMap } from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import { cn } from '@/lib/utils'
import { useBoardStore } from './board-store'
import {
  coverWholeMap,
  revealWholeMap,
  setFogEnabled,
  undoFogArea
} from './fog-actions'

const BRUSH_NAMES: Record<(typeof FOG_BRUSH_LEVELS)[number], string> = {
  0.5: 'pequeno',
  1: 'médio',
  2: 'grande',
  4: 'enorme'
}

/** Faz a ação e transforma o erro do banco em aviso. */
function attempt(action: () => Promise<void>): void {
  void action().catch((error: unknown) => {
    toast.error('Não consegui mudar a névoa', { description: errorMessage(error) })
  })
}

/**
 * Segunda linha da barra com a névoa na mão (6.4, só o mestre): liga e desliga a névoa do
 * mapa, revela ou cobre com retângulo ou pincel, desfaz a última área e revela ou cobre
 * tudo de uma vez.
 */
export function FogBar({ map }: { map: BoardMap }): React.JSX.Element | null {
  const tool = useBoardStore((state) => state.tool)
  const fogMode = useBoardStore((state) => state.fogMode)
  const fogKind = useBoardStore((state) => state.fogKind)
  const fogBrush = useBoardStore((state) => state.fogBrush)
  const fog = useBoardStore(
    (state) => state.maps.find((item) => item.id === map.id)?.fog ?? map.fog
  )
  const [confirm, setConfirm] = useState<'reveal' | 'cover' | null>(null)

  if (tool !== 'fog') return null

  return (
    <div className="bg-card/40 flex flex-wrap items-center gap-1.5 border-b px-2 py-1">
      <Button
        size="sm"
        variant={fog.enabled ? 'default' : 'outline'}
        onClick={() => attempt(() => setFogEnabled(map, !fog.enabled))}
        aria-pressed={fog.enabled}
        title={fog.enabled ? 'Desligar a névoa deste mapa' : 'Ligar a névoa deste mapa'}
      >
        {fog.enabled ? <CloudFog className="size-4" /> : <CloudOff className="size-4" />}
        {fog.enabled ? 'Névoa ligada' : 'Névoa desligada'}
      </Button>

      <div className="bg-border mx-1 h-6 w-px" />

      <div className="flex items-center gap-0.5" role="group" aria-label="Revelar ou cobrir">
        <Button
          size="sm"
          variant={fogMode === 'reveal' ? 'secondary' : 'ghost'}
          aria-pressed={fogMode === 'reveal'}
          onClick={() => useBoardStore.getState().setFogMode('reveal')}
        >
          <Eye className="size-4" />
          Revelar
        </Button>
        <Button
          size="sm"
          variant={fogMode === 'cover' ? 'secondary' : 'ghost'}
          aria-pressed={fogMode === 'cover'}
          onClick={() => useBoardStore.getState().setFogMode('cover')}
        >
          <EyeOff className="size-4" />
          Cobrir
        </Button>
      </div>

      <div className="flex items-center gap-0.5" role="group" aria-label="Forma da área">
        <Button
          size="icon"
          className="size-8"
          variant={fogKind === 'rect' ? 'secondary' : 'ghost'}
          aria-pressed={fogKind === 'rect'}
          aria-label="Retângulo"
          title="Retângulo"
          onClick={() => useBoardStore.getState().setFogKind('rect')}
        >
          <Square className="size-4" />
        </Button>
        <Button
          size="icon"
          className="size-8"
          variant={fogKind === 'brush' ? 'secondary' : 'ghost'}
          aria-pressed={fogKind === 'brush'}
          aria-label="Pincel"
          title="Pincel"
          onClick={() => useBoardStore.getState().setFogKind('brush')}
        >
          <Brush className="size-4" />
        </Button>
      </div>

      {fogKind === 'brush' && (
        <div className="flex items-center gap-0.5" role="group" aria-label="Tamanho do pincel">
          {FOG_BRUSH_LEVELS.map((level) => (
            <Button
              key={level}
              size="icon"
              className="size-8"
              variant={fogBrush === level ? 'secondary' : 'ghost'}
              aria-pressed={fogBrush === level}
              aria-label={`Pincel ${BRUSH_NAMES[level]}`}
              title={`Pincel ${BRUSH_NAMES[level]} (${level * 2} quadrado(s) de largura)`}
              onClick={() => useBoardStore.getState().setFogBrush(level)}
            >
              <span
                className="bg-foreground/80 rounded-full"
                style={{ width: 3 + level * 3, height: 3 + level * 3 }}
              />
            </Button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={fog.shapes.length === 0}
          onClick={() => attempt(() => undoFogArea(map))}
          title="Desfaz a última área revelada ou coberta"
        >
          <Undo2 className="size-4" />
          Desfazer área
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm('reveal')}>
          <Sun className="size-4" />
          Revelar tudo
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm('cover')}>
          <CloudFog className="size-4" />
          Cobrir tudo
        </Button>
      </div>

      <p className={cn('text-muted-foreground w-full px-1 text-xs', !fog.enabled && 'text-amber-300')}>
        {fog.enabled
          ? 'Os jogadores veem a névoa escura; você, por transparência. A visão dos tokens dos jogadores revela em volta deles. Monstros no escuro não aparecem para eles.'
          : 'A névoa está desligada: os jogadores veem o mapa inteiro. Prepare as áreas e ligue quando quiser.'}
      </p>

      <Dialog
        open={confirm !== null}
        title={confirm === 'reveal' ? 'Revelar o mapa inteiro?' : 'Cobrir o mapa inteiro?'}
        description={
          confirm === 'reveal'
            ? 'As áreas feitas até aqui somem e o mapa fica todo à vista.'
            : 'As áreas feitas até aqui somem e só a visão dos jogadores revela o mapa.'
        }
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const which = confirm
                setConfirm(null)
                attempt(() => (which === 'reveal' ? revealWholeMap(map) : coverWholeMap(map)))
              }}
            >
              {confirm === 'reveal' ? 'Revelar tudo' : 'Cobrir tudo'}
            </Button>
          </>
        }
      />
    </div>
  )
}

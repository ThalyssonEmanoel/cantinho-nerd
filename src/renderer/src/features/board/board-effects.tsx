import type { CSSProperties } from 'react'
import { toScreen, type BoardMap, type BoardToken, type Camera } from '@/lib/board'
import { drawPosition, useBoardStore } from './board-store'
import { useLiveStore } from './live-store'

interface BoardEffectsProps {
  map: BoardMap
  camera: Camera
  nameOf: (userId: string) => string
  /** Os tokens que esta pessoa vê agora: reação sobre um monstro no escuro não aparece. */
  tokens: readonly BoardToken[]
}

/**
 * Pings (6.5) e reações (6.3) por cima do tabuleiro.
 *
 * São elementos HTML, não Konva: a animação é CSS (`globals.css`) e roda sozinha, sem
 * redesenhar o canvas a cada quadro. A posição sai das coordenadas do mapa pela câmera,
 * então o pulso fica no mesmo ponto do mapa em qualquer janela.
 */
export function BoardEffects({
  map,
  camera,
  nameOf,
  tokens
}: BoardEffectsProps): React.JSX.Element {
  const pings = useLiveStore((state) => state.pings)
  const reactions = useLiveStore((state) => state.reactions)
  const dragging = useBoardStore((state) => state.dragging)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pings
        .filter((ping) => ping.mapId === map.id)
        .map((ping) => {
          const at = toScreen(camera, ping.point)
          const name = nameOf(ping.userId)
          return (
            <div key={ping.id} className="absolute" style={{ left: at.x, top: at.y }}>
              <span className="board-ping absolute size-16 rounded-full border-[3px] border-amber-300" />
              <span className="board-ping board-ping-late absolute size-16 rounded-full border-2 border-amber-200" />
              <span className="absolute size-3 -translate-1/2 rounded-full bg-amber-300 shadow-[0_0_12px_4px_rgb(252_211_77/0.6)]" />
              {name !== '' && (
                <span className="board-ping-name absolute top-5 -translate-x-1/2 rounded bg-slate-950/85 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-amber-100">
                  {name}
                </span>
              )}
            </div>
          )
        })}

      {reactions
        .filter((reaction) => reaction.mapId === map.id)
        .map((reaction) => {
          const token = tokens.find((item) => item.id === reaction.tokenId)
          if (token === undefined) return null
          const position = drawPosition(token, dragging)
          const side = token.size * map.grid.size
          const at = toScreen(camera, { x: position.x + side / 2, y: position.y })
          return (
            <span
              key={reaction.id}
              className="board-reaction absolute text-3xl drop-shadow-[0_2px_4px_rgb(0_0_0/0.6)]"
              style={{ left: at.x, top: at.y, '--drift': `${drift(reaction.id)}px` } as CSSProperties}
              title={nameOf(reaction.userId)}
            >
              {reaction.emoji}
            </span>
          )
        })}
    </div>
  )
}

/** Um desvio lateral fixo por reação: várias seguidas sobem em leque, não empilhadas. */
function drift(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return (hash % 41) - 20
}

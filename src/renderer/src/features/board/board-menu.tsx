import { useEffect, useRef, type ReactNode } from 'react'
import { REACTIONS, type Point, type Reaction } from '@/lib/board'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  icon?: ReactNode
  destructive?: boolean
  onPick: () => void
}

interface BoardMenuProps {
  /** Posição na tela (clientX/clientY do clique). */
  at: Point
  items: MenuItem[]
  /** Menu de um token: a fileira de reações com emoji em cima (6.3). */
  onReact?: (emoji: Reaction) => void
  onClose: () => void
}

/**
 * Menu de contexto do tabuleiro (6.3).
 *
 * Feito à mão, como o `Dialog`: o menu nativo do Chromium não combina com o tema e não dá
 * para colocar as ações da mesa nele.
 */
export function BoardMenu({ at, items, onReact, onClose }: BoardMenuProps): React.JSX.Element {
  const menu = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || menu.current?.contains(event.target) !== true) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  // Não deixa o menu cair fora da janela.
  // A fileira de reações pede um pouco mais de largura para os oito emojis.
  const width = onReact === undefined ? 232 : 264
  const height = items.length * 34 + 8 + (onReact === undefined ? 0 : 44)
  const left = Math.min(at.x, window.innerWidth - width - 8)
  const top = Math.min(at.y, window.innerHeight - height - 8)

  return (
    <div
      ref={menu}
      role="menu"
      className="bg-card animate-in fade-in zoom-in-95 fixed z-50 overflow-hidden rounded-md border py-1 shadow-xl duration-100"
      style={{ left: Math.max(8, left), top: Math.max(8, top), width }}
    >
      {onReact !== undefined && (
        <div
          role="group"
          aria-label="Reagir"
          className="flex justify-between border-b px-1.5 pb-1"
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Reagir com ${emoji}`}
              title="Reagir (todos veem)"
              className="hover:bg-accent rounded-md p-1 text-lg leading-none transition-transform hover:scale-125"
              onClick={() => {
                onClose()
                onReact(emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            'hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
            item.destructive === true && 'text-destructive'
          )}
          onClick={() => {
            onClose()
            item.onPick()
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

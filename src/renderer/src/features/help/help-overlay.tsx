import { useEffect } from 'react'
import { Dices, Keyboard, Lightbulb, Map as MapIcon, ScrollText } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { isTypingTarget, SHORTCUTS, type ShortcutHelp } from '@/lib/board'
import { useHelpStore } from './help-store'

/**
 * Tela de ajuda (Fase 13): as teclas e um resumo de como a mesa funciona.
 *
 * Fica na casca do app, então F1 e `?` valem em qualquer tela. A tabela de teclas sai da
 * mesma lista que o tabuleiro usa de verdade (`SHORTCUTS`), para a ajuda não envelhecer
 * sozinha quando um atalho mudar.
 */
export function HelpOverlay(): React.JSX.Element {
  const open = useHelpStore((state) => state.open)

  // F1 e ? abrem (e fecham) a ajuda em qualquer lugar; dentro de um campo, não.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'F1' && event.key !== '?') return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      const help = useHelpStore.getState()
      if (help.open) help.closeHelp()
      else help.openHelp()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return <></>

  return (
    <Dialog
      open
      title="Ajuda"
      description="O que cada tecla faz e onde achar cada coisa."
      onClose={() => useHelpStore.getState().closeHelp()}
      className="max-w-2xl"
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <ShortcutTable
          title="No tabuleiro"
          icon={<MapIcon className="size-4" />}
          items={SHORTCUTS.filter((item) => item.where === 'board')}
        />
        <ShortcutTable
          title="Na mesa, em qualquer tela"
          icon={<Dices className="size-4" />}
          items={SHORTCUTS.filter((item) => item.where === 'session')}
        />
        <ShortcutTable
          title="No app"
          icon={<Keyboard className="size-4" />}
          items={SHORTCUTS.filter((item) => item.where === 'app')}
        />

        <section className="space-y-2 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ScrollText className="size-4" />
            Como as peças se encaixam
          </h3>
          <ul className="text-muted-foreground space-y-1.5 text-sm">
            <li>
              <strong>Modelos de ficha</strong> são o sistema da sua mesa: você monta os campos
              numa grade e publica uma versão. As fichas dos jogadores nascem presas a ela.
            </li>
            <li>
              <strong>Mesas</strong> têm um mapa ativo (o que todos veem) e outros que o mestre
              pode abrir só para preparar. Cada um tem a própria câmera; as posições são as
              mesmas para todos.
            </li>
            <li>
              <strong>Token oculto</strong> não chega ao jogador — nem a posição. Para só esconder
              no escuro, use a névoa.
            </li>
            <li>
              <strong>Rolagens</strong> dos botões da ficha vão para o chat com o nome do que foi
              rolado. A bandeja de dados fica embaixo do chat.
            </li>
            <li className="flex items-start gap-1.5">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>Pistas</strong> ficam guardadas com você até revelar — para a mesa inteira
                ou para quem você escolher.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Dialog>
  )
}

function ShortcutTable({
  title,
  icon,
  items
}: {
  title: string
  icon: React.ReactNode
  items: readonly ShortcutHelp[]
}): React.JSX.Element | null {
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.keys} className="flex items-baseline gap-2 text-sm">
            <kbd className="bg-muted text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 text-xs">
              {item.keys}
            </kbd>
            <span className="text-muted-foreground">{item.what}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

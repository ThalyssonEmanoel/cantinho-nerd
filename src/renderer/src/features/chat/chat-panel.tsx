import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellOff, ChevronDown, ChevronUp, Dices, Eraser, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ChatMember } from '@/lib/chat/commands'
import type { SessionMember } from '@/lib/db/sessions'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSessionStore } from '@/features/session/session-store'
import { useChatStore } from './chat-store'
import { DiceTray } from './dice-tray'
import { FeedEntry } from './feed-entry'

/** Distância do fim (px) em que ainda vale "estou acompanhando a conversa". */
const STICK_TO_BOTTOM = 80

/**
 * Chat e dados da mesa (seções 7.1 e 7.2). Rolagens e mensagens numa linha só; a bandeja
 * de dados fica embaixo; o campo de texto entende `/r` e `/w`.
 */
export function ChatPanel(): React.JSX.Element | null {
  const session = useSessionStore((state) => state.session)
  const userId = useAuthStore((state) => state.userId)
  const feed = useChatStore((state) => state.feed)
  const loadState = useChatStore((state) => state.loadState)
  const whisperSound = useAppStore((state) => state.whisperSound)

  const [text, setText] = useState('')
  const [recipient, setRecipient] = useState('')
  const [sending, setSending] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)
  const [clearing, setClearing] = useState<'message' | 'roll' | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // O chat à vista zera as não lidas (7.2); fora da tela, elas contam.
  useEffect(() => {
    useChatStore.getState().watch(true)
    return () => useChatStore.getState().watch(false)
  }, [])

  // Chegou coisa nova: acompanha o fim, a não ser que a pessoa tenha rolado para ler o antigo.
  useEffect(() => {
    const element = scroller.current
    if (element !== null && stickToBottom.current) element.scrollTop = element.scrollHeight
  }, [feed])

  const members = useMemo(
    () =>
      new Map<string, SessionMember>(
        (session?.members ?? []).map((member) => [member.userId, member])
      ),
    [session]
  )

  if (session === null || userId === null) return null

  const others = session.members.filter((member) => member.userId !== userId)
  const chatMembers: ChatMember[] = session.members
  const rules = session.diceRules

  async function handleSend(): Promise<void> {
    if (text.trim() === '' || sending) return
    setSending(true)
    const chat = useChatStore.getState()
    // Comando (/r, /w) manda no destino; texto comum vai para quem está no seletor.
    const result =
      text.trim().startsWith('/') || recipient === ''
        ? await chat.sendInput(text, chatMembers, rules)
        : await chat.sendWhisperOrMessage(text.trim(), recipient)
    setSending(false)
    if (result.ok) {
      setText('')
      stickToBottom.current = true
    } else {
      toast.error('Não deu para mandar', { description: result.message })
    }
  }

  async function handleClear(): Promise<void> {
    const kind = clearing
    setClearing(null)
    if (kind === null) return
    const result = await useChatStore.getState().clear(kind)
    if (result.ok)
      toast.success(kind === 'message' ? 'Chat limpo' : 'Histórico de rolagens excluído')
    else toast.error('Não consegui limpar', { description: result.message })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <span className="text-sm font-medium">Chat</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          onClick={() => useAppStore.getState().setWhisperSound(!whisperSound)}
          aria-label={whisperSound ? 'Desligar o som dos sussurros' : 'Ligar o som dos sussurros'}
          title={whisperSound ? 'Som dos sussurros ligado' : 'Som dos sussurros desligado'}
        >
          {whisperSound ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
        </Button>
        {session.role === 'gm' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setClearing('message')}
              title="Apagar todas as mensagens"
            >
              <Eraser className="size-3.5" />
              Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setClearing('roll')}
              title="Excluir o histórico de rolagens"
            >
              <Eraser className="size-3.5" />
              Rolagens
            </Button>
          </>
        )}
      </div>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
        onScroll={(event) => {
          const element = event.currentTarget
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM
        }}
      >
        {loadState === 'loading' && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Carregando a conversa…
          </p>
        )}
        {loadState === 'ready' && feed.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Nada por aqui ainda. Mande um oi ou role um dado.
          </p>
        )}
        {feed.map((item) => (
          <FeedEntry
            key={`${item.kind}:${item.id}`}
            item={item}
            members={members}
            myUserId={userId}
          />
        ))}
      </div>

      <div className="space-y-2 border-t p-3">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 text-xs font-medium"
          onClick={() => setTrayOpen((open) => !open)}
        >
          <Dices className="size-3.5" />
          Dados
          {trayOpen ? (
            <ChevronDown className="ml-auto size-3.5" />
          ) : (
            <ChevronUp className="ml-auto size-3.5" />
          )}
        </button>
        {trayOpen && <DiceTray rules={rules} />}

        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSend()
          }}
        >
          <div className="flex gap-1.5">
            <Select
              className="h-8 w-32 text-xs"
              value={recipient}
              aria-label="Para quem"
              onChange={(event) => setRecipient(event.target.value)}
            >
              <option value="">Para todos</option>
              {others.map((member) => (
                <option key={member.userId} value={member.userId}>
                  Sussurrar:{' '}
                  {member.role === 'gm' ? `${member.displayName} (mestre)` : member.displayName}
                </option>
              ))}
            </Select>
            <Input
              className="h-8 text-sm"
              value={text}
              maxLength={2000}
              placeholder={recipient === '' ? 'Mensagem, /r 2d6+3 ou /w Nome…' : 'Sussurro…'}
              aria-label="Mensagem"
              onChange={(event) => setText(event.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0"
              disabled={text.trim() === '' || sending}
              aria-label="Mandar"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
          {/* Transparência (7.2): o jogador sabe que o mestre lê todos os sussurros. */}
          {session.role === 'player' && (recipient !== '' || text.trim().startsWith('/w')) && (
            <p className="text-muted-foreground text-xs">O mestre vê todos os sussurros.</p>
          )}
        </form>
      </div>

      <Dialog
        open={clearing !== null}
        title={clearing === 'message' ? 'Limpar o chat?' : 'Excluir o histórico de rolagens?'}
        description={
          clearing === 'message'
            ? 'Some toda a conversa, inclusive os sussurros, para todo mundo. Não tem como desfazer.'
            : 'Somem todas as rolagens da mesa, para todo mundo. Não tem como desfazer.'
        }
        onClose={() => setClearing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearing(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleClear()}>
              {clearing === 'message' ? 'Limpar o chat' : 'Excluir as rolagens'}
            </Button>
          </>
        }
      />
    </div>
  )
}

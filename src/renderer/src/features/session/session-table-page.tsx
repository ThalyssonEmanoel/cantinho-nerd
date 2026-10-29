import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  ScrollText,
  Swords,
  UserPlus,
  Users
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BoardView } from '@/features/board/board-view'
import { MapLibrary } from '@/features/board/map-library'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { errorMessage } from '@/lib/db/errors'
import type { SheetSummaryRow } from '@/lib/sheet'
import { sheetRepository } from '@/features/sheets/repository'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { ChatPanel } from '@/features/chat/chat-panel'
import { useChatStore } from '@/features/chat/chat-store'
import { CombatPanel } from '@/features/combat/combat-panel'
import { useCombatStore } from '@/features/combat/combat-store'
import { useSessionStore } from './session-store'

type PanelTab = 'chat' | 'combat' | 'table'

/**
 * A mesa: o tabuleiro no centro (seção 6) e, à direita, o chat com os dados (7), o combate
 * (7.3) e a aba da mesa (mapas, fichas e quem está na sessão). O painel recolhe para o
 * tabuleiro ocupar a janela toda (6.1) — e aí as não lidas aparecem no botão de abrir.
 */
export function SessionTablePage(): React.JSX.Element {
  const role = useSessionStore((state) => state.session?.role ?? 'player')
  const unread = useChatStore((state) => state.unread)
  const fighting = useCombatStore((state) => state.state.active)
  const [panelOpen, setPanelOpen] = useState(true)
  const [tab, setTab] = useState<PanelTab>('chat')

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <BoardView />
      </div>

      <button
        type="button"
        className="bg-card/60 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-1 border-l px-0.5"
        onClick={() => setPanelOpen((open) => !open)}
        aria-label={panelOpen ? 'Recolher o painel' : 'Mostrar o painel'}
        title={panelOpen ? 'Recolher o painel' : 'Mostrar o painel'}
      >
        {panelOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        {!panelOpen && <UnreadBadge count={unread} />}
      </button>

      {panelOpen && (
        <aside className="flex w-80 shrink-0 flex-col border-l">
          <div className="grid grid-cols-3 gap-1 border-b p-1.5" role="tablist">
            <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
              <MessageSquare className="size-3.5" />
              Chat
              {tab !== 'chat' && <UnreadBadge count={unread} />}
            </TabButton>
            <TabButton active={tab === 'combat'} onClick={() => setTab('combat')}>
              <Swords className="size-3.5" />
              Combate
              {fighting && tab !== 'combat' && (
                <span
                  className="size-2 rounded-full bg-amber-400"
                  aria-label="combate em andamento"
                />
              )}
            </TabButton>
            <TabButton active={tab === 'table'} onClick={() => setTab('table')}>
              <Users className="size-3.5" />
              Mesa
            </TabButton>
          </div>

          {tab === 'chat' ? (
            <div className="min-h-0 flex-1">
              <ChatPanel />
            </div>
          ) : tab === 'combat' ? (
            <div className="min-h-0 flex-1">
              <CombatPanel />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {role === 'gm' && <MapLibrary />}
              <SheetsPanel />
              <MembersPanel />
            </div>
          )}
        </aside>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
      )}
    >
      {children}
    </button>
  )
}

/** Contador de não lidas do chat (7.2). */
function UnreadBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count === 0) return null
  return (
    <span
      className="bg-primary text-primary-foreground rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums"
      aria-label={`${count} não lidas`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

function SheetsPanel(): React.JSX.Element | null {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const sheets = useSessionStore((state) => state.sheets)
  const userId = useAuthStore((state) => state.userId)
  const displayName = useAuthStore((state) => state.profile?.displayName ?? '')
  const [creating, setCreating] = useState(false)

  if (session === null) return null
  const open = (sheet: SheetSummaryRow): void =>
    void navigate(`/session/${session.id}/sheets/${sheet.id}`)

  async function createCharacter(): Promise<void> {
    if (session === null || session.characterTemplateId === null) return
    setCreating(true)
    try {
      const sheet = await sheetRepository.create({
        sessionId: session.id,
        templateId: session.characterTemplateId,
        ownerName: displayName
      })
      await useSessionStore.getState().refreshSheets()
      void navigate(`/session/${session.id}/sheets/${sheet.id}`)
    } catch (error) {
      toast.error('Não consegui criar o personagem', { description: errorMessage(error) })
    } finally {
      setCreating(false)
    }
  }

  const mine = sheets.find((sheet) => sheet.ownerId === userId)

  return (
    <section className="space-y-2 p-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <ScrollText className="text-muted-foreground size-4" />
        Fichas
      </h2>

      {session.role === 'player' && mine === undefined && (
        <div className="space-y-2 rounded-md border border-dashed p-3 text-sm">
          {session.characterTemplateId === null ? (
            <p className="text-muted-foreground">
              O mestre ainda não escolheu o sistema desta mesa. Quando escolher, você cria seu
              personagem aqui.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">Você ainda não tem personagem nesta mesa.</p>
              <Button
                size="sm"
                className="w-full"
                disabled={creating}
                onClick={() => void createCharacter()}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Criar meu personagem
              </Button>
            </>
          )}
        </div>
      )}

      {session.role === 'gm' && session.characterTemplateId === null && (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          Escolha o sistema da mesa em <strong>Gerenciar</strong> para os jogadores criarem os
          personagens.
        </p>
      )}

      {sheets.length === 0 && session.role === 'gm' && session.characterTemplateId !== null && (
        <p className="text-muted-foreground text-sm">Nenhum personagem criado ainda.</p>
      )}

      <ul className="space-y-1.5">
        {sheets.map((sheet) => (
          <li key={sheet.id}>
            <button
              type="button"
              onClick={() => open(sheet)}
              className={cn(
                'hover:bg-accent w-full rounded-md border px-3 py-2 text-left transition-colors',
                sheet.ownerId === userId && 'border-primary/50'
              )}
            >
              <p className="truncate text-sm font-medium">
                {sheet.name === '' ? 'Personagem sem nome' : sheet.name}
              </p>
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="truncate">
                  {sheet.ownerId === userId ? 'Você' : sheet.ownerName}
                </span>
                {sheet.bars.hp !== undefined && (
                  <Badge variant="outline" className="ml-auto">
                    {sheet.bars.hp.current} / {sheet.bars.hp.max}
                  </Badge>
                )}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function MembersPanel(): React.JSX.Element | null {
  const session = useSessionStore((state) => state.session)
  const presence = useSessionStore((state) => state.presence)
  if (session === null) return null
  const online = new Set(presence.map((member) => member.userId))

  return (
    <section className="space-y-2 p-3">
      <h2 className="text-sm font-medium">Na mesa ({session.members.length})</h2>
      <ul className="space-y-1">
        {session.members.map((member) => (
          <li key={member.userId} className="flex items-center gap-2 text-sm">
            <span className="relative">
              <UserAvatar
                displayName={member.displayName}
                avatarPath={member.avatarPath}
                className="size-7 text-xs"
              />
              <span
                className={cn(
                  'ring-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2',
                  online.has(member.userId) ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                )}
                title={online.has(member.userId) ? 'online' : 'offline'}
              />
            </span>
            <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
            {member.role === 'gm' && <Badge variant="secondary">mestre</Badge>}
          </li>
        ))}
      </ul>
    </section>
  )
}

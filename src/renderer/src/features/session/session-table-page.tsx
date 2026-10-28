import { useState } from 'react'
import { Loader2, ScrollText, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PhaseNotice } from '@/components/phase-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { errorMessage } from '@/lib/db/errors'
import type { SheetSummaryRow } from '@/lib/sheet'
import { sheetRepository } from '@/features/sheets/repository'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { useSessionStore } from './session-store'

/**
 * A mesa: o tabuleiro no centro (Fase 6) e, à direita, as fichas e quem está na sessão.
 * O jogador cria o personagem aqui (5.7); o mestre vê a ficha de todo mundo (8).
 */
export function SessionTablePage(): React.JSX.Element {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_20rem] divide-x">
      <div className="bg-muted/20 relative min-h-0 overflow-auto p-4">
        <div className="text-muted-foreground flex h-full min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6 text-sm">
          <p>Tabuleiro — mapas, tokens, grade e névoa chegam na Fase 6.</p>
          <div className="w-full max-w-md">
            <PhaseNotice
              phase="Fase 6"
              title="Tabuleiro"
              items={[
                'Mapas por sessão, com ativação e preparação sem ativar',
                'Câmera por mapa: zoom no cursor, mãozinha e caber na tela',
                'Tokens com as barras vindas da ficha pelos papéis'
              ]}
            />
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col divide-y overflow-y-auto">
        <SheetsPanel />
        <MembersPanel />
      </aside>
    </div>
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

import { EyeOff, MessageSquareLock } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import type { FeedItem } from '@/lib/chat/feed'
import { splitLinks } from '@/lib/chat/links'
import type { SessionMember } from '@/lib/db/sessions'
import { cn } from '@/lib/utils'
import { RollApply } from '@/features/combat/roll-apply'
import { RollResult } from './roll-result'

interface FeedEntryProps {
  item: FeedItem
  members: ReadonlyMap<string, SessionMember>
  myUserId: string
}

const time = (iso: string): string =>
  iso === ''
    ? ''
    : new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Uma linha do chat: mensagem, sussurro ou rolagem (7.1 e 7.2). */
export function FeedEntry({ item, members, myUserId }: FeedEntryProps): React.JSX.Element {
  const author = members.get(item.authorId)
  const authorName =
    item.authorId === myUserId ? 'Você' : (author?.displayName ?? 'Quem saiu da mesa')

  return (
    <div className="group flex gap-2">
      <UserAvatar
        displayName={author?.displayName ?? '?'}
        avatarPath={author?.avatarPath ?? null}
        className="mt-0.5 size-7 text-[0.65rem]"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-muted-foreground flex items-baseline gap-1.5 text-xs">
          <span className="text-foreground truncate font-medium">{authorName}</span>
          {item.kind === 'message' && item.recipientId !== null && (
            <WhisperTag item={item} members={members} myUserId={myUserId} />
          )}
          {item.kind === 'roll' && item.secret && (
            <span
              className="flex items-center gap-0.5 text-amber-300"
              title="Só quem rolou e o mestre veem"
            >
              <EyeOff className="size-3" />
              secreta
            </span>
          )}
          <span className="ml-auto shrink-0 tabular-nums">{time(item.createdAt)}</span>
        </p>

        {item.kind === 'roll' ? (
          <>
            <RollResult roll={item} />
            {/* Dano/cura com o total, nos tokens selecionados no mapa (7.3). */}
            <RollApply total={item.total} />
          </>
        ) : (
          <p
            className={cn(
              'text-sm break-words whitespace-pre-wrap',
              item.recipientId !== null &&
                'rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1'
            )}
          >
            <MessageBody body={item.body} />
          </p>
        )}
      </div>
    </div>
  )
}

function WhisperTag({
  item,
  members,
  myUserId
}: {
  item: Extract<FeedItem, { kind: 'message' }>
  members: ReadonlyMap<string, SessionMember>
  myUserId: string
}): React.JSX.Element {
  const to =
    item.recipientId === myUserId
      ? 'você'
      : (members.get(item.recipientId ?? '')?.displayName ?? '?')
  return (
    <span className="flex items-center gap-0.5 text-violet-300">
      <MessageSquareLock className="size-3" />
      sussurro para {to}
    </span>
  )
}

/** Texto puro (nunca HTML): só os links http/https viram clique, no navegador padrão. */
function MessageBody({ body }: { body: string }): React.JSX.Element {
  return (
    <>
      {splitLinks(body).map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <button
            key={index}
            type="button"
            className="text-primary break-all underline underline-offset-2"
            title="Abrir no navegador"
            onClick={() => void window.api.openExternal(segment.url)}
          >
            {segment.url}
          </button>
        )
      )}
    </>
  )
}

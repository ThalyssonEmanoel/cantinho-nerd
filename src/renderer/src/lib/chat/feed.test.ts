import { describe, expect, it } from 'vitest'
import {
  clearFromFeed,
  countsAsUnread,
  FEED_LIMIT,
  isWhisperToMe,
  mergeFeed,
  removeFromFeed,
  type FeedMessage,
  type FeedRoll
} from './feed'

const message = (id: string, createdAt: string, extra: Partial<FeedMessage> = {}): FeedMessage => ({
  kind: 'message',
  id,
  authorId: 'ana',
  recipientId: null,
  body: id,
  createdAt,
  ...extra
})

const roll = (id: string, createdAt: string): FeedRoll => ({
  kind: 'roll',
  id,
  authorId: 'bruno',
  label: '',
  formula: '1d20',
  notation: '1d20',
  detail: '',
  dice: [],
  total: 10,
  outcome: 'normal',
  secret: false,
  createdAt
})

describe('mergeFeed', () => {
  it('mensagens e rolagens numa linha só, na ordem em que aconteceram', () => {
    const feed = mergeFeed(
      [message('m1', '2026-10-29T10:00:00Z')],
      [roll('r1', '2026-10-29T09:00:00Z')]
    )
    expect(feed.map((item) => item.id)).toEqual(['r1', 'm1'])
  })

  it('o eco do tempo real não duplica', () => {
    const first = mergeFeed([message('m1', 't1')])
    expect(mergeFeed(first, [message('m1', 't1')])).toHaveLength(1)
  })

  it('mensagem e rolagem com o mesmo id não se confundem', () => {
    expect(mergeFeed([message('x', 't1')], [roll('x', 't1')])).toHaveLength(2)
  })

  it('guarda só os mais recentes', () => {
    const many = Array.from({ length: FEED_LIMIT + 10 }, (_, index) =>
      message(`m${index}`, `2026-10-29T10:${String(index).padStart(4, '0')}`)
    )
    const feed = mergeFeed(many)
    expect(feed).toHaveLength(FEED_LIMIT)
    expect(feed.at(-1)?.id).toBe(`m${FEED_LIMIT + 9}`)
  })
})

describe('remover e limpar', () => {
  const feed = mergeFeed([message('m1', 't1'), message('m2', 't2')], [roll('r1', 't3')])

  it('remove um item pelo tipo e id', () => {
    expect(removeFromFeed(feed, 'message', 'm1').map((item) => item.id)).toEqual(['m2', 'r1'])
  })

  it('limpar o chat leva só as mensagens; limpar o histórico, só as rolagens', () => {
    expect(clearFromFeed(feed, 'message').map((item) => item.id)).toEqual(['r1'])
    expect(clearFromFeed(feed, 'roll').map((item) => item.id)).toEqual(['m1', 'm2'])
  })
})

describe('não lidas e som do sussurro', () => {
  it('o que eu mesmo mandei não conta como não lido', () => {
    expect(countsAsUnread(message('m', 't', { authorId: 'eu' }), 'eu')).toBe(false)
    expect(countsAsUnread(message('m', 't'), 'eu')).toBe(true)
  })

  it('só sussurro para mim, de outra pessoa, toca o som', () => {
    expect(isWhisperToMe(message('m', 't', { recipientId: 'eu' }), 'eu')).toBe(true)
    expect(isWhisperToMe(message('m', 't', { recipientId: 'outro' }), 'eu')).toBe(false)
    expect(isWhisperToMe(message('m', 't'), 'eu')).toBe(false)
    expect(isWhisperToMe(roll('r', 't'), 'eu')).toBe(false)
  })
})

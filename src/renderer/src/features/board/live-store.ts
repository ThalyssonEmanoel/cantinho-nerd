import { create } from 'zustand'
import type {
  LiveStroke,
  PingShare,
  Point,
  Reaction,
  ReactionShare,
  RulerShare
} from '@/lib/board'

/**
 * O que está acontecendo no tabuleiro agora e não fica salvo (6.3, 6.5, 10.3): o traço que
 * outra pessoa está desenhando, as réguas, os pings e as reações.
 *
 * Separado do `board-store` porque é tudo passageiro: cada coisa some sozinha depois de um
 * tempo. Mensagem efêmera pode se perder no caminho, e o tabuleiro não pode ficar com uma
 * régua ou um traço pela metade para sempre por causa disso.
 *
 * O meu traço em andamento, a minha régua e o cursor da borracha também moram aqui: mudam a
 * cada movimento do mouse, e só as camadas que os desenham assinam esses campos — o resto
 * do tabuleiro (os tokens) não é redesenhado a cada pixel.
 */

export interface RulerEffect {
  userId: string
  mapId: string
  from: Point
  to: Point
}

export interface PingEffect {
  id: string
  userId: string
  mapId: string
  point: Point
}

export interface ReactionEffect {
  id: string
  userId: string
  mapId: string
  tokenId: string
  emoji: Reaction
}

interface LiveState {
  /** Traços em andamento dos outros, pelo id que terão no banco. */
  strokes: Record<string, LiveStroke>
  /** Uma régua por pessoa. */
  rulers: Record<string, RulerEffect>
  pings: PingEffect[]
  reactions: ReactionEffect[]

  /** O traço que eu estou desenhando agora. */
  draft: LiveStroke | null
  /** A régua que eu estou segurando agora. */
  myRuler: { from: Point; to: Point } | null
  /** Onde está a borracha (o círculo que mostra o alcance dela). */
  eraser: Point | null

  setDraft: (draft: LiveStroke | null) => void
  setMyRuler: (ruler: { from: Point; to: Point } | null) => void
  setEraser: (point: Point | null) => void

  applyStroke: (stroke: LiveStroke) => void
  dropStroke: (id: string) => void
  applyRuler: (share: RulerShare) => void
  addPing: (share: PingShare) => void
  addReaction: (share: ReactionShare) => void
  reset: () => void
}

/** Sem notícia do traço por esse tempo, ele some (quem desenhava caiu, ou o aviso se perdeu). */
export const STROKE_TIMEOUT_MS = 5000
/** Quem mede reenvia a régua a cada segundo; três sem notícia e ela some. */
export const RULER_TIMEOUT_MS = 3000
/** Duração das animações (as mesmas do `globals.css`). */
export const PING_MS = 1600
export const REACTION_MS = 1800
/** Teto de efeitos ao mesmo tempo: alguém clicando sem parar não trava a tela dos outros. */
const MAX_EFFECTS = 24

const timers = new Map<string, ReturnType<typeof setTimeout>>()
let nextId = 0

function schedule(key: string, delay: number, run: () => void): void {
  const previous = timers.get(key)
  if (previous !== undefined) clearTimeout(previous)
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      run()
    }, delay)
  )
}

function cancel(key: string): void {
  const timer = timers.get(key)
  if (timer === undefined) return
  clearTimeout(timer)
  timers.delete(key)
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

const emptyState = {
  strokes: {},
  rulers: {},
  pings: [],
  reactions: [],
  draft: null,
  myRuler: null,
  eraser: null
}

export const useLiveStore = create<LiveState>()((set, get) => ({
  ...emptyState,

  setDraft: (draft) => set({ draft }),
  setMyRuler: (myRuler) => set({ myRuler }),
  setEraser: (eraser) => set({ eraser }),

  applyStroke: (stroke) => {
    set({ strokes: { ...get().strokes, [stroke.id]: stroke } })
    schedule(`stroke:${stroke.id}`, STROKE_TIMEOUT_MS, () =>
      set({ strokes: without(get().strokes, stroke.id) })
    )
  },

  dropStroke: (id) => {
    cancel(`stroke:${id}`)
    set({ strokes: without(get().strokes, id) })
  },

  applyRuler: ({ userId, mapId, from, to }) => {
    if (to === null) {
      cancel(`ruler:${userId}`)
      set({ rulers: without(get().rulers, userId) })
      return
    }
    set({ rulers: { ...get().rulers, [userId]: { userId, mapId, from, to } } })
    schedule(`ruler:${userId}`, RULER_TIMEOUT_MS, () =>
      set({ rulers: without(get().rulers, userId) })
    )
  },

  addPing: (share) => {
    nextId += 1
    const id = `ping-${nextId}`
    set({ pings: [...get().pings, { id, ...share }].slice(-MAX_EFFECTS) })
    schedule(id, PING_MS, () => set({ pings: get().pings.filter((ping) => ping.id !== id) }))
  },

  addReaction: (share) => {
    nextId += 1
    const id = `reaction-${nextId}`
    set({ reactions: [...get().reactions, { id, ...share }].slice(-MAX_EFFECTS) })
    schedule(id, REACTION_MS, () =>
      set({ reactions: get().reactions.filter((reaction) => reaction.id !== id) })
    )
  },

  reset: () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    set({ ...emptyState })
  }
}))

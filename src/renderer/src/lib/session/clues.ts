/**
 * Pistas da mesa (Fase 13): texto e/ou imagem que o mestre revela para todos ou para
 * jogadores escolhidos.
 *
 * Quem pode ver é decidido no banco (RLS); estas funções servem para o mestre **enxergar
 * o que ele está fazendo** antes de revelar — e é justamente aí que um erro custaria um
 * spoiler, então a regra fica aqui, testada, e não espalhada na tela.
 */

export const MAX_CLUE_TITLE = 120
export const MAX_CLUE_BODY = 4000
export const MAX_CLUE_TARGETS = 50

export interface Clue {
  id: string
  sessionId: string
  title: string
  body: string
  imagePath: string | null
  /** Revelada para a mesa inteira. */
  revealAll: boolean
  /** Ids de quem pode ver, quando não é para todos. */
  revealedTo: string[]
  sortOrder: number
  updatedAt: string
}

/** `hidden` = só o mestre tem; `some` = alguns jogadores; `all` = a mesa inteira. */
export type ClueReveal = 'hidden' | 'some' | 'all'

export function clueReveal(clue: Pick<Clue, 'revealAll' | 'revealedTo'>): ClueReveal {
  if (clue.revealAll) return 'all'
  return clue.revealedTo.length > 0 ? 'some' : 'hidden'
}

export function isRevealed(clue: Pick<Clue, 'revealAll' | 'revealedTo'>): boolean {
  return clueReveal(clue) !== 'hidden'
}

/** A mesma pergunta que o RLS faz. Usada pela tela do mestre para pré-visualizar. */
export function canSeeClue(
  clue: Pick<Clue, 'revealAll' | 'revealedTo'>,
  userId: string | null
): boolean {
  if (clue.revealAll) return true
  return userId !== null && clue.revealedTo.includes(userId)
}

export interface ClueAudience {
  userId: string
  displayName: string
}

/** "Revelada para Ana e Bruno" — o que o mestre lê na lista, sem precisar abrir. */
export function revealLabel(
  clue: Pick<Clue, 'revealAll' | 'revealedTo'>,
  members: readonly ClueAudience[]
): string {
  const reveal = clueReveal(clue)
  if (reveal === 'all') return 'Revelada para a mesa'
  if (reveal === 'hidden') return 'Só você'

  const names = clue.revealedTo
    .map((id) => members.find((member) => member.userId === id)?.displayName ?? '')
    .filter((name) => name !== '')

  if (names.length === 0) return `Revelada para ${clue.revealedTo.length} pessoa(s)`
  if (names.length === 1) return `Revelada para ${names[0] as string}`
  return `Revelada para ${names.slice(0, -1).join(', ')} e ${names.at(-1) as string}`
}

/** Liga ou desliga uma pessoa na lista de destinos, sem repetir. */
export function toggleClueTarget(clue: Clue, userId: string): Clue {
  const revealedTo = clue.revealedTo.includes(userId)
    ? clue.revealedTo.filter((id) => id !== userId)
    : [...clue.revealedTo, userId].slice(0, MAX_CLUE_TARGETS)

  // Escolher gente é o contrário de "para todos": uma coisa desliga a outra.
  return { ...clue, revealedTo, revealAll: false }
}

export interface ClueDraft {
  title: string
  body: string
  imagePath: string | null
}

/** Mensagem do que falta, ou `null` se a pista pode ser salva. */
export function clueProblem(draft: ClueDraft): string | null {
  const title = draft.title.trim()
  const body = draft.body.trim()

  if (title === '' && body === '' && draft.imagePath === null) {
    return 'Escreva um título, um texto ou escolha uma imagem.'
  }
  if (title.length > MAX_CLUE_TITLE) return `O título passa de ${MAX_CLUE_TITLE} caracteres.`
  if (body.length > MAX_CLUE_BODY) return `O texto passa de ${MAX_CLUE_BODY} caracteres.`
  return null
}

/** Título que a lista mostra quando a pista não tem um (é só imagem, por exemplo). */
export function clueHeadline(clue: Pick<Clue, 'title' | 'body' | 'imagePath'>): string {
  const title = clue.title.trim()
  if (title !== '') return title

  const firstLine = clue.body.trim().split('\n')[0] ?? ''
  if (firstLine !== '') return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine
  return clue.imagePath === null ? 'Pista sem título' : 'Imagem'
}

/**
 * A mudança tira o acesso de alguém?
 *
 * Importa porque um UPDATE que o RLS passa a esconder **não chega** a quem perdeu o
 * acesso: quando isto é verdade, o app avisa pelo canal para o jogador reconferir as
 * pistas dele (o mesmo problema do token oculto, 6.3).
 */
export function losesAccess(
  before: Pick<Clue, 'revealAll' | 'revealedTo'>,
  after: Pick<Clue, 'revealAll' | 'revealedTo'>
): boolean {
  if (before.revealAll && !after.revealAll) return true
  return before.revealedTo.some((id) => !canSeeClue(after, id))
}

export function sortClues(clues: readonly Clue[]): Clue[] {
  return [...clues].sort((a, b) =>
    a.sortOrder === b.sortOrder ? a.id.localeCompare(b.id) : a.sortOrder - b.sortOrder
  )
}

/** A pista nova entra no fim da lista. */
export function nextClueOrder(clues: readonly Clue[]): number {
  return clues.reduce((highest, clue) => Math.max(highest, clue.sortOrder), 0) + 1
}

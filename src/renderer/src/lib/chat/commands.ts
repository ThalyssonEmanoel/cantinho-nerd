/**
 * O que a pessoa digitou no chat (seção 7.2): mensagem, rolagem (`/r 2d6+3`) ou sussurro
 * (`/w Nome mensagem`). Função pura: a tela só executa o resultado.
 */

export interface ChatMember {
  userId: string
  displayName: string
  username: string
  role: 'gm' | 'player'
}

export type ChatCommand =
  | { kind: 'message'; body: string }
  | { kind: 'whisper'; recipientId: string; recipientName: string; body: string }
  | { kind: 'roll'; formula: string }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }

export const MAX_MESSAGE_LENGTH = 2000

/** Sem acento e minúsculo: "Joaõ" acha "joão", e "Clérigo" acha "clerigo". */
export function foldName(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Acha o destinatário no começo do texto. Nome de exibição pode ter espaço ("Ana Clara"),
 * então vale o nome mais **longo** que casa — senão "Ana" ganharia de "Ana Clara". Também
 * aceita o nome de usuário e a palavra "mestre".
 */
function matchRecipient(
  rest: string,
  members: readonly ChatMember[]
): { member: ChatMember; body: string } | null {
  // Em NFC cada letra acentuada é um caractere só; tirar o acento (foldName) então não muda
  // o tamanho, e a posição achada no texto dobrado vale no original.
  const source = rest.normalize('NFC')
  const folded = foldName(source)
  let best: { member: ChatMember; length: number } | null = null

  for (const member of members) {
    const names = [member.displayName, member.username, ...(member.role === 'gm' ? ['mestre'] : [])]
    for (const name of names) {
      const candidate = foldName(name)
      if (candidate === '') continue
      const matches =
        folded === candidate ||
        (folded.startsWith(candidate) && /\s/.test(folded.charAt(candidate.length)))
      if (matches && (best === null || candidate.length > best.length)) {
        best = { member, length: candidate.length }
      }
    }
  }

  if (best === null) return null
  return { member: best.member, body: source.slice(best.length).trim() }
}

export function parseChatInput(
  input: string,
  members: readonly ChatMember[],
  myUserId: string
): ChatCommand {
  const text = input.trim()
  if (text === '') return { kind: 'empty' }

  if (!text.startsWith('/')) {
    if (text.length > MAX_MESSAGE_LENGTH) {
      return { kind: 'error', message: `A mensagem pode ter até ${MAX_MESSAGE_LENGTH} caracteres.` }
    }
    return { kind: 'message', body: text }
  }

  const [command = '', ...restWords] = text.slice(1).split(/\s+/)
  const rest = text.slice(1 + command.length).trim()

  switch (command.toLowerCase()) {
    case 'r':
    case 'roll':
    case 'rolar': {
      if (rest === '') return { kind: 'error', message: 'Diga o que rolar. Ex.: /r 2d6+3' }
      return { kind: 'roll', formula: rest }
    }

    case 'w':
    case 'sussurro':
    case 'sussurrar': {
      if (restWords.length === 0) {
        return { kind: 'error', message: 'Para quem? Ex.: /w Ana mensagem' }
      }
      const others = members.filter((member) => member.userId !== myUserId)
      const match = matchRecipient(rest, others)
      if (match === null) {
        return { kind: 'error', message: 'Não achei ninguém com esse nome na mesa.' }
      }
      if (match.body === '') return { kind: 'error', message: 'Faltou a mensagem do sussurro.' }
      if (match.body.length > MAX_MESSAGE_LENGTH) {
        return {
          kind: 'error',
          message: `A mensagem pode ter até ${MAX_MESSAGE_LENGTH} caracteres.`
        }
      }
      return {
        kind: 'whisper',
        recipientId: match.member.userId,
        recipientName: match.member.displayName,
        body: match.body
      }
    }

    default:
      return {
        kind: 'error',
        message: 'Comando desconhecido. Use /r para rolar ou /w para sussurrar.'
      }
  }
}

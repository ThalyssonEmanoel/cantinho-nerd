import { buildJoinDeepLink } from '@shared/deep-link'

/**
 * Convite e senha das sessões (seções 4.3 e 4.5). Funções puras, testadas sem rede.
 */

const ANIMALS = [
  'lobo',
  'gato',
  'corvo',
  'urso',
  'raposa',
  'coruja',
  'dragao',
  'tigre',
  'falcao',
  'lince',
  'touro',
  'cobra',
  'grifo',
  'lebre',
  'javali',
  'aguia',
  'polvo',
  'sapo',
  'puma',
  'texugo'
]

const COLORS = [
  'azul',
  'verde',
  'roxo',
  'ruivo',
  'cinza',
  'dourado',
  'prata',
  'negro',
  'branco',
  'rubro',
  'jade',
  'ambar',
  'coral',
  'anil',
  'bronze',
  'lilas'
]

/** Número aleatório em [0, max), do gerador criptográfico. */
function randomBelow(max: number, random: () => number): number {
  return Math.floor(random() * max)
}

function cryptoRandom(): number {
  const buffer = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buffer)
  return (buffer[0] as number) / 2 ** 32
}

/**
 * Senha amigável, fácil de ditar no Discord (4.5): `lobo-azul-42`. Não é para ser forte —
 * é para não ser a senha pessoal de ninguém. O gerador é injetável nos testes.
 */
export function generateFriendlyPassword(random: () => number = cryptoRandom): string {
  const animal = ANIMALS[randomBelow(ANIMALS.length, random)] ?? 'lobo'
  const color = COLORS[randomBelow(COLORS.length, random)] ?? 'azul'
  const number = 10 + randomBelow(90, random)
  return `${animal}-${color}-${number}`
}

export const SESSION_PASSWORD_MIN = 4
export const SESSION_PASSWORD_MAX = 72
export const SESSION_NAME_MAX = 80

export function validateSessionPassword(password: string): string | null {
  if (password.length < SESSION_PASSWORD_MIN || password.length > SESSION_PASSWORD_MAX) {
    return `A senha da sessão precisa ter de ${SESSION_PASSWORD_MIN} a ${SESSION_PASSWORD_MAX} caracteres.`
  }
  return null
}

export function validateSessionName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Dê um nome para a sessão.'
  if (trimmed.length > SESSION_NAME_MAX) {
    return `O nome pode ter até ${SESSION_NAME_MAX} caracteres.`
  }
  return null
}

export interface InviteInfo {
  sessionName: string
  inviteId: string
  password: string
}

/**
 * Texto do "Copiar convite" (4.5): nome da sessão, link e senha, pronto para colar no
 * WhatsApp. O link `rpgmesa://` não é clicável lá — por isso vai também o código, para
 * colar em "Entrar numa mesa". Na Fase 12 o link vira https.
 */
export function buildInviteText({ sessionName, inviteId, password }: InviteInfo): string {
  return [
    `Bora jogar "${sessionName}" no Cantinho Nerd!`,
    `Link: ${buildJoinDeepLink(inviteId)}`,
    `Ou cole o código ${inviteId} em "Entrar numa mesa".`,
    `Senha: ${password}`
  ].join('\n')
}

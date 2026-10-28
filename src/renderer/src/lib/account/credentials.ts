/**
 * Regras da conta (seção 4.1): cadastro e login só com nome de usuário + senha.
 *
 * Por baixo é o Supabase Auth, que pede um e-mail. O app gera um e-mail interno a partir
 * do nome (`ana` → `ana@usuarios.rpgmesa.app`), que o usuário nunca vê. Por isso o nome
 * segue as regras da parte antes do @ de um e-mail — e as mesmas regras estão no banco
 * (profiles_username_format), para ninguém contornar o app.
 */

/**
 * Domínio fictício do e-mail interno. Não pode mudar depois que houver contas: o login
 * monta o e-mail com ele, e quem se cadastrou com outro domínio não entraria mais.
 */
export const INTERNAL_EMAIL_DOMAIN = 'usuarios.rpgmesa.app'

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const PASSWORD_MIN_LENGTH = 8
/** O Auth guarda a senha com bcrypt, que só considera os primeiros 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72
export const DISPLAY_NAME_MAX_LENGTH = 40
export const BIO_MAX_LENGTH = 300

const USERNAME_CHARS = /^[a-z0-9._-]+$/
const USERNAME_EDGES = /^[a-z0-9](?:.*[a-z0-9])?$/

/** Nome como o app guarda e compara: sem espaços nas pontas e minúsculo. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

/** Mensagem do primeiro problema do nome de usuário, ou `null` se estiver tudo certo. */
export function validateUsername(input: string): string | null {
  const username = normalizeUsername(input)

  if (username === '') return 'Escolha um nome de usuário.'
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `O nome de usuário precisa ter de ${USERNAME_MIN_LENGTH} a ${USERNAME_MAX_LENGTH} caracteres.`
  }
  if (!USERNAME_CHARS.test(username)) {
    return 'Use só letras sem acento, números, ponto, hífen e sublinhado — sem espaços.'
  }
  if (!USERNAME_EDGES.test(username)) return 'Comece e termine com uma letra ou um número.'
  if (username.includes('..')) return 'Não use dois pontos seguidos.'

  return null
}

export function internalEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  }
  return null
}

/**
 * Nome de exibição. No cadastro pode ficar vazio (vira o nome de usuário); no perfil, não.
 */
export function validateDisplayName(
  name: string,
  { required }: { required: boolean }
): string | null {
  const trimmed = name.trim()
  if (required && trimmed === '') return 'O nome de exibição não pode ficar vazio.'
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `O nome de exibição pode ter até ${DISPLAY_NAME_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validateBio(bio: string): string | null {
  return bio.length > BIO_MAX_LENGTH ? `A bio pode ter até ${BIO_MAX_LENGTH} caracteres.` : null
}

export interface SignUpInput {
  username: string
  displayName: string
  password: string
  confirmPassword: string
}

export type SignUpField = keyof SignUpInput

/** Erros do formulário de cadastro, por campo. Objeto vazio = pode enviar. */
export function validateSignUp(input: SignUpInput): Partial<Record<SignUpField, string>> {
  const errors: Partial<Record<SignUpField, string>> = {}

  const username = validateUsername(input.username)
  if (username !== null) errors.username = username

  const displayName = validateDisplayName(input.displayName, { required: false })
  if (displayName !== null) errors.displayName = displayName

  const password = validatePassword(input.password)
  if (password !== null) errors.password = password
  else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'As duas senhas não são iguais.'
  }

  return errors
}

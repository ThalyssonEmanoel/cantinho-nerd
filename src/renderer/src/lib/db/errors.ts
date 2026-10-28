/**
 * Erros do Supabase em português (regra do projeto: mensagem amigável, nunca o texto cru
 * do servidor). Funções puras: recebem só os campos que interessam, então dá para testar
 * sem rede e sem o cliente de verdade.
 */

/** O que importa de um AuthError do supabase-js. */
export interface AuthErrorLike {
  code?: string
  status?: number
  message?: string
  name?: string
}

/** O que importa de um PostgrestError / StorageError. */
export interface DbErrorLike {
  code?: string
  message?: string
  statusCode?: string | number
}

const OFFLINE_MESSAGE = 'Sem conexão com o servidor. Confira a internet e tente de novo.'

const CONFIRM_EMAIL_HINT =
  'O Supabase está pedindo confirmação de e-mail. No painel, desligue "Confirm email" em Authentication → Sign In / Providers → Email.'

function looksOffline(error: { message?: string; name?: string; status?: number }): boolean {
  const message = error.message ?? ''
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    /failed to fetch|network ?error|fetch failed|load failed/i.test(message)
  )
}

export function describeAuthError(error: AuthErrorLike): string {
  if (looksOffline(error)) return OFFLINE_MESSAGE

  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Esse nome de usuário já está em uso.'
    case 'invalid_credentials':
      return 'Nome de usuário ou senha incorretos.'
    case 'weak_password':
      return 'Senha fraca demais. Use pelo menos 8 caracteres.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'
    case 'email_not_confirmed':
    case 'email_address_not_authorized':
      return CONFIRM_EMAIL_HINT
    case 'email_address_invalid':
      return 'O Supabase recusou o e-mail interno da conta. Avise quem cuida do app.'
    case 'signup_disabled':
      return 'Os cadastros novos estão desligados no Supabase.'
    case 'email_provider_disabled':
      return 'O login por senha está desligado no Supabase (provedor de e-mail).'
    case 'session_expired':
    case 'refresh_token_not_found':
      return 'Sua sessão expirou. Entre de novo.'
  }

  // O gatilho que cria o perfil recusou o cadastro (nome fora das regras, por exemplo).
  if (/database error saving new user/i.test(error.message ?? '')) {
    return 'Não consegui criar o perfil. Confira o nome de usuário e tente de novo.'
  }

  return 'Não consegui completar agora. Tente de novo em instantes.'
}

export function describeDbError(error: DbErrorLike): string {
  if (looksOffline(error)) return OFFLINE_MESSAGE

  const code = error.code ?? ''
  const message = error.message ?? ''

  // Exceção levantada de propósito numa função nossa: a mensagem já é para o usuário.
  if (code === 'P0001' || code === 'P0002') return message

  if (
    code === '42501' ||
    code === 'AccessDenied' ||
    /row-level security|permission denied/i.test(message)
  ) {
    return 'Você não tem permissão para fazer isso.'
  }
  if (code === 'PGRST116') return 'Não encontrei o que você pediu. Talvez tenha sido excluído.'
  if (code === 'PGRST301' || /jwt expired/i.test(message)) {
    return 'Sua sessão expirou. Entre de novo.'
  }
  if (code === '23505') return 'Já existe um registro igual a este.'
  if (code === '23514') return 'Algum valor está fora do permitido.'
  if (code === '23503') return 'Este item está ligado a outro e não pode ser removido agora.'
  if (
    code === 'EntityTooLarge' ||
    String(error.statusCode) === '413' ||
    /payload too large|maximum allowed size/i.test(message)
  ) {
    return 'O arquivo é grande demais.'
  }
  if (code === 'InvalidMimeType') return 'Esse tipo de arquivo não é aceito aqui.'

  return 'Não consegui falar com o servidor agora. Tente de novo em instantes.'
}

/** Erro com mensagem já traduzida, para as telas mostrarem no toast. */
export class FriendlyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FriendlyError'
  }
}

/** Texto para o toast a partir de qualquer coisa que um `catch` receba. */
export function errorMessage(error: unknown): string {
  if (error instanceof FriendlyError) return error.message
  if (error instanceof Error && looksOffline(error)) return OFFLINE_MESSAGE
  return 'Algo deu errado. Tente de novo em instantes.'
}

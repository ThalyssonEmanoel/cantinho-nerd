/**
 * Atualização automática (Fase 12, decisões 78 a 83): o estado que o processo principal manda
 * para a tela, e os textos em português que a tela mostra.
 *
 * Fica em `shared` porque os dois lados usam: o principal produz o estado (é ele que fala
 * com o `electron-updater`) e o renderer só mostra.
 */
export type UpdateStatus =
  /** App rodando em desenvolvimento: não há instalador, então não procura nada. */
  | { state: 'disabled' }
  /** Ainda não procurou (a primeira procura espera o app abrir). */
  | { state: 'idle' }
  | { state: 'checking' }
  /** Procurou e esta já é a versão mais nova. */
  | { state: 'none' }
  | { state: 'downloading'; version: string; percent: number }
  /** Baixada: entra ao reiniciar ou ao fechar o app. */
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

/** Procura versão nova a cada 4 horas, além de logo depois de abrir (decisão 79). */
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** A primeira procura espera o app abrir, para não disputar a rede com o login e a mesa. */
export const FIRST_UPDATE_CHECK_DELAY_MS = 10_000

/** Dá para pedir uma procura agora? Não enquanto uma está andando nem com versão já baixada. */
export function canCheckForUpdate(status: UpdateStatus): boolean {
  return status.state === 'idle' || status.state === 'none' || status.state === 'error'
}

/** A frase da tela de Configurações para cada estado. */
export function describeUpdate(status: UpdateStatus): string {
  switch (status.state) {
    case 'disabled':
      return 'Em desenvolvimento o app não procura atualização: só o app instalado se atualiza sozinho.'
    case 'idle':
      return 'O app procura versão nova logo depois de abrir.'
    case 'checking':
      return 'Procurando versão nova…'
    case 'none':
      return 'Você está na versão mais nova.'
    case 'downloading':
      return `Baixando a versão ${status.version}… ${status.percent}%`
    case 'ready':
      return `A versão ${status.version} já foi baixada. Ela entra quando você reiniciar ou fechar o app.`
    case 'error':
      return status.message
  }
}

/**
 * O erro do `electron-updater` em português. As mensagens dele vêm em inglês e com detalhes
 * técnicos (URL, código HTTP); quem lê é o jogador, então vira uma frase do que fazer.
 */
export function updateErrorMessage(error: unknown): string {
  const text =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)

  if (
    /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_CONNECTION|ERR_TIMED_OUT|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(
      text
    )
  ) {
    return 'Sem conexão com o GitHub agora. O app tenta de novo sozinho mais tarde.'
  }
  if (/rate limit|\b403\b/i.test(text)) {
    return 'O GitHub limitou as consultas por agora. O app tenta de novo mais tarde.'
  }
  if (/latest\.yml/i.test(text)) {
    return 'A versão publicada no GitHub está sem o arquivo de atualização (latest.yml).'
  }
  if (/No published versions|\b404\b/i.test(text)) {
    return 'Ainda não há versão publicada no GitHub.'
  }
  if (/sha512|checksum/i.test(text)) {
    return 'O arquivo baixado veio diferente do publicado. O app baixa de novo na próxima procura.'
  }
  return 'Não consegui procurar atualização agora. O app tenta de novo mais tarde.'
}

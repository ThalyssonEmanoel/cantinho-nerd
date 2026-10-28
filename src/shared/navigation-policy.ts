/**
 * Política de navegação do Electron (seção 10.4 da especificação).
 *
 * Mantida fora do processo principal para poder ser testada: é ela que decide se uma URL
 * pode ser aberta dentro do app, mandada para o navegador do sistema, ou simplesmente
 * descartada. Sem isso, um link colado no chat poderia navegar a janela do app para
 * fora dele (ou pior, para um `file://` qualquer).
 */

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

/** Só http/https vão para o navegador padrão — nunca `file:`, `javascript:` ou o nosso próprio esquema. */
export function canOpenExternally(raw: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(raw).protocol)
  } catch {
    return false
  }
}

/**
 * Navegação interna permitida: o `file://` do app empacotado e o servidor do Vite em dev.
 * Como usamos HashRouter, trocar de rota não dispara `will-navigate`, então qualquer
 * navegação de verdade que não seja essas duas é suspeita.
 */
export function isInternalNavigation(raw: string, devOrigin?: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol === 'file:') return true

  if (devOrigin !== undefined && devOrigin !== '') {
    try {
      if (url.origin === new URL(devOrigin).origin) return true
    } catch {
      return false
    }
  }

  return false
}

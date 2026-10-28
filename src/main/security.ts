import { session, shell, type BrowserWindow } from 'electron'
import { buildContentSecurityPolicy } from '../shared/csp'
import { canOpenExternally, isInternalNavigation } from '../shared/navigation-policy'

/**
 * Injetado em tempo de build a partir do .env (ver electron.vite.config.ts): o processo
 * principal não recebe as variáveis VITE_* em tempo de execução.
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''

/**
 * Nenhuma permissão do Chromium é liberada, com uma exceção: a escrita sanitizada no
 * clipboard, que o botão "copiar convite" usa. Câmera, microfone, notificações,
 * geolocalização e afins ficam negados.
 */
const ALLOWED_PERMISSIONS = new Set<string>(['clipboard-sanitized-write'])

/** Abre links externos no navegador padrão; devolve false se o esquema não for http/https. */
export function openExternalSafely(url: string): boolean {
  if (!canOpenExternally(url)) return false
  void shell.openExternal(url)
  return true
}

/** Aplica CSP e política de permissões na sessão padrão. Chamar depois do app pronto. */
export function applySessionPolicies(isDev: boolean, devOrigin?: string): void {
  const { defaultSession } = session
  const csp = buildContentSecurityPolicy({ isDev, supabaseUrl, devOrigin })

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  )
}

/**
 * Trava a janela dentro do app: nada de navegar para fora, abrir janelas novas ou anexar
 * webviews. Links de usuário (chat, pistas) vão para o navegador do sistema.
 */
export function applyNavigationGuards(window: BrowserWindow, devOrigin?: string): void {
  const { webContents } = window

  webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })

  webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(url, devOrigin)) return
    event.preventDefault()
    openExternalSafely(url)
  })

  webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

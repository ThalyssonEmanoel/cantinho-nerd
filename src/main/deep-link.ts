import { resolve } from 'node:path'
import { app } from 'electron'
import { findDeepLinkInArgv, parseDeepLink, type DeepLink } from '../shared/deep-link'
import { IpcChannel } from '../shared/ipc'
import { isSecondaryProfile } from './profile'
import { focusMainWindow, getMainWindow } from './window'

const PROTOCOL = 'rpgmesa'

/**
 * Link que chegou antes do renderer estar pronto (o caso comum: o clique no link abre o
 * app). Fica guardado até o renderer pedir, o que também cobre o caso "ainda não fiz
 * login": a tela de login consome o convite depois de autenticar.
 */
let pendingDeepLink: DeepLink | null = null

export function registerDeepLinkProtocol(): void {
  // A segunda instância de desenvolvimento (dev:p2) não deve roubar os links do sistema.
  if (isSecondaryProfile) return

  if (process.defaultApp) {
    // Em dev o executável é o electron.exe, então o Windows precisa receber também o
    // caminho do projeto para reabrir o app corretamente.
    const projectPath = process.argv[1]
    if (projectPath !== undefined) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(projectPath)])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

export function rememberDeepLink(link: DeepLink | null): void {
  if (link !== null) pendingDeepLink = link
}

export function consumePendingDeepLink(): DeepLink | null {
  const link = pendingDeepLink
  pendingDeepLink = null
  return link
}

/**
 * Entrega o link ao renderer. Se a janela ainda não existe ou ainda está carregando,
 * guardamos: o renderer busca o pendente quando monta.
 */
export function deliverDeepLink(link: DeepLink | null): void {
  if (link === null) return

  const window = getMainWindow()
  if (window === null || window.webContents.isLoading()) {
    rememberDeepLink(link)
    return
  }

  focusMainWindow()
  window.webContents.send(IpcChannel.deepLink, link)
}

/** Windows/Linux: o link vem na linha de comando da instância que tentou abrir. */
export function handleArgv(argv: readonly string[]): void {
  deliverDeepLink(findDeepLinkInArgv(argv))
}

/** macOS: o link chega pelo evento open-url. */
export function handleOpenUrl(url: string): void {
  deliverDeepLink(parseDeepLink(url))
}

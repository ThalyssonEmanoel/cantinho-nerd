import { app, BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { findDeepLinkInArgv } from '../shared/deep-link'
import { handleArgv, handleOpenUrl, registerDeepLinkProtocol, rememberDeepLink } from './deep-link'
import { registerIpcHandlers } from './ipc'
import { applyDataProfile, isSecondaryProfile } from './profile'
import { applySessionPolicies } from './security'
import { createMainWindow, focusMainWindow, getDevOrigin } from './window'

const APP_USER_MODEL_ID = 'app.rpgmesa.cantinhonerd'

// Antes de tudo: o perfil de dados precisa ser trocado antes do app ficar pronto.
applyDataProfile()

/**
 * Instância única: o deep link `rpgmesa://join/...` tem que cair na janela já aberta,
 * em vez de abrir um segundo app. A segunda instância de desenvolvimento (dev:p2) é a
 * exceção — ela existe justamente para rodar em paralelo.
 */
const hasInstanceLock = isSecondaryProfile || app.requestSingleInstanceLock()

if (!hasInstanceLock) {
  app.quit()
} else {
  start()
}

function start(): void {
  registerDeepLinkProtocol()
  // O link que abriu o app chega na linha de comando desta própria instância.
  rememberDeepLink(findDeepLinkInArgv(process.argv))

  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    handleArgv(argv)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleOpenUrl(url)
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId(APP_USER_MODEL_ID)
    applySessionPolicies(is.dev, getDevOrigin())
    registerIpcHandlers()

    // Em dev libera F12 (DevTools); em produção desliga os atalhos de recarregar.
    app.on('browser-window-created', (_event, window) => optimizer.watchWindowShortcuts(window))

    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IpcChannel } from '../shared/ipc'
import { FIRST_UPDATE_CHECK_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from '../shared/update'
import { createUpdateController, type UpdaterLike } from './update-controller'

/**
 * Liga a atualização automática (Fase 12, decisões 78 a 83).
 *
 * De onde vem a versão nova: o `electron-builder` grava no instalador um `app-update.yml`
 * apontando para as releases do GitHub (`publish` em `electron-builder.yml`), e o
 * `electron-updater` lê o `latest.yml` da release mais nova. O repositório é público, então
 * o app não leva token nenhum.
 *
 * Só o app instalado procura: em desenvolvimento não existe `app-update.yml` (e a segunda
 * instância do `dev:p2` nunca é empacotada).
 */
export function startAutoUpdates(): void {
  const enabled = app.isPackaged

  const controller = createUpdateController({
    // O tipo do `autoUpdater` tem os eventos tipados um a um; o controlador usa só uma parte.
    updater: enabled ? (autoUpdater as unknown as UpdaterLike) : null,
    publish: (status) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(IpcChannel.updateChanged, status)
      }
    }
  })

  // Nenhum dos três recebe nada do renderer: ele só pergunta, pede uma procura ou pede para
  // reiniciar — e reiniciar só acontece se já há versão baixada.
  ipcMain.handle(IpcChannel.updateStatus, () => controller.status())
  ipcMain.handle(IpcChannel.updateCheck, () => controller.check())
  ipcMain.handle(IpcChannel.updateInstall, () => controller.install())

  if (!enabled) return
  setTimeout(() => void controller.check(), FIRST_UPDATE_CHECK_DELAY_MS)
  setInterval(() => void controller.check(), UPDATE_CHECK_INTERVAL_MS)
}

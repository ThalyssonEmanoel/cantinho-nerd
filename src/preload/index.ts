import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type AppInfo,
  type DeepLink,
  type OpenTextFileRequest,
  type SaveTextFileRequest,
  type TextFileResult
} from '../shared/ipc'

/**
 * Ponte mínima entre o renderer e o processo principal (seção 10.4): só o que o app
 * precisa, nada de expor `ipcRenderer` inteiro nem módulos do Node. Cada função nova aqui
 * aumenta a superfície de ataque, então a lista fica curta de propósito.
 */
const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IpcChannel.appInfo),

  /** Abre http/https no navegador padrão. Qualquer outro esquema é recusado no principal. */
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IpcChannel.openExternal, url),

  /** Deep link que chegou antes do renderer existir (clique no convite abriu o app). */
  takePendingDeepLink: (): Promise<DeepLink | null> =>
    ipcRenderer.invoke(IpcChannel.pendingDeepLink),

  /** Salva texto num arquivo escolhido na janela nativa (exportar modelo de ficha). */
  saveTextFile: (request: SaveTextFileRequest): Promise<TextFileResult> =>
    ipcRenderer.invoke(IpcChannel.saveTextFile, request),

  /** Abre um arquivo de texto escolhido na janela nativa (importar modelo de ficha). */
  openTextFile: (request?: OpenTextFileRequest): Promise<TextFileResult> =>
    ipcRenderer.invoke(IpcChannel.openTextFile, request ?? {}),

  /** Deep link com o app já aberto. Devolve a função para remover o listener. */
  onDeepLink: (callback: (link: DeepLink) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, link: DeepLink): void => callback(link)
    ipcRenderer.on(IpcChannel.deepLink, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannel.deepLink, listener)
    }
  }
}

export type CantinhoApi = typeof api

// contextIsolation é sempre true (ver window.ts), então o contextBridge é o único caminho.
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Falha ao expor a API do preload:', error)
}

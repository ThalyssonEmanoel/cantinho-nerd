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

  /**
   * Cache local das imagens do Storage (10.2). A chave é o nome do arquivo, que é o hash
   * do conteúdo — então nunca aponta para outra imagem e vale cache eterno.
   */
  readCachedAsset: (key: string): Promise<Uint8Array | null> =>
    ipcRenderer.invoke(IpcChannel.readCachedAsset, key),

  writeCachedAsset: (key: string, data: Uint8Array): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannel.writeCachedAsset, key, data),

  /** Tamanho do cache de imagens em disco, em bytes (Configurações). */
  assetCacheSize: (): Promise<number> => ipcRenderer.invoke(IpcChannel.assetCacheSize),

  /** Apaga o cache de imagens; devolve quantos bytes liberou. */
  clearAssetCache: (): Promise<number> => ipcRenderer.invoke(IpcChannel.clearAssetCache),

  /** Abre a ficha numa janela separada, para o segundo monitor (Fase 13). */
  openSheetWindow: (sessionId: string, sheetId: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannel.openSheetWindow, { sessionId, sheetId }),

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

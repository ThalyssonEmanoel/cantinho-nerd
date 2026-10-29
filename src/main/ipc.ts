import { basename } from 'node:path'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { app, dialog, ipcMain } from 'electron'
import {
  IpcChannel,
  MAX_TEXT_FILE_BYTES,
  type AppInfo,
  type FileFilter,
  type TextFileResult
} from '../shared/ipc'
import {
  assetCacheSize,
  clearAssetCache,
  readCachedAsset,
  writeCachedAsset
} from './asset-cache'
import { consumePendingDeepLink } from './deep-link'
import { profileName } from './profile'
import { openExternalSafely } from './security'
import { getMainWindow } from './window'

/** Filtros vindos do renderer: só o que a janela de arquivo precisa, sem sobras. */
function sanitizeFilters(value: unknown): FileFilter[] | undefined {
  if (!Array.isArray(value)) return undefined

  const filters: FileFilter[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const { name, extensions } = item as { name?: unknown; extensions?: unknown }
    if (typeof name !== 'string' || !Array.isArray(extensions)) continue
    filters.push({
      name: name.slice(0, 60),
      extensions: extensions.filter((ext): ext is string => typeof ext === 'string').slice(0, 10)
    })
  }

  return filters.length === 0 ? undefined : filters
}

/**
 * Salva texto num arquivo escolhido pela pessoa.
 *
 * O caminho vem sempre da janela nativa de salvar — o renderer não escolhe onde escrever,
 * então não há como ele gravar em lugar nenhum sem o usuário ver e confirmar.
 */
async function handleSaveTextFile(request: unknown): Promise<TextFileResult> {
  if (typeof request !== 'object' || request === null) {
    return { status: 'error', message: 'Pedido inválido.' }
  }

  const { suggestedName, text, filters } = request as {
    suggestedName?: unknown
    text?: unknown
    filters?: unknown
  }

  if (typeof text !== 'string' || typeof suggestedName !== 'string') {
    return { status: 'error', message: 'Pedido inválido.' }
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_FILE_BYTES) {
    return { status: 'error', message: 'O conteúdo é grande demais para ser salvo.' }
  }

  const window = getMainWindow()
  const options = {
    defaultPath: basename(suggestedName),
    filters: sanitizeFilters(filters)
  }

  const result =
    window === null
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(window, options)

  if (result.canceled || result.filePath === undefined || result.filePath === '') {
    return { status: 'canceled' }
  }

  try {
    await writeFile(result.filePath, text, 'utf8')
    return { status: 'saved', path: result.filePath }
  } catch (error) {
    console.error('Falha ao salvar arquivo:', error)
    return { status: 'error', message: 'Não consegui salvar o arquivo.' }
  }
}

/** Lê um arquivo de texto escolhido pela pessoa, com teto de tamanho. */
async function handleOpenTextFile(request: unknown): Promise<TextFileResult> {
  const { filters } = (request ?? {}) as { filters?: unknown }

  const window = getMainWindow()
  const options = {
    properties: ['openFile' as const],
    filters: sanitizeFilters(filters)
  }

  const result =
    window === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(window, options)

  const [path] = result.filePaths
  if (result.canceled || path === undefined) return { status: 'canceled' }

  try {
    const info = await stat(path)
    if (info.size > MAX_TEXT_FILE_BYTES) {
      return { status: 'error', message: 'O arquivo é grande demais.' }
    }
    const text = await readFile(path, 'utf8')
    return { status: 'opened', name: basename(path), text }
  } catch (error) {
    console.error('Falha ao abrir arquivo:', error)
    return { status: 'error', message: 'Não consegui ler o arquivo.' }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    profile: profileName,
    platform: process.platform
  }))

  // O renderer manda a URL; validamos aqui porque o preload é apenas uma ponte.
  ipcMain.handle(IpcChannel.openExternal, (_event, url: unknown) =>
    typeof url === 'string' ? openExternalSafely(url) : false
  )

  ipcMain.handle(IpcChannel.pendingDeepLink, () => consumePendingDeepLink())

  ipcMain.handle(IpcChannel.saveTextFile, (_event, request: unknown) => handleSaveTextFile(request))
  ipcMain.handle(IpcChannel.openTextFile, (_event, request: unknown) => handleOpenTextFile(request))

  // Cache das imagens do Storage (10.2). A chave é validada no asset-cache.
  ipcMain.handle(IpcChannel.readCachedAsset, (_event, key: unknown) => readCachedAsset(key))
  ipcMain.handle(IpcChannel.writeCachedAsset, (_event, key: unknown, data: unknown) =>
    writeCachedAsset(key, data)
  )
  // Tela de Configurações: tamanho e limpeza do cache. Não recebem nada do renderer.
  ipcMain.handle(IpcChannel.assetCacheSize, () => assetCacheSize())
  ipcMain.handle(IpcChannel.clearAssetCache, () => clearAssetCache())
}

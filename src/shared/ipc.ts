import type { DeepLink } from './deep-link'

/**
 * Contrato entre processo principal, preload e renderer.
 * Os nomes dos canais ficam num só lugar para não haver string solta de um lado só.
 */
export const IpcChannel = {
  appInfo: 'app:info',
  openExternal: 'shell:open-external',
  pendingDeepLink: 'deep-link:pending',
  deepLink: 'deep-link',
  saveTextFile: 'file:save-text',
  openTextFile: 'file:open-text',
  readCachedAsset: 'asset:read',
  writeCachedAsset: 'asset:write',
  assetCacheSize: 'asset:cache-size',
  clearAssetCache: 'asset:cache-clear'
} as const

/** Limite dos arquivos de texto que o app lê e escreve (modelos de ficha em .json). */
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024

/** Teto de cada imagem guardada no cache local (10.2). */
export const MAX_CACHED_ASSET_BYTES = 12 * 1024 * 1024

/**
 * Chave do cache de imagens: o nome do arquivo no Storage, que é o hash do conteúdo.
 *
 * A chave vem do renderer e vira caminho em disco no processo principal, então aqui é
 * onde se garante que ela é só um nome — sem barra, sem `..`, sem letra de unidade.
 */
export function isSafeAssetKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key) &&
    !key.includes('..')
  )
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface SaveTextFileRequest {
  suggestedName: string
  text: string
  filters?: FileFilter[]
}

export interface OpenTextFileRequest {
  filters?: FileFilter[]
}

export type TextFileResult =
  | { status: 'saved'; path: string }
  | { status: 'opened'; name: string; text: string }
  | { status: 'canceled' }
  | { status: 'error'; message: string }

export interface AppInfo {
  version: string
  /** Perfil de dados em uso: 'default' ou o valor de RPGMESA_PROFILE (ex.: 'p2'). */
  profile: string
  platform: string
}

export type { DeepLink }

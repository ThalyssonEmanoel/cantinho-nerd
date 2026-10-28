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
  openTextFile: 'file:open-text'
} as const

/** Limite dos arquivos de texto que o app lê e escreve (modelos de ficha em .json). */
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024

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

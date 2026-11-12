import { updateErrorMessage, type UpdateStatus } from '../shared/update'

/**
 * O que o controlador usa do `autoUpdater` do `electron-updater`. É uma interface, e não o
 * tipo dele, para os testes passarem um dublê sem subir o Electron.
 */
export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: UpdaterEvent, listener: (arg?: unknown) => void): unknown
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export type UpdaterEvent =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error'

export interface UpdateController {
  status: () => UpdateStatus
  /** Procura versão nova (ao abrir, a cada 4 horas e no botão das Configurações). */
  check: () => Promise<UpdateStatus>
  /** Reinicia instalando a versão baixada. Devolve false se não há o que instalar. */
  install: () => boolean
}

function versionOf(info: unknown): string {
  const version = (info as { version?: unknown } | undefined)?.version
  return typeof version === 'string' ? version : ''
}

function percentOf(progress: unknown): number {
  const percent = (progress as { percent?: unknown } | undefined)?.percent
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, Math.floor(percent)))
}

/**
 * A atualização automática (decisões 78 a 83), sem o Electron: o `updater` é o
 * `autoUpdater` de verdade no app instalado e `null` em desenvolvimento.
 *
 * Baixa sozinho assim que acha versão nova e instala ao fechar o app (`autoInstallOnAppQuit`).
 * Nunca reinicia por conta própria: isso derrubaria a pessoa da mesa no meio da sessão. Só
 * `install`, que vem do botão "Reiniciar agora", reinicia.
 */
export function createUpdateController(options: {
  updater: UpdaterLike | null
  /** Manda o estado novo para as janelas. */
  publish: (status: UpdateStatus) => void
}): UpdateController {
  const { updater, publish } = options
  let current: UpdateStatus = updater === null ? { state: 'disabled' } : { state: 'idle' }
  let pending: Promise<UpdateStatus> | null = null

  function set(next: UpdateStatus): void {
    current = next
    publish(next)
  }

  /** Uma versão baixada não volta atrás por causa de um erro ou de uma procura depois. */
  const settled = (): boolean => current.state === 'ready'

  /**
   * O `electron-updater` emite o evento `error` e também rejeita o `checkForUpdates` com o
   * mesmo objeto (visto no app empacotado): sem isto, cada falha saía duas vezes no log e na
   * tela.
   */
  let lastError: unknown = undefined

  function fail(error: unknown): void {
    if (error === lastError) return
    lastError = error
    console.error('Atualização automática:', error)
    if (!settled()) set({ state: 'error', message: updateErrorMessage(error) })
  }

  if (updater !== null) {
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true

    updater.on('checking-for-update', () => {
      if (!settled() && current.state !== 'downloading') set({ state: 'checking' })
    })
    updater.on('update-available', (info) => {
      if (!settled()) set({ state: 'downloading', version: versionOf(info), percent: 0 })
    })
    updater.on('download-progress', (progress) => {
      if (current.state !== 'downloading') return
      const percent = percentOf(progress)
      // O evento vem muitas vezes por segundo; a tela só precisa saber quando o número muda.
      if (percent !== current.percent) set({ ...current, percent })
    })
    updater.on('update-downloaded', (info) => {
      set({ state: 'ready', version: versionOf(info) })
    })
    updater.on('update-not-available', () => {
      if (!settled()) set({ state: 'none' })
    })
    updater.on('error', fail)
  }

  return {
    status: () => current,

    check: () => {
      if (updater === null || settled() || current.state === 'downloading') {
        return Promise.resolve(current)
      }
      // Uma procura de cada vez: o botão e a procura a cada 4 horas podem coincidir.
      if (pending !== null) return pending

      pending = updater
        .checkForUpdates()
        .then(() => current)
        .catch((error: unknown) => {
          fail(error)
          return current
        })
        .finally(() => {
          pending = null
        })
      return pending
    },

    install: () => {
      if (updater === null || current.state !== 'ready') return false
      // Silencioso e abrindo o app de novo no fim: a pessoa pediu para reiniciar, não para
      // passar pelas telas do instalador.
      updater.quitAndInstall(true, true)
      return true
    }
  }
}

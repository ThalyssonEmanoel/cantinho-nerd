import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { UpdateStatus } from '../shared/update'
import { createUpdateController, type UpdaterLike } from './update-controller'

/**
 * A atualização automática (decisões 78 a 83) sem o Electron: o `autoUpdater` vira um
 * dublê que emite os mesmos eventos, na mesma ordem que o `electron-updater`.
 */

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  checkForUpdates = vi.fn(async (): Promise<unknown> => null)
  quitAndInstall = vi.fn()
}

function setup(): {
  updater: FakeUpdater
  published: UpdateStatus[]
  controller: ReturnType<typeof createUpdateController>
} {
  const updater = new FakeUpdater()
  const published: UpdateStatus[] = []
  const controller = createUpdateController({
    updater,
    publish: (status) => published.push(status)
  })
  return { updater, published, controller }
}

describe('atualização automática', () => {
  it('baixa sozinho e instala ao fechar, sem reiniciar por conta própria', () => {
    const { updater } = setup()
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('acha versão nova, baixa e fica pronta', async () => {
    const { updater, published, controller } = setup()
    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit('checking-for-update')
      updater.emit('update-available', { version: '0.3.0' })
      return null
    })

    expect(controller.status()).toEqual({ state: 'idle' })
    await controller.check()
    expect(published).toEqual([
      { state: 'checking' },
      { state: 'downloading', version: '0.3.0', percent: 0 }
    ])

    updater.emit('download-progress', { percent: 41.7 })
    updater.emit('download-progress', { percent: 41.9 })
    updater.emit('download-progress', { percent: 100 })
    updater.emit('update-downloaded', { version: '0.3.0' })

    // 41,7 e 41,9 são o mesmo número na tela: o segundo não vira aviso.
    expect(published.slice(2)).toEqual([
      { state: 'downloading', version: '0.3.0', percent: 41 },
      { state: 'downloading', version: '0.3.0', percent: 100 },
      { state: 'ready', version: '0.3.0' }
    ])
    expect(controller.status()).toEqual({ state: 'ready', version: '0.3.0' })
  })

  it('sem versão nova, diz que está em dia', async () => {
    const { updater, controller } = setup()
    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit('checking-for-update')
      updater.emit('update-not-available', { version: '0.2.0' })
      return null
    })
    expect(await controller.check()).toEqual({ state: 'none' })
  })

  it('erro vira frase em português, e a próxima procura tenta de novo', async () => {
    const { updater, controller } = setup()
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    updater.checkForUpdates.mockRejectedValueOnce(new Error('net::ERR_INTERNET_DISCONNECTED'))

    const status = await controller.check()
    expect(status.state).toBe('error')
    expect(status.state === 'error' && status.message).toMatch(/Sem conexão/)

    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit('update-not-available')
      return null
    })
    expect(await controller.check()).toEqual({ state: 'none' })
    quiet.mockRestore()
  })

  it('o mesmo erro, emitido e rejeitado, conta uma vez só', async () => {
    const { updater, published, controller } = setup()
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Cannot find latest.yml in the latest release artifacts: HttpError: 404')
    // É o que o electron-updater faz: emite `error` e rejeita com o mesmo objeto.
    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit('error', error)
      throw error
    })

    await controller.check()
    expect(quiet).toHaveBeenCalledTimes(1)
    expect(published.filter((status) => status.state === 'error')).toHaveLength(1)
    quiet.mockRestore()
  })

  it('uma procura de cada vez', async () => {
    const { updater, controller } = setup()
    let finish: () => void = () => {}
    updater.checkForUpdates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(null)
        })
    )

    const first = controller.check()
    const second = controller.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    finish()
    await Promise.all([first, second])
  })

  it('com a versão baixada, não procura de novo nem volta atrás por um erro', async () => {
    const { updater, controller } = setup()
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    updater.emit('update-downloaded', { version: '0.3.0' })

    await controller.check()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()

    updater.emit('error', new Error('qualquer coisa'))
    expect(controller.status()).toEqual({ state: 'ready', version: '0.3.0' })
    quiet.mockRestore()
  })

  it('"Reiniciar agora" instala em silêncio e abre o app de novo', () => {
    const { updater, controller } = setup()
    expect(controller.install()).toBe(false)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()

    updater.emit('update-downloaded', { version: '0.3.0' })
    expect(controller.install()).toBe(true)
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('em desenvolvimento fica desligada e não procura nada', async () => {
    const published: UpdateStatus[] = []
    const controller = createUpdateController({
      updater: null,
      publish: (status) => published.push(status)
    })

    expect(await controller.check()).toEqual({ state: 'disabled' })
    expect(controller.install()).toBe(false)
    expect(published).toEqual([])
  })
})

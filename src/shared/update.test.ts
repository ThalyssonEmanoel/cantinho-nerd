import { describe, expect, it } from 'vitest'
import { canCheckForUpdate, describeUpdate, updateErrorMessage } from './update'

/** Os textos da atualização automática: quem lê é o jogador, não quem programou. */

describe('frases da atualização', () => {
  it('cada estado tem a sua', () => {
    expect(describeUpdate({ state: 'none' })).toBe('Você está na versão mais nova.')
    expect(describeUpdate({ state: 'downloading', version: '0.3.0', percent: 42 })).toBe(
      'Baixando a versão 0.3.0… 42%'
    )
    expect(describeUpdate({ state: 'ready', version: '0.3.0' })).toMatch(
      /0\.3\.0 já foi baixada.*reiniciar ou fechar/
    )
    expect(describeUpdate({ state: 'error', message: 'Sem conexão.' })).toBe('Sem conexão.')
    expect(describeUpdate({ state: 'disabled' })).toMatch(/só o app instalado/)
  })

  it('só deixa procurar quando nada está andando', () => {
    expect(canCheckForUpdate({ state: 'idle' })).toBe(true)
    expect(canCheckForUpdate({ state: 'none' })).toBe(true)
    expect(canCheckForUpdate({ state: 'error', message: '' })).toBe(true)
    expect(canCheckForUpdate({ state: 'checking' })).toBe(false)
    expect(canCheckForUpdate({ state: 'downloading', version: '1', percent: 3 })).toBe(false)
    expect(canCheckForUpdate({ state: 'ready', version: '1' })).toBe(false)
    expect(canCheckForUpdate({ state: 'disabled' })).toBe(false)
  })
})

describe('erros do electron-updater em português', () => {
  it('sem internet', () => {
    expect(updateErrorMessage(new Error('net::ERR_INTERNET_DISCONNECTED'))).toMatch(/Sem conexão/)
    expect(updateErrorMessage(new Error('getaddrinfo ENOTFOUND github.com'))).toMatch(/Sem conexão/)
  })

  it('nada publicado ainda', () => {
    expect(updateErrorMessage(new Error('No published versions on GitHub'))).toBe(
      'Ainda não há versão publicada no GitHub.'
    )
  })

  it('release sem o latest.yml (publicada à mão, sem passar pelo GitHub Actions)', () => {
    const error = new Error(
      'Cannot find latest.yml in the latest release artifacts (https://github.com/x/y/releases/download/v0.2.0/latest.yml): HttpError: 404'
    )
    expect(updateErrorMessage(error)).toMatch(/sem o arquivo de atualização/)
  })

  it('limite de consultas do GitHub', () => {
    expect(updateErrorMessage(new Error('HttpError: 403 rate limit exceeded'))).toMatch(/limitou/)
  })

  it('o resto vira uma frase genérica, sem detalhe técnico', () => {
    const message = updateErrorMessage(new Error('EPERM: operation not permitted, C:\\temp\\x'))
    expect(message).toMatch(/Não consegui procurar atualização/)
    expect(message).not.toMatch(/EPERM/)
    expect(updateErrorMessage('qualquer coisa')).toMatch(/Não consegui/)
    expect(updateErrorMessage(undefined)).toMatch(/Não consegui/)
  })
})

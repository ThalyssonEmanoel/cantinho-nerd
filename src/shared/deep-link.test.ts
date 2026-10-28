import { describe, expect, it } from 'vitest'
import { buildJoinDeepLink, extractInviteId, findDeepLinkInArgv, parseDeepLink } from './deep-link'

describe('parseDeepLink', () => {
  it('aceita o formato rpgmesa://join/<inviteId>', () => {
    expect(parseDeepLink('rpgmesa://join/lobo-azul-42')).toEqual({
      kind: 'join',
      inviteId: 'lobo-azul-42'
    })
  })

  it('ignora espaços em volta e barra no fim', () => {
    expect(parseDeepLink('  rpgmesa://join/abc123/  ')).toEqual({
      kind: 'join',
      inviteId: 'abc123'
    })
  })

  it('aceita a ação em maiúsculas (o Windows normaliza o host)', () => {
    expect(parseDeepLink('rpgmesa://JOIN/abc123')).toEqual({ kind: 'join', inviteId: 'abc123' })
  })

  it('recusa outro esquema', () => {
    expect(parseDeepLink('https://join/abc123')).toBeNull()
  })

  it('recusa ação desconhecida', () => {
    expect(parseDeepLink('rpgmesa://sair/abc123')).toBeNull()
  })

  it('recusa link sem id', () => {
    expect(parseDeepLink('rpgmesa://join')).toBeNull()
    expect(parseDeepLink('rpgmesa://join/')).toBeNull()
  })

  it('recusa id com caracteres fora do formato esperado', () => {
    expect(parseDeepLink('rpgmesa://join/../../etc/passwd')).toBeNull()
    expect(parseDeepLink('rpgmesa://join/abc%20123')).toBeNull()
  })

  it('não lança com entrada inválida', () => {
    expect(() => parseDeepLink('isso não é um link')).not.toThrow()
    expect(parseDeepLink('')).toBeNull()
  })
})

describe('findDeepLinkInArgv', () => {
  it('encontra o link entre as flags do Chromium', () => {
    const argv = ['C:\\app\\cantinho-nerd.exe', '--allow-file-access', 'rpgmesa://join/abc123']
    expect(findDeepLinkInArgv(argv)).toEqual({ kind: 'join', inviteId: 'abc123' })
  })

  it('devolve null quando não há link', () => {
    expect(findDeepLinkInArgv(['C:\\app\\cantinho-nerd.exe'])).toBeNull()
  })
})

describe('buildJoinDeepLink', () => {
  it('fecha o ciclo com parseDeepLink', () => {
    expect(parseDeepLink(buildJoinDeepLink('abc123'))).toEqual({ kind: 'join', inviteId: 'abc123' })
  })
})

describe('extractInviteId', () => {
  it('aceita o id colado direto', () => {
    expect(extractInviteId('lobo-azul-42')).toBe('lobo-azul-42')
    expect(extractInviteId('  abc123  ')).toBe('abc123')
  })

  it('aceita o deep link', () => {
    expect(extractInviteId('rpgmesa://join/abc123')).toBe('abc123')
  })

  it('aceita o link do site (formato da Fase 12)', () => {
    expect(extractInviteId('https://cantinho.exemplo/join?id=abc123')).toBe('abc123')
  })

  it('recusa texto sem id utilizável', () => {
    expect(extractInviteId('')).toBeNull()
    expect(extractInviteId('   ')).toBeNull()
    expect(extractInviteId('bom jogo pessoal')).toBeNull()
    expect(extractInviteId('https://cantinho.exemplo/join')).toBeNull()
    expect(extractInviteId('rpgmesa://sair/abc123')).toBeNull()
  })
})

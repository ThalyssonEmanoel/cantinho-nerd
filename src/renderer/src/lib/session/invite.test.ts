import { describe, expect, it } from 'vitest'
import { extractInviteId } from '@shared/deep-link'
import {
  buildInviteText,
  generateFriendlyPassword,
  validateSessionName,
  validateSessionPassword
} from './invite'

describe('generateFriendlyPassword', () => {
  it('tem o formato bicho-cor-número', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateFriendlyPassword()).toMatch(/^[a-z]+-[a-z]+-\d{2}$/)
    }
  })

  it('usa o gerador injetado (determinístico nos testes)', () => {
    expect(generateFriendlyPassword(() => 0)).toBe('lobo-azul-10')
    expect(generateFriendlyPassword(() => 0.999)).toBe('texugo-lilas-99')
  })

  it('passa na própria regra de senha da sessão', () => {
    expect(validateSessionPassword(generateFriendlyPassword())).toBeNull()
  })
})

describe('validações', () => {
  it('senha de 4 a 72 caracteres, como no banco', () => {
    expect(validateSessionPassword('abc')).toMatch(/de 4 a 72/)
    expect(validateSessionPassword('abcd')).toBeNull()
    expect(validateSessionPassword('x'.repeat(73))).toMatch(/de 4 a 72/)
  })

  it('nome obrigatório e até 80', () => {
    expect(validateSessionName('   ')).toMatch(/nome/)
    expect(validateSessionName('Mesa de sexta')).toBeNull()
    expect(validateSessionName('x'.repeat(81))).toMatch(/até 80/)
  })
})

describe('buildInviteText', () => {
  const text = buildInviteText({
    sessionName: 'Mesa de sexta',
    inviteId: 'k3x9p2m7ab',
    password: 'lobo-azul-42'
  })

  it('leva nome, link, código e senha', () => {
    expect(text).toContain('"Mesa de sexta"')
    expect(text).toContain('rpgmesa://join/k3x9p2m7ab')
    expect(text).toContain('Senha: lobo-azul-42')
  })

  it('o link do texto é aceito de volta no lobby do jogador', () => {
    const link =
      text
        .split('\n')
        .find((line) => line.startsWith('Link: '))
        ?.slice(6) ?? ''
    expect(extractInviteId(link)).toBe('k3x9p2m7ab')
  })
})

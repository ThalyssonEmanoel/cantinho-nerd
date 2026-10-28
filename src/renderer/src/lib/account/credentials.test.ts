import { describe, expect, it } from 'vitest'
import {
  internalEmail,
  normalizeUsername,
  validateBio,
  validateDisplayName,
  validatePassword,
  validateSignUp,
  validateUsername
} from './credentials'

describe('nome de usuário', () => {
  it('não diferencia maiúsculas (4.1)', () => {
    expect(normalizeUsername('  Thalysson ')).toBe('thalysson')
    expect(internalEmail('Thalysson')).toBe('thalysson@usuarios.rpgmesa.app')
  })

  it('aceita letras, números, ponto, hífen e sublinhado', () => {
    for (const name of ['ana', 'joao.silva', 'mestre_42', 'lobo-azul', 'ABC', '007']) {
      expect(validateUsername(name)).toBeNull()
    }
  })

  it('recusa o que não serve para a parte antes do @ de um e-mail', () => {
    expect(validateUsername('')).toMatch(/Escolha/)
    expect(validateUsername('ab')).toMatch(/de 3 a 20/)
    expect(validateUsername('a'.repeat(21))).toMatch(/de 3 a 20/)
    expect(validateUsername('joão')).toMatch(/sem acento/)
    expect(validateUsername('ana clara')).toMatch(/sem espaços/)
    expect(validateUsername('.ana')).toMatch(/Comece e termine/)
    expect(validateUsername('ana_')).toMatch(/Comece e termine/)
    expect(validateUsername('ana..clara')).toMatch(/dois pontos/)
  })
})

describe('senha', () => {
  it('pede no mínimo 8 caracteres (4.1)', () => {
    expect(validatePassword('1234567')).toMatch(/pelo menos 8/)
    expect(validatePassword('12345678')).toBeNull()
  })

  it('respeita o teto do bcrypt', () => {
    expect(validatePassword('x'.repeat(72))).toBeNull()
    expect(validatePassword('x'.repeat(73))).toMatch(/no máximo 72/)
  })
})

describe('perfil', () => {
  it('nome de exibição é opcional no cadastro e obrigatório no perfil', () => {
    expect(validateDisplayName('  ', { required: false })).toBeNull()
    expect(validateDisplayName('  ', { required: true })).toMatch(/vazio/)
    expect(validateDisplayName('x'.repeat(41), { required: false })).toMatch(/até 40/)
  })

  it('bio tem limite de 300', () => {
    expect(validateBio('x'.repeat(300))).toBeNull()
    expect(validateBio('x'.repeat(301))).toMatch(/até 300/)
  })
})

describe('validateSignUp', () => {
  const valid = {
    username: 'ana',
    displayName: 'Ana Clara',
    password: 'segredo123',
    confirmPassword: 'segredo123'
  }

  it('formulário certo não tem erro', () => {
    expect(validateSignUp(valid)).toEqual({})
  })

  it('aponta o campo de cada problema', () => {
    const errors = validateSignUp({
      username: 'a',
      displayName: 'x'.repeat(41),
      password: 'curta',
      confirmPassword: 'outra'
    })
    expect(Object.keys(errors).sort()).toEqual(['displayName', 'password', 'username'])
  })

  it('confirmação diferente só é cobrada quando a senha já é válida', () => {
    expect(validateSignUp({ ...valid, confirmPassword: 'diferente1' })).toEqual({
      confirmPassword: 'As duas senhas não são iguais.'
    })
  })
})

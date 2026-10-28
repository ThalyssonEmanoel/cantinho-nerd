import { describe, expect, it } from 'vitest'
import { describeAuthError, describeDbError, errorMessage, FriendlyError } from './errors'

describe('describeAuthError', () => {
  it('traduz os erros que o cadastro e o login produzem', () => {
    expect(describeAuthError({ code: 'user_already_exists' })).toBe(
      'Esse nome de usuário já está em uso.'
    )
    expect(describeAuthError({ code: 'invalid_credentials' })).toBe(
      'Nome de usuário ou senha incorretos.'
    )
    expect(describeAuthError({ code: 'over_request_rate_limit' })).toMatch(/Muitas tentativas/)
  })

  it('explica como resolver a confirmação de e-mail ligada no painel', () => {
    expect(describeAuthError({ code: 'email_not_confirmed' })).toMatch(/Confirm email/)
    expect(describeAuthError({ code: 'email_address_not_authorized' })).toMatch(/Confirm email/)
  })

  it('reconhece falta de internet', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toMatch(/Sem conexão/)
    expect(describeAuthError({ message: 'TypeError: Failed to fetch' })).toMatch(/Sem conexão/)
  })

  it('gatilho do perfil recusando o cadastro', () => {
    expect(describeAuthError({ message: 'Database error saving new user' })).toMatch(/perfil/)
  })

  it('nunca devolve o texto cru do servidor', () => {
    expect(describeAuthError({ code: 'xyz', message: 'internal stack trace' })).not.toMatch(/stack/)
  })
})

describe('describeDbError', () => {
  it('passa adiante a mensagem das nossas próprias exceções', () => {
    expect(describeDbError({ code: 'P0002', message: 'Modelo não encontrado.' })).toBe(
      'Modelo não encontrado.'
    )
  })

  it('traduz permissão, unicidade e verificação', () => {
    expect(describeDbError({ code: '42501', message: 'x' })).toMatch(/permissão/)
    expect(
      describeDbError({ message: 'new row violates row-level security policy for table "x"' })
    ).toMatch(/permissão/)
    expect(describeDbError({ code: '23505' })).toMatch(/igual/)
    expect(describeDbError({ code: '23514' })).toMatch(/fora do permitido/)
  })

  it('arquivo grande demais no Storage', () => {
    expect(describeDbError({ statusCode: '413', message: 'Payload too large' })).toMatch(/grande/)
  })
})

describe('errorMessage', () => {
  it('usa a mensagem do FriendlyError e esconde o resto', () => {
    expect(errorMessage(new FriendlyError('Já existe.'))).toBe('Já existe.')
    expect(errorMessage(new Error('segredo interno'))).not.toMatch(/segredo/)
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Sem conexão/)
  })
})

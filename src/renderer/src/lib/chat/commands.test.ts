import { describe, expect, it } from 'vitest'
import { parseChatInput, type ChatMember } from './commands'

const members: ChatMember[] = [
  { userId: 'ana', displayName: 'Ana', username: 'ana', role: 'gm' },
  { userId: 'anaclara', displayName: 'Ana Clara', username: 'aclara', role: 'player' },
  { userId: 'joao', displayName: 'João Pedro', username: 'joao.p', role: 'player' },
  { userId: 'bruno', displayName: 'Bruno', username: 'bruno', role: 'player' }
]

const parse = (text: string): ReturnType<typeof parseChatInput> =>
  parseChatInput(text, members, 'bruno')

describe('mensagem comum', () => {
  it('texto vira mensagem, sem as pontas em branco', () => {
    expect(parse('  Oi, mesa!  ')).toEqual({ kind: 'message', body: 'Oi, mesa!' })
  })

  it('vazio não manda nada', () => {
    expect(parse('   ')).toEqual({ kind: 'empty' })
  })
})

describe('/r', () => {
  it('rola a fórmula (7.2)', () => {
    expect(parse('/r 2d6+3')).toEqual({ kind: 'roll', formula: '2d6+3' })
    expect(parse('/R 1d20 + 5')).toEqual({ kind: 'roll', formula: '1d20 + 5' })
  })

  it('sem fórmula explica o que fazer', () => {
    expect(parse('/r')).toMatchObject({ kind: 'error' })
  })
})

describe('/w', () => {
  it('sussurra pelo nome de exibição (7.2)', () => {
    expect(parse('/w Ana cuidado com a porta')).toEqual({
      kind: 'whisper',
      recipientId: 'ana',
      recipientName: 'Ana',
      body: 'cuidado com a porta'
    })
  })

  it('nome com espaço: vale o mais longo que casa', () => {
    expect(parse('/w Ana Clara oi')).toMatchObject({ recipientId: 'anaclara', body: 'oi' })
  })

  it('sem acento e sem maiúscula também acha', () => {
    expect(parse('/w joao pedro bora')).toMatchObject({ recipientId: 'joao', body: 'bora' })
  })

  it('aceita o nome de usuário e a palavra "mestre"', () => {
    expect(parse('/w aclara oi')).toMatchObject({ recipientId: 'anaclara' })
    expect(parse('/w mestre posso abrir?')).toMatchObject({
      recipientId: 'ana',
      body: 'posso abrir?'
    })
  })

  it('não confunde o começo de outra palavra com um nome ("Anabela" não é "Ana")', () => {
    expect(parse('/w Anabela oi')).toMatchObject({ kind: 'error' })
  })

  it('não sussurra para si mesmo nem para quem não está na mesa', () => {
    expect(parse('/w Bruno oi')).toMatchObject({ kind: 'error' })
    expect(parse('/w Zé oi')).toMatchObject({ kind: 'error' })
  })

  it('sem mensagem avisa', () => {
    expect(parse('/w Ana')).toEqual({ kind: 'error', message: 'Faltou a mensagem do sussurro.' })
  })
})

describe('comando desconhecido', () => {
  it('explica os que existem', () => {
    expect(parse('/xyz oi')).toMatchObject({ kind: 'error', message: expect.stringMatching(/\/r/) })
  })
})

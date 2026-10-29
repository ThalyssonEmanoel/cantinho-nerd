import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionSummary } from './sessions'

/**
 * Excluir sessões e conta (seção 9). O que se confere: quem é mestre exclui, quem joga sai,
 * uma mesa que falha não trava as outras, e a conta só vai para a Edge Function depois das
 * mesas e dos arquivos que o app pode apagar.
 */

const calls = vi.hoisted(() => [] as string[])
const sessions = vi.hoisted(() => ({
  listMySessions: vi.fn(),
  deleteSession: vi.fn(async (id: string) => {
    calls.push(`excluir ${id}`)
  }),
  removeMember: vi.fn(async (id: string) => {
    calls.push(`sair ${id}`)
  })
}))
const invoke = vi.hoisted(() =>
  vi.fn(async (): Promise<{ error: unknown }> => {
    calls.push('edge function')
    return { error: null }
  })
)

vi.mock('./sessions', () => sessions)
vi.mock('./client', () => ({
  getSupabase: () => ({
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string) => ({ data: [{ name: 'a.webp' }], error: null, prefix }),
        remove: async (files: string[]) => {
          calls.push(`apagar ${bucket}:${files.join(',')}`)
          return { error: null }
        }
      })
    },
    functions: { invoke }
  })
}))

const account = await import('./account')

function session(id: string, role: 'gm' | 'player'): SessionSummary {
  return { id, name: `Mesa ${id}`, role } as SessionSummary
}

afterEach(() => {
  calls.length = 0
  vi.clearAllMocks()
})

describe('excluir todas as minhas sessões', () => {
  it('as que mestro somem; das que jogo, eu saio', async () => {
    sessions.listMySessions.mockResolvedValue([session('1', 'gm'), session('2', 'player')])
    expect(await account.deleteMySessions('ana')).toEqual({ deleted: 1, left: 1, failed: [] })
    expect(sessions.removeMember).toHaveBeenCalledWith('2', 'ana')
  })

  it('uma mesa que falha não trava as outras, e a tela fica sabendo qual foi', async () => {
    sessions.listMySessions.mockResolvedValue([session('1', 'gm'), session('3', 'gm')])
    sessions.deleteSession.mockRejectedValueOnce(new Error('sem internet'))
    expect(await account.deleteMySessions('ana')).toEqual({
      deleted: 1,
      left: 0,
      failed: ['Mesa 1']
    })
  })
})

describe('excluir a conta', () => {
  it('mesas, galeria e avatar antes; a Edge Function por último', async () => {
    sessions.listMySessions.mockResolvedValue([session('1', 'gm')])
    await account.deleteMyAccount('ana')
    expect(calls).toEqual([
      'excluir 1',
      'apagar assets:users/ana/gallery/a.webp',
      'apagar avatars:ana/a.webp',
      'edge function'
    ])
  })

  it('função não instalada no servidor vira aviso claro', async () => {
    sessions.listMySessions.mockResolvedValue([])
    invoke.mockResolvedValueOnce({
      error: { name: 'FunctionsHttpError', context: new Response('', { status: 404 }) }
    })
    await expect(account.deleteMyAccount('ana')).rejects.toThrow('ainda não foi instalada')
  })

  it('sem internet também', () => {
    expect(account.describeDeleteAccountError(null)).toMatch(/Sem conexão/)
    expect(account.describeDeleteAccountError(401)).toMatch(/expirou/)
  })
})

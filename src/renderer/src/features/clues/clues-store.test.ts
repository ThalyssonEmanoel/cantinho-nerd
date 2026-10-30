import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Clue } from '@/lib/session/clues'

/**
 * Notas do mestre e pistas da mesa (Fase 13).
 *
 * O que está em jogo: as notas salvam sozinhas (e não se perdem ao sair), e uma pista que
 * chega revelada para o jogador conta como novidade — é o que acende o aviso na aba.
 */

const db = vi.hoisted(() => ({
  listClues: vi.fn(),
  fetchNotes: vi.fn(),
  saveNotes: vi.fn()
}))

vi.mock('@/lib/db/clues', () => ({ listClues: db.listClues }))
vi.mock('@/lib/db/notes', () => ({
  fetchNotes: db.fetchNotes,
  saveNotes: db.saveNotes,
  MAX_NOTES_LENGTH: 20000
}))

const { useCluesStore } = await import('./clues-store')

function clue(partial: Partial<Clue> & { id: string }): Clue {
  return {
    sessionId: 'mesa',
    title: 'A carta rasgada',
    body: 'Assinada por R.',
    imagePath: null,
    revealAll: false,
    revealedTo: [],
    sortOrder: 1,
    updatedAt: '2026-10-30T12:00:00Z',
    ...partial
  }
}

const store = (): ReturnType<typeof useCluesStore.getState> => useCluesStore.getState()

beforeEach(() => {
  db.listClues.mockResolvedValue([])
  db.fetchNotes.mockResolvedValue('')
  db.saveNotes.mockResolvedValue(undefined)
  store().close()
})

afterEach(() => {
  store().close()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('abrir', () => {
  it('o mestre carrega as notas e as pistas', async () => {
    db.fetchNotes.mockResolvedValueOnce('o prefeito é o vilão')
    db.listClues.mockResolvedValueOnce([clue({ id: 'p1' })])

    await store().open('mesa', true)

    expect(store().notes).toBe('o prefeito é o vilão')
    expect(store().clues).toHaveLength(1)
    expect(db.fetchNotes).toHaveBeenCalledWith('mesa')
  })

  it('o jogador nem pede as notas', async () => {
    await store().open('mesa', false)

    expect(db.fetchNotes).not.toHaveBeenCalled()
    expect(store().notes).toBe('')
  })

  it('as pistas vêm ordenadas', async () => {
    db.listClues.mockResolvedValueOnce([
      clue({ id: 'b', sortOrder: 2 }),
      clue({ id: 'a', sortOrder: 1 })
    ])
    await store().open('mesa', true)
    expect(store().clues.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('notas do mestre', () => {
  beforeEach(async () => {
    await store().open('mesa', true)
  })

  it('digitar marca como pendente e grava sozinho depois de um instante', async () => {
    vi.useFakeTimers()
    store().setNotes('a chave está no poço')
    expect(store().notesState).toBe('dirty')

    await vi.advanceTimersByTimeAsync(1000)

    expect(db.saveNotes).toHaveBeenCalledWith('mesa', 'a chave está no poço')
    expect(store().notesState).toBe('saved')
  })

  it('sair da mesa grava o que estava pendente', async () => {
    store().setNotes('rascunho')
    await store().flushNotes()
    expect(db.saveNotes).toHaveBeenCalledWith('mesa', 'rascunho')
  })

  it('sem mudança nenhuma, não grava à toa', async () => {
    await store().flushNotes()
    expect(db.saveNotes).not.toHaveBeenCalled()
  })

  it('falha ao gravar aparece no indicador', async () => {
    db.saveNotes.mockRejectedValueOnce(new Error('sem rede'))
    store().setNotes('algo')
    await store().flushNotes()
    expect(store().notesState).toBe('error')
  })

  it('o jogador não grava notas nem por acidente', async () => {
    await store().open('mesa', false)
    store().setNotes('tentando')
    await store().flushNotes()
    expect(db.saveNotes).not.toHaveBeenCalled()
  })
})

describe('pistas chegando pelo tempo real', () => {
  it('para o jogador, pista nova revelada conta como novidade', async () => {
    await store().open('mesa', false)

    store().applyChange({
      event: 'INSERT',
      row: { ...clue({ id: 'p1', revealAll: true }), session_id: 'mesa', reveal_all: true },
      old: {}
    })

    expect(store().clues).toHaveLength(1)
    expect(store().unseen).toEqual(['p1'])

    store().markSeen()
    expect(store().unseen).toEqual([])
  })

  it('para o mestre, a própria pista não é novidade', async () => {
    await store().open('mesa', true)
    store().upsertClue(clue({ id: 'p1', revealAll: true }))
    expect(store().unseen).toEqual([])
  })

  it('UPDATE troca a pista no lugar', async () => {
    await store().open('mesa', true)
    store().upsertClue(clue({ id: 'p1' }))
    store().upsertClue(clue({ id: 'p1', title: 'Outro nome' }))

    expect(store().clues).toHaveLength(1)
    expect(store().clues[0]?.title).toBe('Outro nome')
  })

  it('DELETE chega só com o id e tira a pista', async () => {
    await store().open('mesa', false)
    store().upsertClue(clue({ id: 'p1', revealAll: true }))

    store().applyChange({ event: 'DELETE', row: {}, old: { id: 'p1' } })

    expect(store().clues).toEqual([])
    expect(store().unseen).toEqual([])
  })

  it('linha estragada não quebra a lista', async () => {
    await store().open('mesa', true)
    store().applyChange({ event: 'INSERT', row: { id: 'só o id' }, old: {} })
    expect(store().clues).toEqual([])
  })
})

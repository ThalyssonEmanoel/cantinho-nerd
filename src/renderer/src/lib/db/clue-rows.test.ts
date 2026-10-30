import { describe, expect, it } from 'vitest'
import { clueFromRow, clueFromUnknown, type ClueRow } from './clue-rows'

const row: ClueRow = {
  id: 'pista-1',
  session_id: 'mesa-1',
  title: 'A carta rasgada',
  body: 'Assinada por R.',
  image_path: 'sessions/mesa-1/clues/abc.webp',
  reveal_all: false,
  revealed_to: ['22222222-2222-2222-2222-222222222222'],
  sort_order: 2,
  updated_at: '2026-10-30T12:00:00Z'
}

describe('clueFromRow', () => {
  it('converte a linha', () => {
    expect(clueFromRow(row)).toEqual({
      id: 'pista-1',
      sessionId: 'mesa-1',
      title: 'A carta rasgada',
      body: 'Assinada por R.',
      imagePath: 'sessions/mesa-1/clues/abc.webp',
      revealAll: false,
      revealedTo: ['22222222-2222-2222-2222-222222222222'],
      sortOrder: 2,
      updatedAt: '2026-10-30T12:00:00Z'
    })
  })

  it('lista de destinos vazia ou nula vira lista vazia', () => {
    expect(clueFromRow({ ...row, revealed_to: null }).revealedTo).toEqual([])
    expect(clueFromRow({ ...row, revealed_to: [] }).revealedTo).toEqual([])
  })

  it('o que não é id de pessoa é descartado', () => {
    const dirty = clueFromRow({
      ...row,
      revealed_to: ['não-é-id', '22222222-2222-2222-2222-222222222222', ''] as string[]
    })
    expect(dirty.revealedTo).toEqual(['22222222-2222-2222-2222-222222222222'])
  })

  it('posição em texto (tempo real) vira número', () => {
    expect(clueFromRow({ ...row, sort_order: '5' as unknown as number }).sortOrder).toBe(5)
  })
})

describe('clueFromUnknown', () => {
  it('aceita a linha que vem pelo canal', () => {
    expect(clueFromUnknown({ ...row })?.title).toBe('A carta rasgada')
  })

  it('descarta o que não dá para usar em vez de quebrar a tela', () => {
    expect(clueFromUnknown({ id: 'só o id' })).toBeNull()
    expect(clueFromUnknown({})).toBeNull()
  })
})

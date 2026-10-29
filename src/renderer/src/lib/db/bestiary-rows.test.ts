import { describe, expect, it } from 'vitest'
import { creatureFromRow, encounterFromRow, spawnResultsFromJson } from './bestiary-rows'

describe('creatureFromRow', () => {
  const row = {
    id: 'c1',
    name: 'Goblin',
    kind: 'npc',
    tags: ['floresta', 3],
    template_id: 't1',
    template_version: 2,
    values: { c_vida: { current: 7 } },
    image_path: 'users/u/gallery/abc.webp',
    token_size: 40,
    updated_at: 'ontem'
  }

  it('converte, limpando tag torta e tamanho absurdo', () => {
    expect(creatureFromRow(row)).toEqual({
      id: 'c1',
      name: 'Goblin',
      kind: 'npc',
      tags: ['floresta'],
      templateId: 't1',
      templateVersion: 2,
      values: { c_vida: { current: 7 } },
      imagePath: 'users/u/gallery/abc.webp',
      tokenSize: 10,
      updatedAt: 'ontem'
    })
  })

  it('tipo desconhecido vira monstro; sem modelo, nada', () => {
    expect(creatureFromRow({ ...row, kind: 'dragão' })?.kind).toBe('monster')
    expect(creatureFromRow({ ...row, image_path: '' })?.imagePath).toBeNull()
    expect(creatureFromRow({ ...row, template_id: null })).toBeNull()
  })
})

describe('encounterFromRow e spawn', () => {
  it('encontro com os grupos conferidos', () => {
    expect(
      encounterFromRow({ id: 'e1', name: 'Emboscada', groups: [{ creature_id: 'c1', count: 3 }] })
    ).toEqual({
      id: 'e1',
      name: 'Emboscada',
      groups: [{ creatureId: 'c1', count: 3, hidden: false }],
      updatedAt: ''
    })
  })

  it('o que spawn_creatures devolveu', () => {
    expect(
      spawnResultsFromJson([{ token_id: 't', sheet_id: 's' }, { token_id: 'x' }, null])
    ).toEqual([{ tokenId: 't', sheetId: 's' }])
  })
})

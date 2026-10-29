import { describe, expect, it } from 'vitest'
import {
  combatEntryFromRow,
  combatLogFromRow,
  combatStateFromRow,
  hpResultsFromJson
} from './combat-rows'

describe('combatStateFromRow', () => {
  it('sem linha ou desligado: sem combate', () => {
    expect(combatStateFromRow(null)).toEqual({ active: false, round: 0, turnEntryId: null })
    expect(combatStateFromRow({ active: false, round: 3 })).toEqual({
      active: false,
      round: 0,
      turnEntryId: null
    })
  })

  it('ligado: rodada e vez', () => {
    expect(combatStateFromRow({ active: true, round: 2, turn_entry_id: 'e1' })).toEqual({
      active: true,
      round: 2,
      turnEntryId: 'e1'
    })
  })
})

describe('combatEntryFromRow', () => {
  const row = {
    id: 'e1',
    session_id: 's1',
    token_id: 't1',
    name: 'Goblin 1',
    image_path: null,
    owner_id: 'ana',
    kind: 'monster',
    hidden: true,
    show_name: false,
    initiative: '14.5',
    sort_order: 3
  }

  it('converte, com a iniciativa em texto (numeric do tempo real)', () => {
    expect(combatEntryFromRow(row)).toEqual({
      id: 'e1',
      sessionId: 's1',
      tokenId: 't1',
      name: 'Goblin 1',
      imagePath: null,
      ownerId: 'ana',
      kind: 'monster',
      hidden: true,
      showName: false,
      initiative: 14.5,
      sortOrder: 3
    })
  })

  it('sem iniciativa, null; tipo estranho vira objeto; sem id, nada', () => {
    expect(combatEntryFromRow({ ...row, initiative: null })?.initiative).toBeNull()
    expect(combatEntryFromRow({ ...row, kind: 'dragão' })?.kind).toBe('object')
    expect(combatEntryFromRow({ ...row, id: undefined })).toBeNull()
  })
})

describe('combatLogFromRow', () => {
  const row = {
    id: 'l1',
    actor_id: 'ana',
    token_id: null,
    token_name: 'Goblin 1',
    token_owner_id: 'ana',
    kind: 'heal',
    amount: '4',
    hp_before: '3',
    hp_after: '7',
    token_hidden: false,
    bars_hidden: true,
    name_hidden: false,
    created_at: '2026-10-29T20:00:00Z'
  }

  it('converte os números que chegam como texto', () => {
    expect(combatLogFromRow(row)).toMatchObject({
      kind: 'heal',
      amount: 4,
      before: 3,
      after: 7,
      tokenId: null,
      barsHidden: true
    })
  })

  it('descarta a linha que não fecha', () => {
    expect(combatLogFromRow({ ...row, kind: 'veneno' })).toBeNull()
    expect(combatLogFromRow({ ...row, amount: 'muito' })).toBeNull()
  })
})

describe('hpResultsFromJson', () => {
  it('lê o que apply_hp_change devolveu', () => {
    expect(
      hpResultsFromJson([
        { token_id: 'a', before: 10, after: 7 },
        { token_id: 'b', skipped: true },
        { nada: 1 }
      ])
    ).toEqual([
      { tokenId: 'a', skipped: false, before: 10, after: 7 },
      { tokenId: 'b', skipped: true }
    ])
    expect(hpResultsFromJson(null)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  remoteChangeFromGmRow,
  remoteChangeFromSheetRow,
  sheetFromRow,
  summaryRowFromRow,
  type SheetRow
} from './sheet-rows'

const base: SheetRow = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  session_id: 'a1b2c3d4-0000-4000-8000-0000000000aa',
  owner_id: 'a1b2c3d4-0000-4000-8000-0000000000bb',
  template_id: 'a1b2c3d4-0000-4000-8000-0000000000cc',
  template_version: 2,
  template_name: 'Ordem',
  kind: 'character',
  values: { c_nome: 'Lia', c_vida: { current: 7 } },
  computed: { defesa: 13 },
  summary: { name: 'Lia', bars: { hp: { current: 7, max: 16 } } },
  created_at: '2026-10-29T10:00:00.123456+00:00',
  updated_at: '2026-10-29T11:00:00.654321+00:00',
  owner: { display_name: 'Bruno' },
  sheet_gm_data: null
}

describe('sheetFromRow', () => {
  it('jogador: sem a parte do mestre, a ficha vem sem gmValues e sem orphaned', () => {
    const sheet = sheetFromRow(base)
    expect(sheet?.ownerName).toBe('Bruno')
    expect(sheet?.sessionId).toBe(base.session_id)
    expect(sheet?.gmValues).toEqual({})
    expect(sheet?.orphaned).toEqual({})
    expect(sheet?.values.c_nome).toBe('Lia')
    // A precisão do updated_at importa: é ela que a migração usa para conferir concorrência.
    expect(sheet?.updatedAt).toBe(base.updated_at)
  })

  it('mestre: junta a parte dele, inclusive o cache dos calculados', () => {
    const sheet = sheetFromRow({
      ...base,
      sheet_gm_data: {
        values: { c_segredo: 'vilão' },
        computed: { ameaca: 3 },
        orphaned: { c_velho: 1 }
      }
    })
    expect(sheet?.gmValues).toEqual({ c_segredo: 'vilão' })
    expect(sheet?.computed).toEqual({ defesa: 13, ameaca: 3 })
    expect(sheet?.orphaned).toEqual({ c_velho: 1 })
  })

  it('linha corrompida vira null', () => {
    expect(sheetFromRow({ ...base, kind: 'dragao' })).toBeNull()
  })
})

describe('summaryRowFromRow', () => {
  it('monta o resumo da lista com o nome da sessão e a vida', () => {
    const row = summaryRowFromRow({
      id: base.id,
      session_id: base.session_id,
      owner_id: base.owner_id,
      template_id: base.template_id,
      template_name: 'Ordem',
      template_version: 2,
      summary: base.summary,
      updated_at: base.updated_at,
      owner: { display_name: 'Bruno' },
      session: { name: 'Mesa de sexta' }
    })
    expect(row.name).toBe('Lia')
    expect(row.sessionName).toBe('Mesa de sexta')
    expect(row.bars.hp).toEqual({ current: 7, max: 16 })
  })
})

describe('mudanças do tempo real', () => {
  it('linha de sheets traz valores, versão e horário', () => {
    expect(
      remoteChangeFromSheetRow({
        id: 'x',
        values: { c_nome: 'Lia' },
        template_version: 3,
        updated_at: 't'
      })
    ).toEqual({ sheetId: 'x', values: { c_nome: 'Lia' }, templateVersion: 3, updatedAt: 't' })
  })

  it('linha de sheet_gm_data traz a parte do mestre', () => {
    expect(
      remoteChangeFromGmRow({ sheet_id: 'x', values: { c_segredo: 's' }, orphaned: {} })
    ).toEqual({ sheetId: 'x', gmValues: { c_segredo: 's' }, orphaned: {} })
  })

  it('evento sem id é descartado', () => {
    expect(remoteChangeFromSheetRow({})).toBeNull()
    expect(remoteChangeFromGmRow({})).toBeNull()
  })
})

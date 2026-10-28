import { describe, expect, it } from 'vitest'
import { createExampleSchema } from './example-template'
import { createTemplate } from './factory'
import { canPatchField } from './permissions'
import {
  buildPatch,
  createSheetRecord,
  mergedValues,
  migrateSheetRecord,
  patchFields,
  projectSheetFor,
  rejectedPatchFields,
  type SheetRecord
} from './sheet-record'
import type { SheetComponent, SheetSchema, SheetTemplateVersion } from './types'
import { isResourceValue, isTableValue, type SheetValues } from './values'

/** Modelo pequeno com um campo de cada caso que importa aqui. */
function buildSchema(components: SheetComponent[]): SheetSchema {
  return { formatVersion: 1, tabs: [{ id: 'tab', label: 'Geral', components }] }
}

const nome: SheetComponent = {
  id: 'c_nome',
  type: 'text',
  key: 'nome',
  label: 'Nome',
  role: 'name',
  editableBy: 'player',
  visibleTo: 'all',
  layout: { x: 0, y: 0, w: 4, h: 2 }
}

const vida: SheetComponent = {
  id: 'c_vida',
  type: 'resource',
  key: 'vida',
  label: 'Vida',
  role: 'hp',
  maxFormula: '=10',
  showButtons: true,
  editableBy: 'player',
  visibleTo: 'all',
  layout: { x: 4, y: 0, w: 4, h: 2 }
}

const notas: SheetComponent = {
  id: 'c_notas',
  type: 'textarea',
  key: 'notas',
  label: 'Anotações do mestre',
  editableBy: 'gm',
  visibleTo: 'gm',
  layout: { x: 0, y: 2, w: 6, h: 3 }
}

const nivel: SheetComponent = {
  id: 'c_nivel',
  type: 'number',
  key: 'nivel',
  label: 'Nível',
  defaultValue: 1,
  editableBy: 'gm',
  visibleTo: 'all',
  layout: { x: 8, y: 0, w: 2, h: 2 }
}

const segredo: SheetComponent = {
  id: 'c_segredo',
  type: 'computed',
  key: 'segredo',
  label: 'Ameaça oculta',
  formula: '=nivel * 2',
  format: 'integer',
  editableBy: 'gm',
  visibleTo: 'gm',
  layout: { x: 10, y: 0, w: 2, h: 2 }
}

function sheetFrom(schema: SheetSchema, version = 1): SheetRecord {
  const template = createTemplate({ name: 'Teste', kind: 'character', schema })
  const published: SheetTemplateVersion = {
    version,
    schema,
    publishedAt: new Date().toISOString()
  }
  return createSheetRecord({ template, version: published, ownerName: 'Thalysson' })
}

describe('createSheetRecord', () => {
  it('separa os campos do mestre dos campos compartilhados', () => {
    const sheet = sheetFrom(buildSchema([nome, vida, notas]))

    expect(Object.keys(sheet.values).sort()).toEqual(['c_nome', 'c_vida'])
    expect(Object.keys(sheet.gmValues)).toEqual(['c_notas'])
  })

  it('nasce com a barra cheia e com o resumo dos papéis preenchido', () => {
    const sheet = sheetFrom(buildSchema([nome, vida]))

    expect(sheet.summary.bars.hp).toEqual({ current: 10, max: 10 })
    expect(sheet.templateVersion).toBe(1)
  })

  it('guarda o cache dos campos calculados', () => {
    const sheet = sheetFrom(buildSchema([nivel, segredo]))
    expect(sheet.computed.segredo).toBe(2)
  })
})

describe('buildPatch', () => {
  const schema = buildSchema([nome, vida, notas, segredo])

  it('manda cada campo para a tabela certa', () => {
    const patch = buildPatch(schema, { c_nome: 'Vaz', c_notas: 'ele mente' })

    expect(patch.values).toEqual({ c_nome: 'Vaz' })
    expect(patch.gmValues).toEqual({ c_notas: 'ele mente' })
  })

  it('ignora campo que não guarda valor e id que não existe', () => {
    const patch = buildPatch(schema, { c_segredo: 7, c_fantasma: 1 })
    expect(patch).toEqual({})
  })
})

describe('patchFields', () => {
  const schema = buildSchema([nome, vida, notas])

  it('altera só os campos do patch', () => {
    const sheet = sheetFrom(schema)
    const patched = patchFields(sheet, schema, buildPatch(schema, { c_nome: 'Vaz' }))

    expect(patched.values.c_nome).toBe('Vaz')
    expect(patched.values.c_vida).toEqual(sheet.values.c_vida)
    expect(patched.gmValues).toEqual(sheet.gmValues)
  })

  it('duas alterações ao mesmo tempo não se atropelam', () => {
    // O caso da especificação: o mestre aplica dano enquanto o jogador escreve o nome.
    const sheet = sheetFrom(schema)

    const doDano = patchFields(sheet, schema, { values: { c_vida: { current: 3 } } })
    const comNome = patchFields(doDano, schema, { values: { c_nome: 'Vaz' } })

    expect(comNome.values.c_nome).toBe('Vaz')
    expect(comNome.values.c_vida).toEqual({ current: 3 })
    expect(comNome.summary.bars.hp).toEqual({ current: 3, max: 10 })
  })

  it('recalcula o resumo dos papéis', () => {
    const sheet = sheetFrom(schema)
    const patched = patchFields(sheet, schema, { values: { c_nome: 'Vaz' } })
    expect(patched.summary.name).toBe('Vaz')
  })

  it('não deixa um campo do mestre cair na tabela compartilhada', () => {
    const sheet = sheetFrom(schema)
    // Patch mal roteado de propósito: o modelo é quem decide onde o valor mora.
    const patched = patchFields(sheet, schema, { values: { c_notas: 'segredo' } })

    expect(patched.values.c_notas).toBeUndefined()
    expect(patched.gmValues.c_notas).toBe('segredo')
  })
})

describe('permissões de gravação', () => {
  const schema = buildSchema([nome, vida, notas, nivel, segredo])

  it('o jogador grava o que é dele e nada além', () => {
    expect(canPatchField(schema, 'c_nome', 'player')).toBe(true)
    // Visível para todos, mas só o mestre edita.
    expect(canPatchField(schema, 'c_nivel', 'player')).toBe(false)
    expect(canPatchField(schema, 'c_notas', 'player')).toBe(false)
  })

  it('o mestre grava tudo que guarda valor', () => {
    expect(canPatchField(schema, 'c_nivel', 'gm')).toBe(true)
    expect(canPatchField(schema, 'c_notas', 'gm')).toBe(true)
    // Campo calculado não é gravável nem para o mestre.
    expect(canPatchField(schema, 'c_segredo', 'gm')).toBe(false)
  })

  it('lista os campos recusados do patch', () => {
    const patch = buildPatch(schema, { c_nome: 'Vaz', c_notas: 'x', c_nivel: 2 })

    expect(rejectedPatchFields(schema, patch, 'player').sort()).toEqual(['c_nivel', 'c_notas'])
    expect(rejectedPatchFields(schema, patch, 'gm')).toEqual([])
  })
})

describe('projectSheetFor', () => {
  const schema = buildSchema([nome, nivel, notas, segredo])

  it('o jogador não recebe os dados do mestre', () => {
    const sheet = patchFields(sheetFrom(schema), schema, {
      gmValues: { c_notas: 'o vilão é o prefeito' }
    })
    const forPlayer = projectSheetFor(schema, sheet, 'player')

    expect(forPlayer.gmValues).toEqual({})
    expect(JSON.stringify(forPlayer)).not.toContain('prefeito')
    // Nem o cache do campo calculado que é só do mestre.
    expect(forPlayer.computed.segredo).toBeUndefined()
    expect(sheet.computed.segredo).toBe(2)
  })

  it('o mestre recebe a ficha inteira', () => {
    const sheet = sheetFrom(schema)
    expect(projectSheetFor(schema, sheet, 'gm')).toBe(sheet)
  })
})

describe('migrateSheetRecord', () => {
  it('campo novo recebe o padrão e barra nova nasce cheia', () => {
    const v1 = buildSchema([nome, vida])
    const sheet = patchFields(sheetFrom(v1), v1, { values: { c_vida: { current: 4 } } })

    const sanidade: SheetComponent = {
      id: 'c_sanidade',
      type: 'resource',
      key: 'sanidade',
      label: 'Sanidade',
      role: 'bar2',
      maxValue: 8,
      showButtons: true,
      editableBy: 'player',
      visibleTo: 'all',
      layout: { x: 0, y: 4, w: 4, h: 2 }
    }
    const v2 = buildSchema([nome, vida, sanidade])
    const result = migrateSheetRecord(sheet, v2, 2)

    expect(result.toVersion).toBe(2)
    expect(result.addedLabels).toEqual(['Sanidade'])
    expect(result.sheet.summary.bars.bar2).toEqual({ current: 8, max: 8 })
    // A vida machucada não pode ser curada só porque o mestre publicou outra versão.
    expect(result.sheet.summary.bars.hp).toEqual({ current: 4, max: 10 })
  })

  it('valor de campo removido fica guardado e volta se o campo voltar', () => {
    const v1 = buildSchema([nome, notas])
    const sheet = patchFields(sheetFrom(v1), v1, { gmValues: { c_notas: 'não esquecer' } })

    const v2 = buildSchema([nome])
    const removed = migrateSheetRecord(sheet, v2, 2)

    expect(removed.orphanedCount).toBe(1)
    expect(removed.sheet.gmValues.c_notas).toBeUndefined()
    expect(removed.sheet.orphaned.c_notas).toBe('não esquecer')

    const back = migrateSheetRecord(removed.sheet, v1, 3)
    expect(back.sheet.gmValues.c_notas).toBe('não esquecer')
    expect(back.sheet.orphaned).toEqual({})
  })

  it('coluna nova numa tabela que já tem linhas recebe o padrão', () => {
    const table: SheetComponent = {
      id: 'c_mochila',
      type: 'table',
      key: 'mochila',
      label: 'Mochila',
      columns: [{ id: 'col_item', key: 'item', label: 'Item', kind: 'text' }],
      rows: [],
      playerCanAddRows: true,
      showRowLabels: false,
      editableBy: 'player',
      visibleTo: 'all',
      layout: { x: 0, y: 0, w: 8, h: 6 }
    }
    const v1 = buildSchema([table])
    const sheet = patchFields(sheetFrom(v1), v1, {
      values: { c_mochila: [{ id: 'r1', cells: { item: 'Corda' } }] }
    })

    const v2 = buildSchema([
      {
        ...table,
        columns: [
          ...table.columns,
          { id: 'col_peso', key: 'peso', label: 'Peso', kind: 'number' }
        ]
      } as SheetComponent
    ])
    const result = migrateSheetRecord(sheet, v2, 2)
    const rows = result.sheet.values.c_mochila

    expect(isTableValue(rows)).toBe(true)
    expect(isTableValue(rows) ? rows[0]?.cells : undefined).toEqual({ item: 'Corda', peso: 0 })
  })

  it('a ficha do modelo de exemplo sobrevive a uma versão idêntica', () => {
    const schema = createExampleSchema()
    const sheet = sheetFrom(schema)
    const result = migrateSheetRecord(sheet, createExampleSchema(), 2)

    expect(result.addedLabels).toEqual([])
    expect(result.orphanedCount).toBe(0)
    expect(sameValues(mergedValues(sheet), mergedValues(result.sheet))).toBe(true)
  })

  it('a vida do exemplo continua de pé depois da migração', () => {
    const schema = createExampleSchema()
    const sheet = sheetFrom(schema)
    const vidaAntes = sheet.values.c_vida

    const result = migrateSheetRecord(sheet, createExampleSchema(), 2)

    expect(isResourceValue(vidaAntes) ? vidaAntes.current : -1).toBe(10)
    expect(result.sheet.values.c_vida).toEqual(vidaAntes)
  })
})

function sameValues(a: SheetValues, b: SheetValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

import { describe, expect, it } from 'vitest'
import { createComponent } from './factory'
import { findKeyUsages, renameKeyInSchema } from './formula-refs'
import { createInitialValues, createSheetContext, readFormulaValue } from './context'
import { MAX_FIGURE_SRC_LENGTH, parseTemplateFile, TEMPLATE_FILE_FORMAT } from './schema'
import { findComponentByKey, type SheetComponent, type SheetSchema } from './types'
import { validateSchema } from './validate'
import { createDefaultValues, isTableValue, migrateValues } from './values'

/**
 * Peças que entraram para a ficha do Geralt (planilha): texto padrão, parágrafo, imagem
 * fixa, coluna oculta, linha inicial e barra que acompanha o máximo. O zod descarta campo que
 * não conhece, então cada uma precisa provar que sobrevive à importação.
 */

const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

function component<T extends SheetComponent['type']>(
  type: T,
  key: string,
  extra: Partial<Extract<SheetComponent, { type: T }>> = {}
): SheetComponent {
  return {
    ...createComponent(type, { takenKeys: [] }),
    id: `c_${key}`,
    key,
    label: key,
    ...extra
  } as SheetComponent
}

function schemaWith(...components: SheetComponent[]): SheetSchema {
  return { formatVersion: 1, tabs: [{ id: 'tab', label: 'Geral', components }] }
}

function importSchema(schema: SheetSchema): SheetSchema | string {
  const parsed = parseTemplateFile(
    JSON.stringify({
      format: TEMPLATE_FILE_FORMAT,
      fileVersion: 1,
      name: 'Teste',
      kind: 'character',
      schema
    })
  )
  return parsed.ok ? parsed.value.schema : parsed.message
}

function codesOf(schema: SheetSchema): string[] {
  return validateSchema(schema).issues.map((issue) => issue.code)
}

/** Barra de vida simples, para o aviso de papel ausente não entrar em toda conferência. */
const hp = component('resource', 'vida', { role: 'hp' })

describe('importação', () => {
  it('não perde nenhuma das propriedades novas no caminho', () => {
    const table = component('table', 'armas', {
      columns: [
        { id: 'col_nome', key: 'nome', label: 'Nome', kind: 'text' },
        { id: 'col_atrib', key: 'atrib', label: 'Atributo', kind: 'text', hidden: true }
      ],
      rows: [{ id: 'r1', key: 'r1', label: '', starter: true, cells: { nome: 'Machadinha' } }]
    })
    const original = schemaWith(
      component('text', 'nome', { defaultValue: 'Geralt' }),
      component('textarea', 'notas', { defaultValue: 'Empurrar' }),
      component('resource', 'vida', { maxFormula: '=20', maxValue: undefined, followsMax: true }),
      component('heading', 'regra', { text: 'x'.repeat(3000), level: 'paragraph' }),
      component('figure', 'roda', { src: PIXEL, sourceFormula: '=retrato', fit: 'cover' }),
      table
    )

    expect(importSchema(original)).toEqual(original)
  })

  it('recusa imagem fixa que não seja bitmap em data URL', () => {
    const refused = [
      'https://exemplo.com/roda.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:text/html;base64,PHNjcmlwdD4=',
      'javascript:alert(1)',
      `data:image/png;base64,${'A'.repeat(MAX_FIGURE_SRC_LENGTH)}`
    ]
    for (const src of refused) {
      expect(typeof importSchema(schemaWith(component('figure', 'roda', { src }))), src).toBe(
        'string'
      )
    }
  })

  it('aceita png, jpeg e webp', () => {
    for (const kind of ['png', 'jpeg', 'webp']) {
      const src = `data:image/${kind};base64,iVBORw0KGgo=`
      expect(typeof importSchema(schemaWith(component('figure', 'roda', { src }))), kind).toBe(
        'object'
      )
    }
  })
})

describe('valores iniciais', () => {
  it('texto e texto longo nascem com o padrão do modelo', () => {
    const schema = schemaWith(
      component('text', 'nome', { defaultValue: 'Geralt' }),
      component('textarea', 'notas', { defaultValue: 'Empurrar' }),
      component('text', 'vazio')
    )
    expect(createDefaultValues(schema)).toEqual({
      c_nome: 'Geralt',
      c_notas: 'Empurrar',
      c_vazio: ''
    })
  })

  it('imagem fixa e parágrafo não guardam valor nem aparecem nas fórmulas', () => {
    const schema = schemaWith(
      component('figure', 'roda', { src: PIXEL }),
      component('heading', 'regra', { text: 'Regra', level: 'paragraph' })
    )
    expect(createDefaultValues(schema)).toEqual({})

    const referencing = schemaWith(
      component('figure', 'roda', { src: PIXEL }),
      component('computed', 'calculo', { formula: '=roda' })
    )
    expect(codesOf(referencing)).toContain('formula-unknown-reference')
  })

  it('a linha inicial nasce sem chave: é igual à que o jogador adiciona', () => {
    const table = component('table', 'armas', {
      columns: [{ id: 'col_nome', key: 'nome', label: 'Nome', kind: 'text' }],
      rows: [
        { id: 'r1', key: 'fixa', label: 'Fixa' },
        { id: 'r2', key: 'inicial', label: '', starter: true, cells: { nome: 'Machadinha' } }
      ]
    })
    const rows = createDefaultValues(schemaWith(table))['c_armas']

    expect(isTableValue(rows)).toBe(true)
    expect(rows).toEqual([
      { id: 'r1', key: 'fixa', cells: { nome: '' } },
      { id: 'r2', cells: { nome: 'Machadinha' } }
    ])
  })

  it('coluna oculta guarda o valor, e a fórmula da linha enxerga', () => {
    const table = component('table', 'salvaguardas', {
      columns: [
        { id: 'col_atrib', key: 'atrib', label: 'Atributo', kind: 'text', hidden: true },
        {
          id: 'col_valor',
          key: 'valor',
          label: 'Valor',
          kind: 'computed',
          formula: '=se(atrib == "FOR", 3, 1)'
        }
      ],
      rows: [
        { id: 'r1', key: 'forca', label: 'Força', cells: { atrib: 'FOR' } },
        { id: 'r2', key: 'carisma', label: 'Carisma', cells: { atrib: 'CAR' } }
      ]
    })
    const schema = schemaWith(table)
    const { context } = createSheetContext(schema, createInitialValues(schema))

    expect(readFormulaValue(context, ['salvaguardas', 'forca', 'valor']).value).toBe(3)
    expect(readFormulaValue(context, ['salvaguardas', 'carisma', 'valor']).value).toBe(1)
  })

  it('ficha antiga recebe o texto padrão de um campo novo, e nunca perde o que já tinha', () => {
    const schema = schemaWith(component('text', 'nome', { defaultValue: 'Geralt' }))

    expect(migrateValues(schema, {}).values['c_nome']).toBe('Geralt')
    expect(migrateValues(schema, { c_nome: 'Ciri' }).values['c_nome']).toBe('Ciri')
  })
})

describe('validação', () => {
  it('avisa da imagem fixa vazia, sem impedir de publicar', () => {
    const report = validateSchema(schemaWith(hp, component('figure', 'roda')))
    expect(report.warnings.map((issue) => issue.code)).toContain('figure-empty')
    expect(report.ok).toBe(true)

    expect(codesOf(schemaWith(hp, component('figure', 'roda', { src: PIXEL })))).not.toContain(
      'figure-empty'
    )
  })

  it('confere a referência da imagem repetida', () => {
    const retrato = component('image', 'retrato')
    expect(
      codesOf(schemaWith(hp, retrato, component('figure', 'roda', { sourceFormula: '=retrato' })))
    ).toEqual([])
    expect(
      codesOf(schemaWith(hp, component('figure', 'roda', { sourceFormula: '=retrato' })))
    ).toContain('formula-unknown-reference')
  })

  it('fórmula não pode contar com linha inicial: o jogador pode ter removido', () => {
    const table = component('table', 'armas', {
      columns: [{ id: 'col_acerto', key: 'acerto', label: 'Acerto', kind: 'number' }],
      rows: [
        { id: 'r1', key: 'fixa', label: 'Fixa' },
        { id: 'r2', key: 'inicial', label: '', starter: true }
      ]
    })
    const ok = component('computed', 'a', { formula: '=armas.fixa.acerto' })
    const broken = component('computed', 'b', { formula: '=armas.inicial.acerto' })

    expect(codesOf(schemaWith(hp, table, ok))).toEqual([])
    expect(codesOf(schemaWith(hp, table, broken))).toContain('formula-unknown-reference')
  })
})

describe('renomear e excluir chave', () => {
  const schema = schemaWith(
    hp,
    component('image', 'retrato'),
    component('figure', 'copia', { sourceFormula: '=retrato' })
  )

  it('renomear a imagem acompanha a repetição dela em outra aba', () => {
    const imageId = findComponentByKey(schema, 'retrato')?.id ?? ''
    const renamed = renameKeyInSchema(schema, imageId, 'foto')

    const copy = findComponentByKey(renamed, 'copia')
    expect(copy?.type === 'figure' ? copy.sourceFormula : null).toBe('=foto')
    expect(codesOf(renamed)).toEqual([])
  })

  it('excluir a imagem avisa que ela está repetida em outro lugar', () => {
    expect(findKeyUsages(schema, 'retrato').map((usage) => usage.slot.field)).toContain(
      'sourceFormula'
    )
  })
})

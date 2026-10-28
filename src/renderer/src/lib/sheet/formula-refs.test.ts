import { describe, expect, it } from 'vitest'
import { createExampleSchema } from './example-template'
import {
  braceSegments,
  collectFormulaSlots,
  findKeyUsages,
  renameKeyInExpression,
  renameKeyInRollFormula,
  slotReferencedKeys
} from './formula-refs'

const example = createExampleSchema()

describe('collectFormulaSlots', () => {
  it('acha todas as fórmulas do modelo de exemplo', () => {
    const slots = collectFormulaSlots(example)
    const fields = slots.map((slot) => `${slot.field}`)

    expect(fields).toContain('modifierFormula')
    expect(fields).toContain('maxFormula')
    expect(fields).toContain('formula')
    expect(slots.some((slot) => slot.kind === 'roll')).toBe(true)
  })

  it('marca as colunas da linha como chaves locais da coluna calculada', () => {
    const slots = collectFormulaSlots(example)
    const total = slots.find((slot) => slot.label.includes('coluna Total'))
    expect(total?.localKeys).toContain('bonus')
    expect(total?.localKeys).toContain('treinado')
  })

  it('usa `valor` como chave local do modificador de atributo', () => {
    const slots = collectFormulaSlots(example)
    const modifier = slots.find((slot) => slot.field === 'modifierFormula')
    expect(modifier?.localKeys).toEqual(['valor'])
  })
})

describe('slotReferencedKeys', () => {
  it('lê as chaves de uma fórmula de rolagem só de dentro das chaves {}', () => {
    const slots = collectFormulaSlots(example)
    const initiative = slots.find((slot) => slot.label.startsWith('Iniciativa'))
    expect(initiative).toBeDefined()
    expect(slotReferencedKeys(initiative!)).toEqual(['destreza'])
  })
})

describe('braceSegments', () => {
  it('separa os trechos entre chaves', () => {
    expect(braceSegments('1d20 + {forca.mod} + {bonus}')).toEqual(['forca.mod', 'bonus'])
    expect(braceSegments('2d6+3')).toEqual([])
  })
})

describe('findKeyUsages', () => {
  it('encontra quem usa a chave', () => {
    const usages = findKeyUsages(example, 'nivel')
    const labels = usages.map((usage) => usage.slot.label)
    expect(labels).toContain('Vida → máximo')
    expect(labels).toContain('Proficiência → fórmula')
  })

  it('não encontra nada para chave sem uso', () => {
    expect(findKeyUsages(example, 'nome')).toEqual([])
  })
})

describe('renameKeyInExpression', () => {
  it('troca a referência simples', () => {
    expect(renameKeyInExpression('=forca + 1', 'forca', 'vigor')).toBe('=vigor + 1')
  })

  it('troca o começo do caminho, mantendo o resto', () => {
    expect(renameKeyInExpression('=forca.mod * 2', 'forca', 'vigor')).toBe('=vigor.mod * 2')
  })

  it('não mexe em segmento no meio do caminho', () => {
    expect(renameKeyInExpression('=pericias.forca.total', 'forca', 'vigor')).toBe(
      '=pericias.forca.total'
    )
  })

  it('não mexe em chave parecida nem em texto entre aspas', () => {
    expect(renameKeyInExpression('=forca_bruta + 1', 'forca', 'vigor')).toBe('=forca_bruta + 1')
    expect(renameKeyInExpression('=se(classe == "forca", 1, 0)', 'forca', 'vigor')).toBe(
      '=se(classe == "forca", 1, 0)'
    )
  })

  it('não confunde chave com nome de função', () => {
    expect(renameKeyInExpression('=piso(forca / 2)', 'piso', 'chao')).toBe('=piso(forca / 2)')
  })

  it('troca todas as ocorrências', () => {
    expect(renameKeyInExpression('=forca + forca.mod + forca', 'forca', 'vigor')).toBe(
      '=vigor + vigor.mod + vigor'
    )
  })

  it('devolve a fórmula intacta quando a chave não aparece', () => {
    expect(renameKeyInExpression('=1 + 2', 'forca', 'vigor')).toBe('=1 + 2')
  })

  it('não quebra com fórmula inválida', () => {
    expect(renameKeyInExpression('=forca +', 'forca', 'vigor')).toBe('=vigor +')
    expect(renameKeyInExpression('="aberto', 'forca', 'vigor')).toBe('="aberto')
  })
})

describe('renameKeyInRollFormula', () => {
  it('mexe só dentro das chaves', () => {
    expect(renameKeyInRollFormula('1d20 + {forca.mod}', 'forca', 'vigor')).toBe(
      '1d20 + {vigor.mod}'
    )
  })

  it('não confunde o d20 da notação com uma chave', () => {
    expect(renameKeyInRollFormula('1d20 + {bonus}', 'd20', 'outro')).toBe('1d20 + {bonus}')
  })
})

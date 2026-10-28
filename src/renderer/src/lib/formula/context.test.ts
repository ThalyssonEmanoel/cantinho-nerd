import { describe, expect, it } from 'vitest'
import { createObjectContext, emptyContext, withValues } from './context'

const sheet = createObjectContext({
  nome: 'Shiraga',
  forca: { value: 15, mod: 2 },
  agilidade: 0,
  treinado: true,
  vida: { current: 12, max: 30 },
  classe: 'Ocultista',
  pericias: [
    { key: 'furtividade', treino: 5, total: 7 },
    { key: 'acrobacia', treino: 0, total: 2 }
  ],
  inventario: [{ item: 'Corda', peso: 2 }, { item: 'Lanterna', peso: 3 }, { item: 'Moeda' }]
})

describe('createObjectContext', () => {
  it('resolve valor simples e texto', () => {
    expect(sheet.resolve(['nome'])).toBe('Shiraga')
    expect(sheet.resolve(['agilidade'])).toBe(0)
    expect(sheet.resolve(['treinado'])).toBe(true)
  })

  it('atributo devolve o valor, e .mod o modificador', () => {
    expect(sheet.resolve(['forca'])).toBe(15)
    expect(sheet.resolve(['forca', 'mod'])).toBe(2)
  })

  it('barra de recurso devolve o atual, e .max o máximo', () => {
    expect(sheet.resolve(['vida'])).toBe(12)
    expect(sheet.resolve(['vida', 'max'])).toBe(30)
  })

  it('acessa linha da tabela pelo nome e depois a coluna', () => {
    expect(sheet.resolve(['pericias', 'furtividade', 'total'])).toBe(7)
    expect(sheet.resolve(['pericias', 'acrobacia', 'treino'])).toBe(0)
  })

  it('devolve undefined para caminho que não existe', () => {
    expect(sheet.resolve(['nao_existe'])).toBeUndefined()
    expect(sheet.resolve(['pericias', 'natacao', 'total'])).toBeUndefined()
    expect(sheet.resolve(['forca', 'nao_existe'])).toBeUndefined()
  })

  it('tabela não é valor escalar', () => {
    expect(sheet.resolve(['inventario'])).toBeUndefined()
  })

  it('lista a coluna de uma tabela, pulando linha sem o campo', () => {
    expect(sheet.resolveList(['inventario', 'peso'])).toEqual([2, 3])
  })

  it('lista uma entrada por linha, para contar', () => {
    expect(sheet.resolveList(['inventario'])).toHaveLength(3)
    expect(sheet.resolveList(['pericias'])).toEqual(['furtividade', 'acrobacia'])
  })

  it('devolve undefined quando o caminho não é tabela', () => {
    expect(sheet.resolveList(['forca'])).toBeUndefined()
    expect(sheet.resolveList(['nao_existe'])).toBeUndefined()
  })
})

describe('emptyContext', () => {
  it('não conhece nada', () => {
    expect(emptyContext.resolve(['forca'])).toBeUndefined()
    expect(emptyContext.resolveList(['inventario'])).toBeUndefined()
  })
})

describe('withValues', () => {
  it('coloca os valores calculados na frente do contexto', () => {
    const layered = withValues(sheet, new Map([['defesa', 14]]))
    expect(layered.resolve(['defesa'])).toBe(14)
    expect(layered.resolve(['forca'])).toBe(15)
  })

  it('não atropela caminhos com mais de um segmento', () => {
    const layered = withValues(sheet, new Map([['vida', 99]]))
    expect(layered.resolve(['vida'])).toBe(99)
    expect(layered.resolve(['vida', 'max'])).toBe(30)
  })
})

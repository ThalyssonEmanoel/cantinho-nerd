import { describe, expect, it } from 'vitest'
import { createObjectContext, emptyContext } from '../formula'
import { interpolateRollFormula } from './interpolate'

const ficha = createObjectContext({
  forca: { value: 15, mod: 2 },
  inteligencia: { value: 8, mod: -1 },
  agilidade: 0,
  proficiencia: 2,
  margem: 19,
  pericias: [{ key: 'furtividade', total: 7 }]
})

function notationOf(source: string, context = ficha): string {
  const result = interpolateRollFormula(source, context)
  if (!result.ok) throw new Error(`esperava sucesso, veio: ${result.error.message}`)
  return result.value
}

describe('interpolateRollFormula', () => {
  it('deixa notação sem chaves intacta', () => {
    expect(notationOf('2d6+3')).toBe('2d6+3')
    expect(notationOf('4d6kh3')).toBe('4d6kh3')
    expect(notationOf('d20')).toBe('d20')
  })

  it('troca as chaves pelos valores da ficha', () => {
    expect(notationOf('1d20 + {forca.mod} + {proficiencia}')).toBe('1d20 + 2 + 2')
    expect(notationOf('{agilidade}d20kh1 + {pericias.furtividade.total}')).toBe('0d20kh1 + 7')
  })

  it('arruma o sinal quando o modificador é negativo', () => {
    expect(notationOf('1d20 + {inteligencia.mod}')).toBe('1d20 - 1')
  })

  it('monta a regra do atributo 0: rola 2d20 e fica com o pior', () => {
    const source = '{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}'
    expect(notationOf(source)).toBe('2d20kl1')
  })

  it('mesma fórmula com atributo normal fica com o melhor', () => {
    const agil = createObjectContext({ agilidade: 3 })
    const source = '{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}'
    expect(notationOf(source, agil)).toBe('3d20kh1')
  })

  it('erro na fórmula interna vira erro da rolagem, sem lançar', () => {
    expect(() => interpolateRollFormula('1d20 + {xyz}', ficha)).not.toThrow()
    const result = interpolateRollFormula('1d20 + {xyz}', ficha)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown-reference')
  })

  it('reclama de chave sem fechar e de chave vazia', () => {
    const aberta = interpolateRollFormula('1d20 + {forca', ficha)
    expect(aberta.ok).toBe(false)
    if (!aberta.ok) expect(aberta.error.message).toContain('fechar a chave')

    const vazia = interpolateRollFormula('1d20 + {}', ficha)
    expect(vazia.ok).toBe(false)
    if (!vazia.ok) expect(vazia.error.message).toContain('vazia')
  })

  it('reclama de fórmula vazia', () => {
    const result = interpolateRollFormula('   ', emptyContext)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('notation')
  })

  it('sem contexto, referência não existe', () => {
    const result = interpolateRollFormula('1d20 + {forca}', emptyContext)
    expect(result.ok).toBe(false)
  })
})

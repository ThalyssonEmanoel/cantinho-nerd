import { describe, expect, it } from 'vitest'
import { parseFormula, stripFormulaPrefix } from './parser'

/** Atalho: a árvore de uma fórmula que compila. */
function parse(source: string): ReturnType<typeof parseFormula> {
  return parseFormula(source)
}

describe('stripFormulaPrefix', () => {
  it('remove o = do campo calculado e informa o deslocamento', () => {
    expect(stripFormulaPrefix('=forca + 1')).toEqual({ text: 'forca + 1', offset: 1 })
    expect(stripFormulaPrefix('  =  forca')).toEqual({ text: 'forca', offset: 5 })
  })

  it('aceita fórmula sem o =', () => {
    expect(stripFormulaPrefix('forca + 1')).toEqual({ text: 'forca + 1', offset: 0 })
  })
})

describe('parseFormula', () => {
  it('lê referência com caminho', () => {
    const result = parse('pericias.furtividade.total')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      kind: 'reference',
      path: ['pericias', 'furtividade', 'total'],
      position: 0
    })
  })

  it('distingue número decimal de acesso por ponto', () => {
    const decimal = parse('1.5')
    expect(decimal.ok && decimal.value.kind === 'number' && decimal.value.value).toBe(1.5)

    const member = parse('forca.mod')
    expect(member.ok && member.value.kind === 'reference' && member.value.path).toEqual([
      'forca',
      'mod'
    ])
  })

  it('respeita a precedência dos operadores', () => {
    const result = parse('2 + 3 * 4')
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== 'binary') throw new Error('esperava binário')
    expect(result.value.operator).toBe('+')
    expect(result.value.right.kind).toBe('binary')
  })

  it('trata ^ como associativo à direita', () => {
    const result = parse('2 ^ 3 ^ 2')
    if (!result.ok || result.value.kind !== 'binary') throw new Error('esperava binário')
    expect(result.value.operator).toBe('^')
    expect(result.value.right.kind).toBe('binary')
  })

  it('lê chamada de função com vários argumentos', () => {
    const result = parse('se(forca > 10, 1, 2)')
    if (!result.ok || result.value.kind !== 'call') throw new Error('esperava chamada')
    expect(result.value.name).toBe('se')
    expect(result.value.args).toHaveLength(3)
  })

  it('aponta a posição do erro', () => {
    const result = parse('1 + * 2')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('syntax')
    expect(result.error.position).toBe(4)
  })

  it('dá dica em português para os erros comuns', () => {
    const and = parse('a && b')
    expect(and.ok).toBe(false)
    if (!and.ok) expect(and.error.message).toContain('"e"')

    const or = parse('a || b')
    if (!or.ok) expect(or.error.message).toContain('"ou"')

    const single = parse('a = b')
    if (!single.ok) expect(single.error.message).toContain('==')
  })

  it('recusa parêntese e aspas sem fechar', () => {
    expect(parse('(1 + 2').ok).toBe(false)
    expect(parse('"texto').ok).toBe(false)
  })

  it('recusa fórmula vazia', () => {
    const result = parse('=')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Fórmula vazia.')
  })

  it('nunca lança, nem com entrada estranha', () => {
    for (const source of ['', '=', ')))', '1 +', '@@@', 'se(', '...', 'forca..mod']) {
      expect(() => parseFormula(source)).not.toThrow()
      expect(parseFormula(source).ok).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { createObjectContext, withValues } from './context'
import { evaluateFormula } from './evaluate'
import type { FormulaContext, FormulaValue } from './types'

/** Ficha de teste no espírito de um sistema d20. */
const ficha = createObjectContext({
  forca: { value: 15, mod: 2 },
  inteligencia: { value: 8, mod: -1 },
  agilidade: 0,
  nivel: 3,
  treinado: true,
  destreinado: false,
  classe: 'Ocultista',
  // Lista de opções: guarda o valor numérico da opção escolhida.
  tamanho: 2,
  // Texto que o jogador digitou num campo de texto.
  anotacao: '1,5',
  vazio: '',
  vida: { current: 12, max: 30 },
  pericias: [
    { key: 'furtividade', treino: 5, total: 7 },
    { key: 'acrobacia', treino: 0, total: 2 }
  ],
  inventario: [{ item: 'Corda', peso: 2 }, { item: 'Lanterna', peso: 3 }, { item: 'Moeda' }]
})

/** Avalia e devolve o valor, falhando o teste se der erro. */
function valueOf(source: string, context: FormulaContext = ficha): FormulaValue {
  const result = evaluateFormula(source, context)
  if (!result.ok) throw new Error(`esperava sucesso, veio: ${result.error.message}`)
  return result.value
}

/** Avalia e devolve o erro, falhando o teste se der certo. */
function errorOf(
  source: string,
  context: FormulaContext = ficha
): { code: string; message: string } {
  const result = evaluateFormula(source, context)
  if (result.ok) throw new Error(`esperava erro, veio: ${String(result.value)}`)
  return result.error
}

describe('casos exigidos pela especificação (Fase 1)', () => {
  it('piso((forca-10)/2) dá 2 com força 15', () => {
    expect(valueOf('=piso((forca - 10) / 2)')).toBe(2)
  })

  it('piso((forca-10)/2) dá -1 com força 8', () => {
    const fraco = createObjectContext({ forca: 8 })
    expect(valueOf('=piso((forca - 10) / 2)', fraco)).toBe(-1)
  })

  it('soma(inventario.peso) soma a coluna da tabela', () => {
    expect(valueOf('=soma(inventario.peso)')).toBe(5)
  })

  it('fórmula inválida devolve erro em vez de lançar exceção', () => {
    for (const source of ['=1 +', '=piso(', '=forca +* 2', '=@@@', '=']) {
      expect(() => evaluateFormula(source, ficha)).not.toThrow()
      expect(evaluateFormula(source, ficha).ok).toBe(false)
    }
  })
})

describe('referências', () => {
  it('lê atributo, modificador, barra e tabela', () => {
    expect(valueOf('=forca')).toBe(15)
    expect(valueOf('=forca.mod')).toBe(2)
    expect(valueOf('=vida')).toBe(12)
    expect(valueOf('=vida.max')).toBe(30)
    expect(valueOf('=pericias.furtividade.total')).toBe(7)
  })

  it('caixa de seleção vale 1 e 0 nas contas', () => {
    expect(valueOf('=treinado * 2')).toBe(2)
    expect(valueOf('=destreinado * 2')).toBe(0)
    expect(valueOf('=treinado + nivel')).toBe(4)
  })

  it('campo de texto vazio vale 0, para não estragar a ficha', () => {
    expect(valueOf('=vazio + 5')).toBe(5)
  })

  it('aceita vírgula como separador decimal no texto digitado', () => {
    expect(valueOf('=anotacao * 2')).toBe(3)
  })

  it('reclama de referência que não existe', () => {
    expect(errorOf('=xyz + 1').code).toBe('unknown-reference')
    expect(errorOf('=xyz + 1').message).toContain('xyz')
  })

  it('reclama de texto que não é número numa conta', () => {
    expect(errorOf('=classe * 2').code).toBe('type')
  })
})

describe('operadores', () => {
  it('faz aritmética com a precedência certa', () => {
    expect(valueOf('=2 + 3 * 4')).toBe(14)
    expect(valueOf('=(2 + 3) * 4')).toBe(20)
    expect(valueOf('=10 % 3')).toBe(1)
    expect(valueOf('=2 ^ 3 ^ 2')).toBe(512)
    expect(valueOf('=-2 ^ 2')).toBe(-4)
    expect(valueOf('=+5')).toBe(5)
  })

  it('compara números', () => {
    expect(valueOf('=forca > 10')).toBe(true)
    expect(valueOf('=forca <= 10')).toBe(false)
    expect(valueOf('=agilidade == 0')).toBe(true)
    expect(valueOf('=nivel != 3')).toBe(false)
  })

  it('compara textos', () => {
    expect(valueOf('=classe == "Ocultista"')).toBe(true)
    expect(valueOf('=classe == "Combatente"')).toBe(false)
    expect(valueOf("=classe != 'Lutador'")).toBe(true)
  })

  it('usa e, ou, nao', () => {
    expect(valueOf('=forca > 10 e treinado')).toBe(true)
    expect(valueOf('=forca > 20 ou nivel == 3')).toBe(true)
    expect(valueOf('=nao (forca > 20)')).toBe(true)
  })

  it('e/ou têm curto-circuito, então não estouram no lado direito', () => {
    const semVida = createObjectContext({ vida: { current: 0, max: 10 } })
    expect(valueOf('=vida > 0 e 10 / vida > 1', semVida)).toBe(false)
    expect(valueOf('=vida == 0 ou 10 / vida > 1', semVida)).toBe(true)
  })

  it('avisa divisão por zero', () => {
    expect(errorOf('=1 / 0').code).toBe('division-by-zero')
    expect(errorOf('=1 % 0').code).toBe('division-by-zero')
  })
})

describe('funções', () => {
  it('piso, teto, arred e abs, com alias em inglês', () => {
    expect(valueOf('=piso(1.9)')).toBe(1)
    expect(valueOf('=floor(1.9)')).toBe(1)
    expect(valueOf('=teto(1.1)')).toBe(2)
    expect(valueOf('=ceil(1.1)')).toBe(2)
    expect(valueOf('=abs(-3)')).toBe(3)
  })

  it('arred arredonda meio para longe do zero', () => {
    expect(valueOf('=arred(2.5)')).toBe(3)
    expect(valueOf('=arred(-1.5)')).toBe(-2)
    expect(valueOf('=arred(2.4)')).toBe(2)
  })

  it('min e max aceitam vários valores', () => {
    expect(valueOf('=min(3, 1, 2)')).toBe(1)
    expect(valueOf('=max(forca, nivel)')).toBe(15)
  })

  it('se escolhe o ramo e só avalia o escolhido', () => {
    expect(valueOf('=se(forca > 10, "forte", "fraco")')).toBe('forte')
    expect(valueOf('=if(forca > 100, 1, 2)')).toBe(2)
    const semVida = createObjectContext({ vida: { current: 0, max: 10 } })
    expect(valueOf('=se(vida == 0, 0, 100 / vida)', semVida)).toBe(0)
  })

  it('soma aceita valores soltos e contar conta as linhas', () => {
    expect(valueOf('=soma(1, 2, 3)')).toBe(6)
    expect(valueOf('=soma(forca.mod, nivel)')).toBe(5)
    expect(valueOf('=contar(inventario)')).toBe(3)
    expect(valueOf('=count(pericias)')).toBe(2)
  })

  it('reclama de função desconhecida e de número errado de argumentos', () => {
    expect(errorOf('=raiz(4)').code).toBe('unknown-function')
    expect(errorOf('=se(1, 2)').code).toBe('arity')
    expect(errorOf('=piso(1, 2)').code).toBe('arity')
    expect(errorOf('=contar(forca)').code).toBe('type')
  })
})

describe('coluna calculada dentro de uma tabela', () => {
  // A especificação (5.4) diz que a coluna calculada usa as colunas da própria linha pelo
  // nome. A Fase 3 monta um contexto por linha assim, em cima do contexto da ficha.
  const linha = new Map<string, FormulaValue>([
    ['atributo', 3],
    ['treino', 5]
  ])
  const contextoDaLinha = withValues(ficha, linha)

  it('vê as colunas da linha e ainda alcança a ficha', () => {
    expect(valueOf('=atributo + treino', contextoDaLinha)).toBe(8)
    expect(valueOf('=atributo + treino + nivel', contextoDaLinha)).toBe(11)
  })

  it('a coluna da linha tem prioridade sobre a chave da ficha', () => {
    const conflito = withValues(ficha, new Map<string, FormulaValue>([['nivel', 99]]))
    expect(valueOf('=nivel', conflito)).toBe(99)
  })
})

describe('proteções', () => {
  it('não deixa fórmula aninhada demais estourar a pilha', () => {
    const source = '='.concat('('.repeat(200), '1', ')'.repeat(200))
    const result = evaluateFormula(source, ficha)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('depth')
  })

  it('aceita fórmula com e sem o = inicial', () => {
    expect(valueOf('=forca + 1')).toBe(16)
    expect(valueOf('forca + 1')).toBe(16)
  })
})

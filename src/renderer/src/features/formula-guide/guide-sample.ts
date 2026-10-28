import { interpolateRollFormula } from '@/lib/dice'
import { evaluateFormula, type FormulaResult, type FormulaValue } from '@/lib/formula'
import {
  createRowFormulaContext,
  createSheetContext,
  type SheetComponent,
  type SheetSchema,
  type SheetValues
} from '@/lib/sheet'

/**
 * A ficha de exemplo do Guia de fórmulas.
 *
 * É um modelo de verdade, calculado pelo mesmo caminho da ficha do jogador
 * (`createSheetContext`): o modificador sai da fórmula do atributo, o máximo da vida sai da
 * fórmula da barra, o total da perícia sai da coluna calculada. Assim o guia nunca mostra
 * um resultado que o app não daria — e o teste ao lado confere cada exemplo.
 */

const base = { editableBy: 'player' as const, visibleTo: 'all' as const }
const at = (y: number): SheetComponent['layout'] => ({ x: 0, y, w: 4, h: 2 })

const COMPONENTS: SheetComponent[] = [
  { ...base, id: 'g_nome', type: 'text', key: 'nome', label: 'Nome', layout: at(0) },
  {
    ...base,
    id: 'g_classe',
    type: 'select',
    key: 'classe',
    label: 'Classe',
    options: [
      { id: 'o_combatente', label: 'Combatente' },
      { id: 'o_especialista', label: 'Especialista' },
      { id: 'o_ocultista', label: 'Ocultista' }
    ],
    layout: at(1)
  },
  {
    ...base,
    id: 'g_treinamento',
    type: 'select',
    key: 'treinamento',
    label: 'Treinamento',
    options: [
      { id: 'o_destreinado', label: 'Destreinado', value: 0 },
      { id: 'o_treinado', label: 'Treinado', value: 5 },
      { id: 'o_veterano', label: 'Veterano', value: 10 }
    ],
    layout: at(2)
  },
  { ...base, id: 'g_nivel', type: 'number', key: 'nivel', label: 'Nível', layout: at(3) },
  {
    ...base,
    id: 'g_forca',
    type: 'attribute',
    key: 'forca',
    label: 'Força',
    modifierFormula: 'piso((valor - 10) / 2)',
    layout: at(4)
  },
  {
    ...base,
    id: 'g_destreza',
    type: 'attribute',
    key: 'destreza',
    label: 'Destreza',
    modifierFormula: 'piso((valor - 10) / 2)',
    layout: at(5)
  },
  {
    ...base,
    id: 'g_constituicao',
    type: 'attribute',
    key: 'constituicao',
    label: 'Constituição',
    modifierFormula: 'piso((valor - 10) / 2)',
    layout: at(6)
  },
  // Atributo no estilo Ordem Paranormal: sem modificador, o valor é o número de dados.
  {
    ...base,
    id: 'g_agilidade',
    type: 'attribute',
    key: 'agilidade',
    label: 'Agilidade',
    layout: at(7)
  },
  {
    ...base,
    id: 'g_vida',
    type: 'resource',
    key: 'vida',
    label: 'Vida',
    maxFormula: '=10 + constituicao.mod * nivel',
    showButtons: true,
    layout: at(8)
  },
  {
    ...base,
    id: 'g_escudo',
    type: 'checkbox',
    key: 'escudo',
    label: 'Escudo',
    defaultValue: false,
    layout: at(9)
  },
  {
    ...base,
    id: 'g_proficiencia',
    type: 'computed',
    key: 'proficiencia',
    label: 'Proficiência',
    formula: '=teto(nivel / 4) + 1',
    format: 'signed',
    layout: at(10)
  },
  {
    ...base,
    id: 'g_defesa',
    type: 'computed',
    key: 'defesa',
    label: 'Defesa',
    formula: '=10 + destreza.mod + se(escudo, 2, 0)',
    format: 'integer',
    layout: at(11)
  },
  {
    ...base,
    id: 'g_pericias',
    type: 'table',
    key: 'pericias',
    label: 'Perícias',
    columns: [
      { id: 'col_atributo', key: 'atributo', label: 'Atributo', kind: 'number' },
      { id: 'col_treino', key: 'treino', label: 'Treino', kind: 'number' },
      { id: 'col_bonus', key: 'bonus', label: 'Bônus', kind: 'number' },
      {
        id: 'col_total',
        key: 'total',
        label: 'Total',
        kind: 'computed',
        formula: '=atributo + treino + bonus'
      },
      {
        id: 'col_rolar',
        key: 'rolar',
        label: 'Rolar',
        kind: 'rollButton',
        formula: '1d20 + {total}'
      }
    ],
    rows: [
      { id: 'r_furtividade', key: 'furtividade', label: 'Furtividade' },
      { id: 'r_atletismo', key: 'atletismo', label: 'Atletismo' },
      { id: 'r_percepcao', key: 'percepcao', label: 'Percepção' }
    ],
    playerCanAddRows: false,
    showRowLabels: true,
    layout: at(12)
  },
  {
    ...base,
    id: 'g_inventario',
    type: 'table',
    key: 'inventario',
    label: 'Inventário',
    columns: [
      { id: 'col_item', key: 'item', label: 'Item', kind: 'text' },
      { id: 'col_peso', key: 'peso', label: 'Peso', kind: 'number' },
      { id: 'col_quantidade', key: 'quantidade', label: 'Qtd.', kind: 'number' }
    ],
    rows: [],
    playerCanAddRows: true,
    showRowLabels: false,
    layout: at(13)
  }
]

export const GUIDE_SCHEMA: SheetSchema = {
  formatVersion: 1,
  tabs: [{ id: 'tab_guia', label: 'Exemplo', components: COMPONENTS }]
}

const GUIDE_VALUES: SheetValues = {
  g_nome: 'Lia Vaz',
  g_classe: 'o_ocultista',
  g_treinamento: 'o_treinado',
  g_nivel: 3,
  g_forca: 16,
  g_destreza: 13,
  g_constituicao: 14,
  g_agilidade: 2,
  g_vida: { current: 12 },
  g_escudo: true,
  g_pericias: [
    { id: 'r_furtividade', key: 'furtividade', cells: { atributo: 2, treino: 5, bonus: 0 } },
    { id: 'r_atletismo', key: 'atletismo', cells: { atributo: 3, treino: 0, bonus: 1 } },
    { id: 'r_percepcao', key: 'percepcao', cells: { atributo: 1, treino: 5, bonus: 0 } }
  ],
  g_inventario: [
    { id: 'i1', cells: { item: 'Espada', peso: 3, quantidade: 1 } },
    { id: 'i2', cells: { item: 'Corda', peso: 1.5, quantidade: 2 } },
    { id: 'i3', cells: { item: 'Lanterna', peso: 0.5, quantidade: 1 } }
  ]
}

/** Troca valores da ficha de exemplo pela chave (ex.: `{ agilidade: 0 }`). */
export type GuideOverrides = Readonly<Record<string, number>>

function valuesWith(overrides: GuideOverrides | undefined): SheetValues {
  if (overrides === undefined) return GUIDE_VALUES
  const values: SheetValues = { ...GUIDE_VALUES }
  for (const [key, value] of Object.entries(overrides)) {
    const component = COMPONENTS.find((item) => item.key === key)
    if (component !== undefined) values[component.id] = value
  }
  return values
}

export function guideContext(
  overrides?: GuideOverrides
): ReturnType<typeof createSheetContext>['context'] {
  return createSheetContext(GUIDE_SCHEMA, valuesWith(overrides)).context
}

export function evaluateGuideFormula(formula: string, overrides?: GuideOverrides): FormulaResult {
  return evaluateFormula(formula, guideContext(overrides))
}

/**
 * Calcula os `{…}` de uma fórmula de rolagem (sem rolar). `row` simula o botão de rolagem
 * dentro de uma linha da tabela de perícias, onde `{total}` é o total daquela linha.
 */
export function interpolateGuideRoll(
  formula: string,
  options: { overrides?: GuideOverrides; row?: string } = {}
): FormulaResult<string> {
  let context = guideContext(options.overrides)
  if (options.row !== undefined) {
    const table = COMPONENTS.find((item) => item.key === 'pericias')
    if (table?.type === 'table') context = createRowFormulaContext(context, table, options.row)
  }
  return interpolateRollFormula(formula, context)
}

/** Valor como o guia mostra: número com vírgula, verdadeiro/falso, texto entre aspas. */
export function describeValue(value: FormulaValue): string {
  if (typeof value === 'boolean') return value ? 'verdadeiro (vale 1)' : 'falso (vale 0)'
  if (typeof value === 'string') return `"${value}"`
  return String(Number(value.toFixed(4))).replace('.', ',')
}

// ---------------------------------------------------------------------------
// Exemplos do guia. Cada `expected` é conferido no teste com o motor de verdade.
// ---------------------------------------------------------------------------

export interface FormulaExample {
  formula: string
  expected: FormulaValue
  note: string
  overrides?: GuideOverrides
  /**
   * Quando a fórmula só faz sentido dentro de um campo (o `valor` da fórmula do
   * modificador), o resultado é lido por este caminho da ficha.
   */
  evaluateAs?: string
}

export interface RollExample {
  formula: string
  /** Notação depois de calcular os `{…}` — é ela que vai para os dados. */
  expected: string
  note: string
  overrides?: GuideOverrides
  row?: string
}

export interface ErrorExample {
  formula: string
  /** Pedaço da mensagem que aparece no tooltip do #ERRO. */
  expectedMessage: string
  note: string
}

/** Valores da ficha de exemplo, na ordem em que o guia os apresenta. */
export const SAMPLE_TABLE: { key: string; what: string; value: string }[] = [
  { key: 'nome', what: 'Texto curto', value: '"Lia Vaz"' },
  { key: 'classe', what: 'Lista de opções sem número', value: 'Ocultista' },
  { key: 'treinamento', what: 'Lista com valor numérico', value: 'Treinado (vale 5)' },
  { key: 'nivel', what: 'Número', value: '3' },
  { key: 'forca', what: 'Atributo, mod = piso((valor − 10) / 2)', value: '16 (mod +3)' },
  { key: 'destreza', what: 'Atributo', value: '13 (mod +1)' },
  { key: 'constituicao', what: 'Atributo', value: '14 (mod +2)' },
  { key: 'agilidade', what: 'Atributo sem modificador', value: '2' },
  { key: 'vida', what: 'Barra, máximo = 10 + constituicao.mod * nivel', value: '12 de 16' },
  { key: 'escudo', what: 'Caixa de seleção', value: 'marcada' },
  { key: 'proficiencia', what: 'Calculado: teto(nivel / 4) + 1', value: '2' },
  { key: 'defesa', what: 'Calculado: 10 + destreza.mod + se(escudo, 2, 0)', value: '13' },
  {
    key: 'pericias',
    what: 'Tabela (atributo, treino, bonus, total = atributo + treino + bonus)',
    value: 'furtividade 7 · atletismo 4 · percepcao 6'
  },
  {
    key: 'inventario',
    what: 'Tabela (item, peso, quantidade)',
    value: 'espada 3 · corda 1,5 · lanterna 0,5'
  }
]

export const ARITHMETIC_EXAMPLES: FormulaExample[] = [
  { formula: '=2 + 3 * 4', expected: 14, note: 'Multiplicação antes da soma, como na escola.' },
  { formula: '=(2 + 3) * 4', expected: 20, note: 'Parênteses mandam na ordem.' },
  { formula: '=10 / 4', expected: 2.5, note: 'Divisão pode dar número quebrado.' },
  { formula: '=10 % 3', expected: 1, note: 'Resto da divisão.' },
  { formula: '=2 ^ 3', expected: 8, note: 'Potência: 2 × 2 × 2.' }
]

export const REFERENCE_EXAMPLES: FormulaExample[] = [
  { formula: '=forca', expected: 16, note: 'O valor do atributo.' },
  {
    formula: '=forca.mod',
    expected: 3,
    note: 'O modificador, calculado pela fórmula do atributo.'
  },
  { formula: '=vida', expected: 12, note: 'Barra de recurso: o valor atual.' },
  { formula: '=vida.max', expected: 16, note: 'Barra de recurso: o máximo.' },
  { formula: '=vida.max - vida', expected: 4, note: 'Quanto de dano a personagem já levou.' },
  { formula: '=nivel * 2', expected: 6, note: 'Número comum.' },
  { formula: '=escudo * 2', expected: 2, note: 'Caixa marcada vale 1; desmarcada vale 0.' },
  { formula: '=treinamento', expected: 5, note: 'Opção com valor numérico devolve o número.' },
  { formula: '=classe', expected: 'Ocultista', note: 'Opção sem número devolve o texto.' },
  { formula: '=proficiencia + forca.mod', expected: 5, note: 'Um calculado pode usar outro.' }
]

export const FUNCTION_EXAMPLES: FormulaExample[] = [
  { formula: '=piso(7 / 2)', expected: 3, note: 'Arredonda para baixo (floor).' },
  { formula: '=teto(7 / 2)', expected: 4, note: 'Arredonda para cima (ceil).' },
  {
    formula: '=arred(2.5)',
    expected: 3,
    note: 'Arredonda para o mais perto; o meio sobe (round).'
  },
  { formula: '=arred(-1.5)', expected: -2, note: 'No negativo, o meio se afasta do zero.' },
  { formula: '=min(forca, 15)', expected: 15, note: 'O menor dos valores: um teto para a Força.' },
  { formula: '=max(destreza.mod, 0)', expected: 1, note: 'O maior dos valores: nunca negativo.' },
  { formula: '=abs(2 - 6)', expected: 4, note: 'Tira o sinal.' },
  { formula: '=soma(forca, destreza, constituicao)', expected: 43, note: 'Soma vários valores.' },
  { formula: '=soma(inventario.peso)', expected: 5, note: 'Soma uma coluna da tabela inteira.' },
  { formula: '=contar(inventario)', expected: 3, note: 'Quantas linhas a tabela tem.' },
  {
    formula: '=se(vida < 5, "Morrendo", "De pé")',
    expected: 'De pé',
    note: 'se(condição, valor se sim, valor se não).'
  }
]

export const LOGIC_EXAMPLES: FormulaExample[] = [
  { formula: '=nivel >= 3', expected: true, note: 'Comparações: ==  !=  <  <=  >  >=' },
  { formula: '=classe == "Ocultista"', expected: true, note: 'Texto vai entre aspas.' },
  { formula: '=classe != "Combatente"', expected: true, note: 'Diferente de.' },
  { formula: '=vida > 0 e escudo', expected: true, note: '`e`: as duas coisas precisam valer.' },
  { formula: '=nivel > 5 ou forca >= 16', expected: true, note: '`ou`: basta uma valer.' },
  { formula: '=nao escudo', expected: false, note: '`nao`: inverte.' },
  {
    formula: '=se(nivel >= 5, 3, 2)',
    expected: 2,
    note: 'Comparação dentro do se: algo que muda com o nível.'
  }
]

/** Fórmulas reais de sistemas, para copiar e adaptar. */
export const RECIPE_EXAMPLES: FormulaExample[] = [
  {
    formula: '=teto(nivel / 4) + 1',
    expected: 2,
    note: 'Bônus de proficiência no estilo d20 (+2 até o nível 4, +3 até o 8…).'
  },
  {
    formula: '=10 + destreza.mod + se(escudo, 2, 0)',
    expected: 13,
    note: 'Defesa: base 10, mais Destreza, mais 2 se tiver escudo.'
  },
  {
    formula: '=10 + constituicao.mod * nivel',
    expected: 16,
    note: 'Vida máxima que cresce com o nível (vai no "Máximo por fórmula" da barra).'
  },
  {
    formula: '=forca * 5',
    expected: 80,
    note: 'Carga máxima; compare com =soma(inventario.peso) para saber se está sobrecarregada.'
  }
]

export const BAR_EXAMPLES: FormulaExample[] = [
  {
    formula: '=10 + constituicao.mod * nivel',
    expected: 16,
    note: 'Máximo por fórmula: sobe junto com o nível e a Constituição.'
  },
  {
    formula: '=arred(vida / vida.max * 100)',
    expected: 75,
    note: 'Quanto de vida sobrou, em porcentagem.'
  }
]

export const TABLE_EXAMPLES: FormulaExample[] = [
  { formula: '=pericias.furtividade.total', expected: 7, note: 'Furtividade: 2 + 5 + 0.' },
  {
    formula: '=pericias.atletismo.total + forca.mod',
    expected: 7,
    note: 'Uma célula da tabela numa conta qualquer.'
  },
  { formula: '=soma(pericias.treino)', expected: 10, note: 'Soma a coluna inteira.' },
  { formula: '=soma(inventario.peso)', expected: 5, note: 'Peso total carregado.' },
  { formula: '=contar(inventario)', expected: 3, note: 'Quantos itens a mochila tem.' }
]

export const VISIBILITY_EXAMPLES: FormulaExample[] = [
  {
    formula: 'classe == "Ocultista"',
    expected: true,
    note: 'A aba de Rituais só para ocultistas.'
  },
  { formula: 'nivel >= 5', expected: false, note: 'Habilidade que libera no nível 5.' },
  { formula: 'escudo', expected: true, note: 'O bônus do escudo só com ele marcado.' }
]

export const ATTRIBUTE_EXAMPLES: FormulaExample[] = [
  {
    formula: 'piso((valor - 10) / 2)',
    expected: 3,
    note: 'Com Força 16: (16 − 10) / 2 = 3.',
    evaluateAs: '=forca.mod'
  },
  {
    formula: 'piso((valor - 10) / 2)',
    expected: -1,
    note: 'Com Força 8: (8 − 10) / 2 = −1, e o piso arredonda para baixo.',
    overrides: { forca: 8 },
    evaluateAs: '=forca.mod'
  }
]

/** Resultado de um exemplo, do jeito que a ficha calcularia. */
export function evaluateExample(example: FormulaExample): FormulaResult {
  return evaluateGuideFormula(example.evaluateAs ?? example.formula, example.overrides)
}

export const ROLL_EXAMPLES: RollExample[] = [
  { formula: '1d20 + {forca.mod}', expected: '1d20 + 3', note: 'Teste de Força no estilo d20.' },
  {
    formula: '1d20 + {forca.mod} + {proficiencia}',
    expected: '1d20 + 3 + 2',
    note: 'Ataque: atributo mais proficiência.'
  },
  { formula: '2d6 + {forca.mod}', expected: '2d6 + 3', note: 'Dano de uma arma grande.' },
  {
    formula: '{agilidade}d20kh1',
    expected: '2d20kh1',
    note: 'Estilo Ordem Paranormal: rola tantos d20 quanto o atributo e fica com o maior.'
  },
  {
    formula: '{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}',
    expected: '2d20kh1',
    note: 'Com Agilidade 2: dois dados, fica com o maior.'
  },
  {
    formula: '{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}',
    expected: '2d20kl1',
    note: 'A mesma fórmula com Agilidade 0: rola dois e fica com o PIOR.',
    overrides: { agilidade: 0 }
  },
  {
    formula: '1d20 + {total}',
    expected: '1d20 + 7',
    note: 'Botão dentro da tabela de perícias, na linha Furtividade: {total} é o total dela.',
    row: 'furtividade'
  },
  {
    formula: '1d20 + {pericias.furtividade.total}',
    expected: '1d20 + 7',
    note: 'O mesmo teste fora da tabela, chamando a linha pelo nome.'
  }
]

export const ERROR_EXAMPLES: ErrorExample[] = [
  { formula: '=forcaa + 1', expectedMessage: 'não existe', note: 'Chave escrita errada.' },
  {
    formula: '=forca +',
    expectedMessage: 'terminou antes do esperado',
    note: 'Conta pela metade.'
  },
  { formula: '=10 / (nivel - 3)', expectedMessage: 'Divisão por zero', note: 'Dividiu por zero.' },
  { formula: '=classe + 1', expectedMessage: 'não é um número', note: 'Somou texto com número.' },
  {
    formula: '=piso(1, 2)',
    expectedMessage: 'precisa de 1 argumento',
    note: 'Função com valores demais.'
  }
]

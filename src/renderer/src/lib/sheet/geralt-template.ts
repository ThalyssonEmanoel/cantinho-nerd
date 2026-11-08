import magicWheelSrc from '../../../../../docs/fichas/magia-elemental.webp?inline'
import { slugifyKey } from './keys'
import { TEMPLATE_FILE_FORMAT, type TemplateFile } from './schema'
import {
  at,
  attribute,
  checkbox,
  choose,
  column,
  computed,
  figure,
  heading,
  image,
  markers,
  number,
  optionId,
  paragraph,
  q,
  resource,
  roll,
  select,
  selectOptions,
  table,
  text,
  textarea
} from './template-kit'
import type {
  GridPosition,
  SheetComponent,
  SheetSchema,
  SheetTab,
  TableColumn,
  TableComponent,
  TableRowTemplate
} from './types'

/**
 * A planilha "Ficha do Geralt Wolf Vengerberg" (docs/fichas/, 12 abas do Google Sheets)
 * adaptada para um modelo de ficha.
 *
 * O app não usa este arquivo: o teste ao lado gera dele os dois `.json` de `docs/fichas/` que
 * o mestre importa na biblioteca. Mudou uma regra: edite aqui e rode
 * `npx vitest run geralt-template -u`.
 *
 * Cada fórmula é a tradução da célula indicada no comentário (`PERSONAGEM!P26`). Os testes
 * refazem as contas com as fórmulas originais, então uma diferença aqui aparece lá.
 *
 * Linhas em branco da planilha viraram tabela em que o jogador adiciona linhas, e grupos de
 * linhas soltas viraram texto longo: o limite de 14 magias por círculo, por exemplo, era
 * falta de espaço na planilha, não regra do sistema.
 */

export const BLANK_TEMPLATE_NAME = 'Ficha padrão da mesa'
export const GERALT_TEMPLATE_NAME = 'Ficha do Geralt Wolf Vengerberg'

interface WeaponData {
  key: string
  name: string
  damage: string
  kind: string
  properties: string
}

interface MinorCraftData {
  key: string
  name: string
  doctrines: string
}

/**
 * O que na planilha é do personagem, e não do sistema.
 *
 * Fica separado porque a mesa usa um modelo só para todo mundo (`character_template_id` da
 * sessão): o modelo da mesa não pode nascer com o nome e as armas de um jogador. O resto do que
 * vinha escrito na planilha, como a runa do familiar, é parte da ficha de qualquer personagem.
 */
interface CharacterData {
  name?: string
  firstClass: string
  weapons: readonly WeaponData[]
  combatNotes?: string
  minorCrafts: readonly MinorCraftData[]
}

const NO_CHARACTER: CharacterData = { firstClass: 'Classe 1', weapons: [], minorCrafts: [] }

const GERALT: CharacterData = {
  name: 'Geralt Wolf Vengerberg',
  firstClass: 'Combatente',
  weapons: [
    {
      key: 'lanca_longa',
      name: 'Lança Longa',
      damage: '1d12',
      kind: 'p/ 1d8 r',
      properties: 'Duas mãos, extensão 2, híbrida (1d6 cortante), pesada'
    },
    {
      key: 'machadinha',
      name: 'Machadinha',
      damage: '1d6',
      kind: 'r',
      properties: 'Leve, arremesso (20/60 pés)'
    }
  ],
  combatNotes:
    'Empurrar - A propriedade de maestria Empurrar permite que você empurre uma criatura que seja de uma categoria de tamanho a mais que a sua, ou menor, a 10 pés de distância de você, em um acerto.',
  minorCrafts: [{ key: 'guia', name: 'Guia', doctrines: 'Piloto' }]
}

const LIFE_COLOR = '#ef4444'
const MANA_COLOR = '#3b82f6'
const KI_COLOR = '#f59e0b'
const RESOURCE_COLOR = '#a855f7'

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

interface AttributeData {
  abbr: 'FOR' | 'DEX' | 'CON' | 'INT' | 'SAB' | 'CAR'
  key: string
  label: string
}

/** A `AttTable` da planilha: siglas na ordem das listas dela. */
const ATTRIBUTES: readonly AttributeData[] = [
  { abbr: 'FOR', key: 'forca', label: 'Força' },
  { abbr: 'DEX', key: 'destreza', label: 'Destreza' },
  { abbr: 'CON', key: 'constituicao', label: 'Constituição' },
  { abbr: 'INT', key: 'inteligencia', label: 'Inteligência' },
  { abbr: 'SAB', key: 'sabedoria', label: 'Sabedoria' },
  { abbr: 'CAR', key: 'carisma', label: 'Carisma' }
]

const ABBREVIATIONS = ATTRIBUTES.map((data) => data.abbr)

/** `FLOOR((valor-10)/2,1)`, o modificador de todas as abas. */
const MODIFIER = '=piso((valor - 10) / 2)'

/** O `VLOOKUP(lista,AttTable,2,FALSE)`: o modificador do atributo escolhido numa lista. */
function modifierOf(
  selectKey: string,
  modifier: (data: AttributeData) => string = (data) => `${data.key}.mod`
): string {
  return choose(
    ATTRIBUTES.map((data) => [`${selectKey} == ${q(data.abbr)}`, modifier(data)]),
    '0'
  )
}

/** Chave de um atributo das criaturas: `fam_for`, `comp_car`. */
function creatureKey(prefix: string, data: AttributeData): string {
  return `${prefix}_${data.abbr.toLowerCase()}`
}

/** `ROUNDDOWN(x,0)` corta em direção ao zero: −0,5 vira 0, e `piso` daria −1. */
function roundDown(expression: string): string {
  return `se(${expression} < 0, teto(${expression}), piso(${expression}))`
}

/**
 * A parte da proficiência em perícias e salvaguardas, igual nas duas tabelas:
 * `((Prof.*(AN14+MIN(1,AM14)))+MAX((AM14-1),0))*AN14`. Sem a caixa marcada, nada. A primeira
 * especialização dobra a proficiência, e as seguintes somam 1 cada.
 */
const PROFICIENCY_PART = '((proficiencia * (prof + min(1, exp))) + max(exp - 1, 0)) * prof'

const EXPERTISE_HINT = 'Quantidade de especializações recebidas.'

/** Quantidade e lados do dado de pulso, usados em RUNAS e FAMILIAR. */
const PULSE_COUNT = 'piso(proficiencia / 2)'
const PULSE_SIDES = 'se(proficiencia % 2 == 0, 4, 6)'

/** Com proficiência 1 são zero dados: rola `0`, porque "0d6" a biblioteca não aceita. */
function pulseRoll(sides: string): string {
  return `{se(${PULSE_COUNT} < 1, 0, juntar(${PULSE_COUNT}, "d", ${sides}))}`
}

// ---------------------------------------------------------------------------
// Tabelas que se repetem
// ---------------------------------------------------------------------------

const NO_ROLL_RULE = { critical: { kind: 'none' as const }, criticalFailureOnOne: false }

/** Ataque: natural 20 e falha no 1. A planilha só fala de crítico nas armas. */
const ATTACK_ROLL_RULE = { critical: { kind: 'natural' as const }, criticalFailureOnOne: true }

function fixedRow(
  key: string,
  label: string,
  cells: NonNullable<TableRowTemplate['cells']> = {}
): TableRowTemplate {
  return { id: `row_${key}`, key, label, cells }
}

/** Uma linha por atributo; `atrib` é a coluna oculta que diz à fórmula em que linha está. */
function attributeRows(): TableRowTemplate[] {
  return ATTRIBUTES.map((data) => fixedRow(data.key, data.label, { atrib: data.abbr }))
}

const ATTRIBUTE_ROW_COLUMN = column('atrib', 'Atributo', 'text', 0, { hidden: true })

/** Salvaguardas de familiar e companheiro: `IF(prof=TRUE,Prof.)+modificador`. */
function creatureSavesTable(
  prefix: string,
  layout: GridPosition,
  modifier: (data: AttributeData) => string
): TableComponent {
  return table(
    `${prefix}_salvaguardas`,
    '',
    layout,
    [
      ATTRIBUTE_ROW_COLUMN,
      column('prof', 'Prof', 'checkbox', 0.45),
      column('total', 'Valor', 'computed', 0.6, {
        formula: `=${modifierOf('atrib', modifier)} + se(prof, proficiencia, 0)`,
        format: 'signed'
      }),
      column('rolar', 'Rolar', 'rollButton', 0.9, { formula: '1d20 + {total}', ...NO_ROLL_RULE })
    ],
    attributeRows(),
    { playerCanAddRows: false, showRowLabels: true }
  )
}

/** Ataque / arma, acerto e dano: a tabela do companheiro, do mecha e do servo. */
function attacksTable(prefix: string, layout: GridPosition): TableComponent {
  return table(
    `${prefix}_ataques`,
    '',
    layout,
    [
      column('arma', 'Ataque / arma', 'text', 2),
      column('acerto', 'Acerto', 'number', 0.7),
      column('dano', 'Dano', 'text', 1, {
        hint: 'Só a notação de dados, para o botão rolar: 1d6 ou 1d8 + 3.'
      }),
      column('atacar', 'Atacar', 'rollButton', 0.9, {
        formula: '1d20 + {acerto}',
        ...ATTACK_ROLL_RULE
      }),
      column('rolar_dano', 'Dano', 'rollButton', 0.85, { formula: '{dano}', ...NO_ROLL_RULE })
    ],
    [],
    { playerCanAddRows: true, showRowLabels: false }
  )
}

/** Desenvolvimento do mecha e do servo: nome, espaços e efeitos. */
function developmentBlock(prefix: string, index: number, x: number, y: number): SheetComponent[] {
  const key = `${prefix}_dev${index}`
  return [
    text(`${key}_nome`, 'Desenvolvimento', at(x, y, 4, 2)),
    number(`${key}_espacos`, 'Espaços', at(x + 4, y, 2, 2), { defaultValue: 0 }),
    textarea(`${key}_efeitos`, 'Efeitos', at(x, y + 2, 6, 3))
  ]
}

/** Vida de criatura com o máximo digitado: a barra lê o número ao lado. */
function typedLifeBar(prefix: string, layout: GridPosition): SheetComponent {
  return resource(`${prefix}_vida`, 'Vida atual', layout, `=${prefix}_vida_max`, LIFE_COLOR, {})
}

// ---------------------------------------------------------------------------
// PERSONAGEM
// ---------------------------------------------------------------------------

const HIT_DICE = ['D6', 'D8', 'D10', 'D12'].map((label, index) => [label, 6 + index * 2] as const)

const SKILLS: readonly (readonly [name: string, attribute: AttributeData['abbr']])[] = [
  ['Acrobacia', 'DEX'],
  ['Arcanismo', 'INT'],
  ['Atletismo', 'FOR'],
  ['Atuação', 'CAR'],
  ['Enganação', 'CAR'],
  ['Furtividade', 'DEX'],
  ['História', 'INT'],
  ['Intimidação', 'CAR'],
  ['Intuição', 'SAB'],
  ['Investigação', 'INT'],
  ['Lidar com Animais', 'SAB'],
  ['Medicina', 'SAB'],
  ['Natureza', 'INT'],
  ['Percepção', 'SAB'],
  ['Persuasão', 'CAR'],
  ['Prestidigitação', 'DEX'],
  ['Religião', 'SAB'],
  ['Sobrevivência', 'SAB'],
  ['Tecnologia', 'INT']
]

/**
 * PERSONAGEM!P26. A primeira classe conta o dado cheio no primeiro nível e a média + 1 nos
 * outros; as demais, só a média + 1. Com tudo em zero, dá 2 (6 + 4 × −1), como na planilha.
 */
const LIFE_TOTAL_FORMULA = (() => {
  const modifier = modifierOf('vida_atributo')
  const halved = roundDown(`(${modifier}) / 2`)
  const applied = `se(vida_metade, ${halved}, ${modifier})`
  const die = (row: string): string => `classes.${row}.dado`
  const level = (row: string): string => `classes.${row}.nivel`

  return (
    `=${die('c1')} + (${die('c1')} / 2 + 1) * (${level('c1')} - 1)` +
    ` + (${die('c2')} / 2 + 1) * ${level('c2')}` +
    ` + (${die('c3')} / 2 + 1) * ${level('c3')}` +
    ` + (${applied}) * nivel_total + pv_fixo + pv_por_nivel * nivel_total`
  )
})()

function classesTable(layout: GridPosition, firstClass: string): TableComponent {
  const row = (key: string, name: string, current: number): TableRowTemplate =>
    fixedRow(key, '', { nome: name, nivel: 0, dado: optionId('D6'), atual: current })

  return table(
    'classes',
    '',
    layout,
    [
      column('nome', 'Classe', 'text', 2),
      column('nivel', 'Lv', 'number', 0.7),
      column('dado', 'Dado', 'select', 0.9, { options: selectOptions(HIT_DICE) }),
      column('atual', 'Dados de vida', 'number', 0.9),
      column('maximo', 'Máx.', 'computed', 0.55, { formula: '=juntar("/ ", nivel)' }),
      column('rolar', 'Rolar', 'rollButton', 0.9, { formula: '1d{dado}', ...NO_ROLL_RULE })
    ],
    [row('c1', firstClass, 1), row('c2', 'Classe 2', 0), row('c3', 'Classe 3', 0)],
    { playerCanAddRows: false, showRowLabels: false }
  )
}

function skillsTable(layout: GridPosition): TableComponent {
  return table(
    'pericias',
    '',
    layout,
    [
      column('atributo', 'Atributo', 'select', 0.95, { options: selectOptions(ABBREVIATIONS) }),
      column('exp', 'Exp', 'number', 0.65, { hint: EXPERTISE_HINT }),
      column('prof', 'Prof', 'checkbox', 0.4),
      column('etc', 'Etc', 'number', 0.65, { hint: 'Bônus e Penalidades' }),
      column('total', 'Total', 'computed', 0.55, {
        formula: `=${modifierOf('atributo')} + etc + ${PROFICIENCY_PART}`,
        format: 'signed'
      }),
      column('rolar', 'Rolar', 'rollButton', 0.9, { formula: '1d20 + {total}', ...NO_ROLL_RULE })
    ],
    SKILLS.map(([name, abbr]) => fixedRow(slugifyKey(name), name, { atributo: optionId(abbr) })),
    { playerCanAddRows: false, showRowLabels: true }
  )
}

function characterTab(character: CharacterData): SheetTab {
  return {
    id: 'tab_personagem',
    label: 'Personagem',
    components: [
      heading('titulo_personagem', 'Personagem', at(0, 0, 12, 1)),
      image('retrato', 'Imagem do personagem', at(0, 1, 3, 8), { role: 'portrait', shape: 'rect' }),
      text('nome', 'Nome do personagem', at(3, 1, 5, 2), undefined, {
        role: 'name',
        defaultValue: character.name
      }),
      // PERSONAGEM!C7 e AM7, os nomes `LvlTotal` e `Prof.` da planilha.
      computed('nivel_total', 'Nível total', at(8, 1, 2, 2), '=soma(classes.nivel)'),
      computed(
        'proficiencia',
        'Proficiência',
        at(10, 1, 2, 2),
        '=teto(min(nivel_total, 20) / 4) + 1',
        {},
        'signed'
      ),
      text('origem', 'Origem', at(3, 3, 3, 2)),
      text('sub_origem', 'Sub-origem', at(6, 3, 3, 2)),
      text('passado', 'Passado', at(9, 3, 3, 2)),
      text('regiao', 'Região', at(3, 5, 3, 2)),
      number('xp', 'XP', at(6, 5, 3, 2), { min: 0, defaultValue: 0 }),
      number('inspiracao', 'Inspiração', at(9, 5, 3, 2), { min: 0, defaultValue: 0 }),
      computed('pv_total', 'Vida total', at(3, 7, 3, 2), LIFE_TOTAL_FORMULA),
      number(
        'pv_por_nivel',
        'Mod. de vida máxima: p/ nível',
        at(6, 7, 3, 2),
        { defaultValue: 0 },
        { hint: 'Modificadores de vida máxima: soma este valor por nível total.' }
      ),
      number(
        'pv_fixo',
        'Mod. de vida máxima: fixo',
        at(9, 7, 3, 2),
        { defaultValue: 0 },
        { hint: 'Modificadores de vida máxima: soma este valor uma vez só.' }
      ),

      heading('titulo_classes', 'Classes e dados de vida', at(0, 9, 12, 1)),
      classesTable(at(0, 10, 8, 4), character.firstClass),
      select('vida_atributo', 'Cálculo de vida: atributo mod.', at(8, 10, 4, 2), ABBREVIATIONS, {
        defaultLabel: 'CON'
      }),
      checkbox('vida_metade', 'Cálculo de vida', at(8, 12, 4, 2), {
        hint: 'Selecione se o modificador for dividido pela metade.'
      }),

      heading('titulo_atributos', 'Atributos', at(0, 14, 12, 1)),
      ...ATTRIBUTES.map((data, index) =>
        attribute(data.key, data.label, at(index * 2, 15, 2, 3), {
          defaultValue: 8,
          modifierFormula: MODIFIER
        })
      ),
      ...ATTRIBUTES.map((data, index) =>
        roll(
          `teste_${data.abbr.toLowerCase()}`,
          `Teste de ${data.abbr}`,
          at(index * 2, 18, 2, 2),
          `1d20 + {${data.key}.mod}`
        )
      ),

      heading('titulo_pericias', 'Perícias: proficiências & expertises', at(0, 20, 8, 1)),
      skillsTable(at(0, 21, 8, 17)),

      // PERSONAGEM!R32, V32 e Z32.
      heading('titulo_passivas', 'Perícias passivas (comuns)', at(8, 20, 4, 1)),
      computed('passiva_intuicao', 'Intuição', at(8, 21, 4, 2), '=pericias.intuicao.total + 10'),
      computed(
        'passiva_investigacao',
        'Investigação',
        at(8, 23, 4, 2),
        '=pericias.investigacao.total + 10'
      ),
      computed('passiva_percepcao', 'Percepção', at(8, 25, 4, 2), '=pericias.percepcao.total + 10'),

      heading('titulo_essencia', 'Essência, expressão e exaltação', at(8, 27, 4, 1)),
      text('essencia', 'Essência', at(8, 28, 4, 2)),
      text('expressao', 'Expressão', at(8, 30, 4, 2)),
      text('exaltacao', 'Exaltação', at(8, 32, 4, 2)),

      heading('titulo_historia', 'Traços e história', at(0, 38, 12, 1)),
      textarea('tracos', 'Traços / características importantes', at(0, 39, 6, 8)),
      textarea('historia', 'História do personagem / sobre o personagem', at(6, 39, 6, 8)),

      heading('titulo_regiao', 'Região, proficiências e idiomas', at(0, 47, 12, 1)),
      textarea('beneficios_regiao', 'Benefícios da região', at(0, 48, 6, 5)),
      textarea(
        'outras_proficiencias',
        'Outras proficiências & idiomas: armaduras / armas / etc.',
        at(6, 48, 6, 5)
      )
    ]
  }
}

// ---------------------------------------------------------------------------
// CLASSE
// ---------------------------------------------------------------------------

function classFeatureBlock(index: number, x: number, y: number): SheetComponent[] {
  const key = `caracteristica${index}`
  return [
    text(`${key}_nome`, 'Característica', at(x, y, 3, 2), '-- Nome da característica --'),
    number(`${key}_nivel`, 'Nível', at(x + 3, y, 1, 2), { defaultValue: 0 }),
    textarea(`${key}_descricao`, 'Descrição', at(x, y + 2, 4, 4)),
    text(`${key}_nota`, 'Nota', at(x, y + 6, 4, 2), '-- Nota --')
  ]
}

function classTab(): SheetTab {
  return {
    id: 'tab_classe',
    label: 'Classe',
    components: [
      heading('titulo_classe', 'Classe', at(0, 0, 12, 1)),
      text('classe_nome', 'Classe / sub-classe', at(0, 1, 6, 2)),
      number('classe_nivel', 'Nível', at(6, 1, 2, 2), { defaultValue: 0 }),

      heading('titulo_caracteristicas', 'Características', at(0, 3, 8, 1)),
      ...[0, 1, 2].flatMap((row) => [
        ...classFeatureBlock(row * 2 + 1, 0, 4 + row * 8),
        ...classFeatureBlock(row * 2 + 2, 4, 4 + row * 8)
      ]),

      heading('titulo_notas_classe', 'Notas da classe', at(8, 3, 4, 1)),
      textarea('notas_classe', '', at(8, 4, 4, 24)),

      heading('titulo_outras', 'Outras características de classe', at(0, 28, 12, 1)),
      table(
        'outras_caracteristicas',
        '',
        at(0, 29, 12, 8),
        [
          column('nome', 'Nome das características', 'text', 1.2),
          column('notas', 'Notas', 'text', 2)
        ],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      )
    ]
  }
}

// ---------------------------------------------------------------------------
// COMBATE
// ---------------------------------------------------------------------------

function weaponsTable(layout: GridPosition, weapons: readonly WeaponData[]): TableComponent {
  // A célula de acerto da planilha trazia "20 2x": margem de crítico e multiplicador. O que era
  // um texto só virou duas colunas para o botão saber o que é crítico; o dano idem, porque só
  // a notação de dados rola ("1d12 p/ 1d8 r" vira 1d12 + o resto em Tipo).
  const weapon = (data: WeaponData): TableRowTemplate => ({
    ...fixedRow(data.key, '', {
      arma: data.name,
      acerto: 0,
      margem: 20,
      mult: '2x',
      dano: data.damage,
      tipo: data.kind,
      propriedades: data.properties
    }),
    starter: true
  })

  return table(
    'armas',
    '',
    layout,
    [
      column('arma', 'Ataque / arma', 'text', 1.7),
      column('acerto', 'Acerto', 'number', 0.6),
      column('margem', 'Margem', 'number', 0.6, {
        hint: 'O d20 a partir deste número é crítico: 20, ou 19 numa arma de 19-20. Zero vale 20.'
      }),
      column('mult', 'Mult.', 'text', 0.5, { hint: 'Multiplicador de dano no crítico.' }),
      column('dano', 'Dano', 'text', 0.75, {
        hint: 'Só a notação de dados, para o botão rolar: 1d12 ou 1d8 + 3. O resto vai em Tipo.'
      }),
      column('tipo', 'Tipo', 'text', 0.8),
      column('propriedades', 'Propriedades', 'text', 2.8),
      column('atacar', 'Atacar', 'rollButton', 0.9, {
        formula: '1d20 + {acerto}',
        // Linha nova nasce com margem 0: sem o `se`, todo ataque dela seria crítico.
        critical: { kind: 'margin', threshold: 'se(margem > 0, margem, 20)' },
        criticalFailureOnOne: true
      }),
      column('rolar_dano', 'Dano', 'rollButton', 0.85, { formula: '{dano}', ...NO_ROLL_RULE })
    ],
    weapons.map(weapon),
    { playerCanAddRows: true, showRowLabels: false }
  )
}

/** COMBATE!AD18: o limite vale só se for número, como manda o comentário da célula AA21. */
const ARMOR_TOTAL_FORMULA =
  `=min(se(ehnumero(ca_limite), ca_limite, 9999), ${modifierOf('ca_atributo')})` +
  ' + ca_equip + ca_outros + ca_base'

function limitedResource(index: 1 | 2, x: number): SheetComponent[] {
  const key = `recurso${index}`
  return [
    text(`${key}_nome`, 'Recurso limitado', at(x, 19, 2, 2), undefined, { defaultValue: '???' }),
    resource(key, 'Atual', at(x + 2, 19, 2, 2), `=${key}_max`, RESOURCE_COLOR, {}),
    number(`${key}_max`, 'Máximo', at(x + 4, 19, 2, 2), { min: 0, defaultValue: 0 })
  ]
}

function combatTab(character: CharacterData): SheetTab {
  return {
    id: 'tab_combate',
    label: 'Combate',
    components: [
      heading('titulo_combate', 'Combate', at(0, 0, 12, 1)),
      figure('retrato_combate', 'Imagem do personagem', at(0, 1, 3, 8), {
        sourceFormula: '=retrato',
        fit: 'cover'
      }),

      // COMBATE!AJ8 = PERSONAGEM!P26 − X8. A vida atual é a barra: é nela que o token, o dano
      // da mesa e o combate escrevem. "Dano recebido: normal" virou a conta inversa, e
      // `followsMax` mantém a regra de AF8 (máxima − dano): se o máximo muda, o dano fica igual.
      resource(
        'vida',
        'Vida atual / máxima',
        at(3, 1, 6, 2),
        '=pv_total - dano_vida_maxima',
        LIFE_COLOR,
        { role: 'hp', followsMax: true }
      ),
      number(
        'vida_temp',
        'Vida temp.',
        at(9, 1, 3, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Reduza a vida temporária antes de adicionar dano.' }
      ),
      computed('dano_normal', 'Dano recebido: normal', at(3, 3, 3, 2), '=max(0, vida.max - vida)', {
        hint: 'Vida máxima menos vida atual. O dano se aplica na barra de vida.'
      }),
      number(
        'dano_vida_maxima',
        'Dano recebido: vida máxima',
        at(6, 3, 3, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Dano na vida máxima é aplicado automaticamente na vida atual.' }
      ),
      // A planilha não tem iniciativa, mas sem este papel o combate da mesa rola 1d20 puro.
      roll('iniciativa', 'Iniciativa', at(9, 3, 3, 2), '1d20 + {destreza.mod}', {
        role: 'initiative'
      }),

      resource('ki', 'Ki atual', at(3, 5, 3, 2), '=ki_max', KI_COLOR, { role: 'bar3' }),
      number('ki_max', 'Ki máximo', at(6, 5, 3, 2), { min: 0, defaultValue: 0 }),
      number('ki_inativo', 'Ki inativo', at(9, 5, 3, 2), { min: 0, defaultValue: 0 }),

      resource('mana', 'Mana atual', at(3, 7, 3, 2), '=mana_max', MANA_COLOR, { role: 'bar2' }),
      number('mana_max', 'Mana máxima', at(6, 7, 3, 2), { min: 0, defaultValue: 0 }),
      computed('combate_nivel', 'Nível', at(9, 7, 1, 2), '=nivel_total'),
      computed(
        'combate_proficiencia',
        'Proficiência',
        at(10, 7, 2, 2),
        '=proficiencia',
        {},
        'signed'
      ),

      heading('titulo_mods', 'Atributos', at(0, 9, 12, 1)),
      ...ATTRIBUTES.map((data, index) =>
        computed(
          `combate_${data.abbr.toLowerCase()}`,
          data.label,
          at(index * 2, 10, 2, 2),
          `=${data.key}.mod`,
          {},
          'signed'
        )
      ),

      heading('titulo_ca', 'Classe de armadura', at(0, 12, 6, 1)),
      number('ca_base', 'Base', at(0, 13, 2, 2), { defaultValue: 10 }),
      select('ca_atributo', 'Atributo', at(2, 13, 2, 2), ABBREVIATIONS, { defaultLabel: 'DEX' }),
      number('ca_equip', 'Equip.', at(4, 13, 2, 2), { defaultValue: 0 }),
      number('ca_outros', 'Outros', at(0, 15, 2, 2), { defaultValue: 0 }),
      text('ca_limite', 'Limite de att. armadura', at(2, 15, 2, 2), 'Sem limite', {
        hint: 'Deixe vazio ou com qualquer coisa que não seja um número, para remover o limitador de modificador.'
      }),
      computed('ca_total', 'CA total', at(4, 15, 2, 2), ARMOR_TOTAL_FORMULA, { role: 'defense' }),

      // COMBATE!AA25 a AA30: mesma regra das perícias, sem a coluna Etc.
      heading('titulo_salvaguardas', 'Salvaguardas', at(6, 12, 6, 1)),
      table(
        'salvaguardas',
        '',
        at(6, 13, 6, 6),
        [
          ATTRIBUTE_ROW_COLUMN,
          column('exp', 'Expert.', 'number', 0.7, { hint: EXPERTISE_HINT }),
          column('prof', 'Prof', 'checkbox', 0.45),
          column('total', 'Valor', 'computed', 0.6, {
            formula: `=${modifierOf('atrib')} + ${PROFICIENCY_PART}`,
            format: 'signed'
          }),
          column('rolar', 'Rolar', 'rollButton', 0.9, {
            formula: '1d20 + {total}',
            ...NO_ROLL_RULE
          })
        ],
        attributeRows(),
        { playerCanAddRows: false, showRowLabels: true }
      ),

      number('rd_total', 'RD total', at(0, 17, 2, 2), { defaultValue: 0 }),
      markers('morte_sucessos', 'Morte 🖤', at(2, 17, 1, 2), 3, {}),
      markers('morte_falhas', 'Morte ☠️', at(3, 17, 1, 2), 3, {}),
      roll('teste_morte', 'Teste de morte', at(4, 17, 2, 2), '1d20', ATTACK_ROLL_RULE),

      ...limitedResource(1, 0),
      ...limitedResource(2, 6),

      heading('titulo_pericias_combate', 'Perícias', at(0, 21, 12, 1)),
      ...SKILLS.map(([name], index) =>
        computed(
          `combate_${slugifyKey(name)}`,
          name,
          at((index % 6) * 2, 22 + Math.floor(index / 6) * 2, 2, 2),
          `=pericias.${slugifyKey(name)}.total`,
          {},
          'signed'
        )
      ),

      heading('titulo_armas', 'Armas / ataques', at(0, 30, 12, 1)),
      weaponsTable(at(0, 31, 12, 9), character.weapons),

      heading('titulo_notas_combate', 'Notas de combate', at(0, 40, 12, 1)),
      textarea('notas_combate', '', at(0, 41, 12, 5), undefined, {
        defaultValue: character.combatNotes
      })
    ]
  }
}

// ---------------------------------------------------------------------------
// MAGIAS
// ---------------------------------------------------------------------------

const ELEMENTS_LEFT = [
  'Sombrio (Primordial)',
  'Água (Primário)',
  'Fogo (Primário)',
  'Magma (Secundário)',
  'Tempestade (Secundário)',
  'Metal (Terciário)',
  'Cristal (Terciário)',
  'Som (Transição)',
  'Veneno (Transição)'
]

const ELEMENTS_RIGHT = [
  'Luz (Primordial)',
  'Vento (Primário)',
  'Terra (Primário)',
  'Gelo (Secundário)',
  'Flora (Secundário)',
  'Ártico (Terciário)',
  'Nevasca (Terciário)',
  'Deserto (Transição)',
  'Infernal (Transição)'
]

const CELESTIAL_MYSTERIES = ['Cronomancia', 'Espaçomancia', 'Gravitomancia', 'Runomancia']

const SPIRITUAL_MYSTERIES = [
  'Adivinhação',
  'Encantamento',
  'Étermancia',
  'Hemomancia',
  'Ilusão',
  'Invocação',
  'Necromancia',
  'Oniromancia',
  'Transmutação',
  'Umbromancia'
]

/** O custo de mana de cada círculo (MAGIAS!C31, AO31…), na ordem da planilha. */
const SPELL_CIRCLES: readonly { key: string; label: string; cost: number }[] = [
  { key: 'truques', label: 'Truques', cost: 0 },
  { key: 'c1', label: '1º círculo', cost: 2 },
  { key: 'c2', label: '2º círculo', cost: 3 },
  { key: 'c3', label: '3º círculo', cost: 5 },
  { key: 'c4', label: '4º círculo', cost: 6 },
  { key: 'c5', label: '5º círculo', cost: 7 },
  { key: 'c6', label: '6º círculo', cost: 9 },
  { key: 'c7', label: '7º círculo', cost: 12 },
  { key: 'c8', label: '8º círculo', cost: 16 },
  { key: 'c9', label: '9º círculo', cost: 21 }
]

function elementsTable(
  key: string,
  layout: GridPosition,
  names: readonly string[]
): TableComponent {
  return table(
    key,
    '',
    layout,
    [
      column('elemento', 'Elemento', 'checkbox', 0.55),
      column('misterio', 'Mistério', 'checkbox', 0.55)
    ],
    names.map((name) => fixedRow(slugifyKey(name), name)),
    { playerCanAddRows: false, showRowLabels: true }
  )
}

function mysteriesTable(
  key: string,
  layout: GridPosition,
  names: readonly string[]
): TableComponent {
  return table(
    key,
    '',
    layout,
    [column('possui', 'Possui', 'checkbox', 0.5)],
    names.map((name) => fixedRow(slugifyKey(name), name)),
    { playerCanAddRows: false, showRowLabels: true }
  )
}

function spellCircle(
  circle: (typeof SPELL_CIRCLES)[number],
  x: number,
  y: number
): SheetComponent[] {
  // A caixa ao lado da magia não tem título na planilha, e os truques não têm caixa.
  const columns: TableColumn[] = [column('nome', 'Magia', 'text', 3)]
  if (circle.key !== 'truques') {
    columns.push(column('marcada', '✓', 'checkbox', 0.35))
  }

  return [
    heading(`titulo_${circle.key}`, circle.label, at(x, y, 6, 1)),
    table(`magias_${circle.key}`, '', at(x, y + 1, 4, 7), columns, [], {
      playerCanAddRows: true,
      showRowLabels: false
    }),
    number(`custo_${circle.key}`, "Custo d'mana", at(x + 4, y + 1, 2, 2), {
      min: 0,
      defaultValue: circle.cost
    })
  ]
}

function magicTab(): SheetTab {
  return {
    id: 'tab_magias',
    label: 'Magias',
    components: [
      heading('titulo_elementos', 'Elementos / mistérios de magias elementais', at(0, 0, 8, 1)),
      elementsTable('elementos_a', at(0, 1, 4, 7), ELEMENTS_LEFT),
      elementsTable('elementos_b', at(4, 1, 4, 7), ELEMENTS_RIGHT),

      heading('titulo_celestiais', 'Mistérios de magias celestiais', at(8, 0, 4, 1)),
      mysteriesTable('misterios_celestiais', at(8, 1, 4, 4), CELESTIAL_MYSTERIES),
      heading('titulo_espirituais', 'Mistérios de magias espirituais', at(8, 5, 4, 1)),
      mysteriesTable('misterios_espirituais', at(8, 6, 4, 8), SPIRITUAL_MYSTERIES),

      // MAGIAS!U35 e U42.
      heading('titulo_conjuracao', 'Conjuração', at(0, 8, 8, 1)),
      select('magia_atributo', 'Atributo', at(0, 9, 2, 2), ABBREVIATIONS, { defaultLabel: 'INT' }),
      computed(
        'magia_cd',
        'Classe de dificuldade',
        at(2, 9, 2, 2),
        `=${modifierOf('magia_atributo')} + 8 + proficiencia`
      ),
      computed(
        'magia_acerto',
        'Acerto de magias',
        at(4, 9, 2, 2),
        `=${modifierOf('magia_atributo')} + proficiencia`,
        {},
        'signed'
      ),
      roll(
        'rolar_magia',
        'Rolar acerto',
        at(6, 9, 2, 2),
        '1d20 + {magia_acerto}',
        ATTACK_ROLL_RULE
      ),
      paragraph(
        'regra_elementos',
        '',
        '1 quadrado marcado = possui o elemento.\n2 quadrados = possui o elemento e o mistério.',
        at(0, 11, 8, 2)
      ),

      heading('titulo_roda', 'Magia elemental', at(0, 14, 12, 1)),
      figure(
        'roda_elementos',
        '',
        at(0, 15, 12, 12),
        { src: magicWheelSrc, fit: 'contain' },
        { hint: 'Roda da magia elemental: os elementos e como se combinam.' }
      ),

      ...SPELL_CIRCLES.flatMap((circle, index) =>
        // Como na planilha: pares à esquerda, ímpares à direita.
        spellCircle(circle, index % 2 === 0 ? 0 : 6, 27 + Math.floor(index / 2) * 9)
      )
    ]
  }
}

// ---------------------------------------------------------------------------
// HERANÇAS APRIM.
// ---------------------------------------------------------------------------

function inheritancesTab(): SheetTab {
  const inheritance = (index: number): SheetComponent[] => {
    const x = index % 2 === 0 ? 0 : 6
    const y = 1 + Math.floor(index / 2) * 5
    const key = `heranca${index + 1}`
    return [
      text(`${key}_nome`, 'Herança', at(x, y, 4, 2)),
      text(`${key}_tipo`, 'Tipo', at(x + 4, y, 2, 2)),
      textarea(`${key}_efeitos`, 'Efeitos', at(x, y + 2, 6, 3))
    ]
  }

  const improvement = (index: number): SheetComponent[] => {
    const x = index % 2 === 0 ? 0 : 6
    const y = 27 + Math.floor(index / 2) * 6
    const key = `aprimoramento${index + 1}`
    return [
      text(`${key}_nome`, 'Aprimoramento', at(x, y, 6, 2)),
      textarea(`${key}_efeitos`, 'Efeitos', at(x, y + 2, 6, 4))
    ]
  }

  return {
    id: 'tab_herancas',
    label: 'Heranças e Aprim.',
    components: [
      heading('titulo_herancas', 'Heranças', at(0, 0, 12, 1)),
      ...Array.from({ length: 10 }, (_unused, index) => inheritance(index)).flat(),
      heading('titulo_aprimoramentos', 'Aprimoramentos', at(0, 26, 12, 1)),
      ...Array.from({ length: 6 }, (_unused, index) => improvement(index)).flat()
    ]
  }
}

// ---------------------------------------------------------------------------
// PERTENCES
// ---------------------------------------------------------------------------

function belongingsTab(): SheetTab {
  const magicItem = (index: number): SheetComponent[] => {
    const y = 4 + index * 5
    const key = `item${index + 1}`
    return [
      text(`${key}_nome`, 'Item mágico / item especial', at(0, y, 4, 2), 'Nome'),
      checkbox(`${key}_sintonizado`, 'Sintonizado', at(4, y, 2, 2)),
      textarea(`${key}_efeito`, 'Efeito', at(0, y + 2, 6, 3))
    ]
  }

  return {
    id: 'tab_pertences',
    label: 'Pertences',
    components: [
      heading('titulo_riqueza', 'Riqueza', at(0, 0, 12, 1)),
      // PERTENCES!S7.
      computed(
        'riqueza_total',
        'Riqueza total [PO]',
        at(0, 1, 2, 2),
        '=moeda_ouro + moeda_platina * 10 + moeda_prata / 10 + moeda_cobre / 100 + moeda_electro / 2',
        {},
        'decimal'
      ),
      number('moeda_platina', 'Platina', at(2, 1, 2, 2), { min: 0, defaultValue: 0 }),
      number('moeda_ouro', 'Ouro', at(4, 1, 2, 2), { min: 0, defaultValue: 0 }),
      number('moeda_prata', 'Prata', at(6, 1, 2, 2), { min: 0, defaultValue: 0 }),
      number('moeda_cobre', 'Cobre', at(8, 1, 2, 2), { min: 0, defaultValue: 0 }),
      number('moeda_electro', 'Electro', at(10, 1, 2, 2), { min: 0, defaultValue: 0 }),

      heading('titulo_itens', 'Itens mágicos / itens especiais', at(0, 3, 6, 1)),
      ...Array.from({ length: 5 }, (_unused, index) => magicItem(index)).flat(),

      heading('titulo_inventario', 'Inventário', at(6, 3, 6, 1)),
      table(
        'inventario',
        '',
        at(6, 4, 6, 14),
        [
          column('nome', 'Nome', 'text', 3),
          column('quantidade', 'Quantidade', 'number', 0.9),
          column('peso', 'Peso', 'number', 0.8)
        ],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      ),

      heading('titulo_joias', 'Joias', at(6, 18, 6, 1)),
      table(
        'joias',
        '',
        at(6, 19, 6, 10),
        [column('nome', 'Nome / tipo', 'text', 2.5), column('valor', 'Valor [PO]', 'number', 1)],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      )
    ]
  }
}

// ---------------------------------------------------------------------------
// OFÍCIOS
// ---------------------------------------------------------------------------

/** OFÍCIOS!AB13: `IF(Z13>0,5+Z13-1,0)`. */
const CRAFT_INCOME_COLUMN = column('po_dia', 'PO/dia', 'computed', 0.6, {
  formula: '=se(nivel > 0, 5 + nivel - 1, 0)'
})

function craftsTab(character: CharacterData): SheetTab {
  return {
    id: 'tab_oficios',
    label: 'Ofícios',
    components: [
      heading('titulo_preparo', 'Modificador de preparo', at(0, 0, 12, 1)),
      number('preparo_nivel', 'Nível', at(0, 1, 2, 2), { defaultValue: 0 }),
      select('preparo_atributo', 'Atributo', at(2, 1, 3, 2), ABBREVIATIONS, {
        defaultLabel: 'INT'
      }),
      number('preparo_espec', 'Espec*', at(5, 1, 2, 2), { defaultValue: 0 }),
      // OFÍCIOS!L8.
      computed(
        'preparo_total',
        'Total',
        at(7, 1, 2, 2),
        `=piso(proficiencia / 2) + preparo_nivel + preparo_espec + ${modifierOf('preparo_atributo')}`,
        {},
        'signed'
      ),
      roll('rolar_preparo', 'Rolar preparo', at(9, 1, 3, 2), '1d20 + {preparo_total}'),

      heading('titulo_producao', 'Calculadora de produção: PO/dia', at(0, 3, 12, 1)),
      number('producao_natural', 'Natural', at(0, 4, 2, 2), { defaultValue: 0 }),
      number('producao_ajudantes', 'Ajudantes', at(2, 4, 2, 2), { defaultValue: 0 }),
      number('producao_instrucao', 'Instrução', at(4, 4, 2, 2), { defaultValue: 0 }),
      checkbox('producao_esquema', 'Esquema', at(6, 4, 2, 2)),
      number('producao_outros', 'Outros', at(8, 4, 2, 2), { defaultValue: 0 }),
      // OFÍCIOS!AE8: o SUM pula a caixa de seleção e o `+Z9` soma ela como 1.
      computed(
        'producao_total',
        'Total',
        at(10, 4, 2, 2),
        '=producao_natural + producao_ajudantes + producao_instrucao + producao_outros + producao_esquema'
      ),

      heading('titulo_maiores', 'Ofícios maiores', at(0, 6, 6, 1)),
      table(
        'oficios_maiores',
        '',
        at(0, 7, 6, 7),
        [
          column('nome', 'Ofício', 'text', 2.4),
          column('nivel', 'Nível', 'number', 0.7),
          CRAFT_INCOME_COLUMN
        ],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      ),

      heading('titulo_menores', 'Ofícios menores', at(6, 6, 6, 1)),
      table(
        'oficios_menores',
        '',
        at(6, 7, 6, 7),
        [
          column('nome', 'Ofício', 'text', 1.4),
          column('nivel', 'Nível', 'number', 0.7),
          CRAFT_INCOME_COLUMN,
          column('doutrinas', 'Doutrinas', 'text', 1.4)
        ],
        character.minorCrafts.map((craft) => ({
          ...fixedRow(craft.key, '', { nome: craft.name, nivel: 0, doutrinas: craft.doctrines }),
          starter: true
        })),
        { playerCanAddRows: true, showRowLabels: false }
      ),

      heading('titulo_formulas', 'Fórmulas conhecidas', at(0, 14, 12, 1)),
      table(
        'formulas_conhecidas',
        '',
        at(0, 15, 12, 12),
        [
          column('nome', 'Nome (fórmula)', 'text', 2.2),
          column('lvl', 'Lvl', 'number', 0.5),
          column('cd', 'CD', 'number', 0.5),
          column('oficios', 'Ofício(s)', 'text', 2),
          column('valor_po', 'Valor PO', 'number', 0.7)
        ],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      )
    ]
  }
}

// ---------------------------------------------------------------------------
// RUNAS
// ---------------------------------------------------------------------------

const MASTERY_HINT = 'Anote aqui onde foram gastas as maestrias de uma certa runa. Ex: Duração x2'

function runeBlock(index: number, x: number, y: number): SheetComponent[] {
  const key = `runa${index}`
  return [
    text(`${key}_nome`, 'Runa', at(x, y, 3, 2), 'Nome'),
    number(`${key}_usos`, 'Usos', at(x + 3, y, 1, 2), { min: 0, defaultValue: 0 }),
    number(`${key}_usos_max`, 'Máximo', at(x + 4, y, 2, 2), { min: 0, defaultValue: 0 }),
    textarea(`${key}_efeito`, 'Efeito', at(x, y + 2, 6, 4)),
    number(`${key}_maestria_qtd`, 'Maestria quantidade', at(x, y + 6, 2, 2), {
      min: 0,
      defaultValue: 0
    }),
    text(`${key}_maestrias`, 'Maestrias', at(x + 2, y + 6, 4, 2), 'Ex.: Duração x2', {
      hint: MASTERY_HINT
    })
  ]
}

function runesTab(): SheetTab {
  return {
    id: 'tab_runas',
    label: 'Runas',
    components: [
      heading('titulo_pulso', 'Dados de pulso', at(0, 0, 12, 1)),
      // RUNAS!AK9 e AO9.
      computed('pulso_base', 'Base', at(0, 1, 2, 2), '=juntar("D", proficiencia * 2)'),
      roll('rolar_pulso_base', 'Rolar base', at(2, 1, 2, 2), '1d{proficiencia * 2}'),
      computed(
        'pulso_dado',
        'Pulso',
        at(4, 1, 2, 2),
        `=juntar(${PULSE_COUNT}, "D", ${PULSE_SIDES})`
      ),
      roll('rolar_pulso', 'Rolar pulso', at(6, 1, 2, 2), pulseRoll(PULSE_SIDES)),

      // RUNAS!AL14 e AL21.
      computed(
        'runa_cd',
        'Classe de dificuldade',
        at(8, 1, 2, 2),
        '=8 + proficiencia + max(1, piso(nivel_total / 2))'
      ),
      computed(
        'runa_acerto',
        'Acerto de runas',
        at(10, 1, 2, 2),
        '=proficiencia + max(1, piso(nivel_total / 2))',
        {},
        'signed'
      ),
      roll('rolar_runa', 'Rolar acerto', at(10, 3, 2, 2), '1d20 + {runa_acerto}', ATTACK_ROLL_RULE),

      heading('titulo_pulso_runico', 'Pulso rúnico', at(0, 5, 6, 1)),
      text('pulso_nome', 'Nome', at(0, 6, 6, 2)),
      textarea('pulso_efeito', 'Efeito', at(0, 8, 6, 6)),

      heading('titulo_runas', 'Runas', at(6, 5, 6, 1)),
      ...runeBlock(1, 6, 6),
      ...runeBlock(2, 0, 14),
      ...runeBlock(3, 6, 14)
    ]
  }
}

// ---------------------------------------------------------------------------
// FAMILIAR
// ---------------------------------------------------------------------------

/** Os aprimoramentos de FAMILIAR!AF11:AK20. Na planilha, "1/4" e "1/2" viraram data. */
const FAMILIAR_LEVELS: readonly (readonly [
  armor: string,
  challenge: string,
  intelligence: number,
  features: string
])[] = [
  ['+1', '0', 7, 'ATAQUE[1], APRI.VITAL, ELO MENTAL'],
  ['-', '1/4', 8, 'SALVAGUARDA, FALA, EMANAÇÃO EN.'],
  ['+2', '1/2', 9, 'PROJEÇÃO DE ENERGIA'],
  ['-', '1', 10, 'ATAQUE[2], APRI.FÍSICO, TIER 2'],
  ['+3', '2', 11, 'APRI.MÍSTICO'],
  ['-', '3', 12, 'APRI.FÍSICO'],
  ['+4', '4', 13, 'ATAQUE[3], APRI.MÍSTICO, SALVAGUARDA'],
  ['-', '5', 14, 'MAGIA FAMILIAR, TIER 3'],
  ['+5', '6', 15, 'APRI.MÍSTICO, APRI.FÍSICO']
]

/** O `VLOOKUP(lvl,tabela,coluna,FALSE)` da planilha, lendo a tabela da própria ficha. */
function familiarLookup(columnKey: string): string {
  return choose(
    FAMILIAR_LEVELS.slice(0, -1).map((_row, index) => [
      `fam_nivel == ${index + 1}`,
      `fam_tabela.n${index + 1}.${columnKey}`
    ]),
    `fam_tabela.n${FAMILIAR_LEVELS.length}.${columnKey}`
  )
}

const PHYSICAL_GROWTH =
  'se(fam_nivel > 3, 2, 0) + se(fam_nivel > 5, 2, 0) + se(fam_nivel > 8, 2, 0)'

/**
 * Valor-base de cada atributo (FAMILIAR!R12 a Z18). A planilha valida "≥ base" nessas
 * células, então dava para digitar por cima; aqui isso é o campo Aumento, que não mata a
 * fórmula como digitar por cima matava.
 */
const FAMILIAR_BASES: Record<AttributeData['abbr'], string> = {
  FOR: `8 + ${PHYSICAL_GROWTH}`,
  DEX: `16 + ${PHYSICAL_GROWTH}`,
  CON: `11 + ${PHYSICAL_GROWTH}`,
  INT: `se(fam_nivel > 0, ${familiarLookup('int')}, 3)`,
  SAB: '14',
  CAR: '7 + se(fam_nivel > 4, 2, 0) + se(fam_nivel > 6, 2, 0) + se(fam_nivel > 8, 2, 0)'
}

const familiarMod = (data: AttributeData): string => `${creatureKey('fam', data)}_mod`
const FAMILIAR_BEST_PHYSICAL = 'max(fam_for_mod, fam_dex_mod)'

const EMANATION_RULE =
  'Quando o familiar é convocado, você deve escolher uma emanação energética entre as seguintes: ácido, elétrico, energético, gélido, ígneo, necrótico, psíquico, radiante, sombrio, trovejante ou venenoso.\n\nQuando um familiar causa dano, você pode escolher se o dano causado é o dano normal ou o tipo de dano da emanação energética.'

const ENERGY_PROJECTION_RULE =
  'O familiar é capaz de utilizar um ataque em área usando uma ação de ataque.\n\nEle pode realizar essa projeção um número de vezes igual a metade do bônus de proficiência do seu conjurador por descanso longo.\n\nO ataque tem uma área de cone de 15 pés, criaturas nessa área devem realizar uma salvaguarda de Destreza CD 8 + modificador de Conjuração do Conjurador + bônus de proficiência do Conjurador.\n\nEm uma falha, uma criatura afetada sofre 2d6 de dano igual ao tipo de dano da Emanação Energética, ou metade disso em um sucesso.\n\nUma conjuração de 6º nível tem seu dano aumentado para 4d6 e uma de 9º nível tem seu dano aumentado para 6d6.'

const ELEMENTAL_ATTACK_RUNE =
  'Ao escolher essa Runa, você deve escolher um dos elementos simples da tabela Elementos e Tipos de Dano presente no Capítulo 10. Ao ativar essa runa, seu próximo ataque causa seu dado de Pulso como dano adicional do tipo baseado no elemento escolhido.\n\nAdicionalmente, você recebe resistência a danos do tipo do elemento escolhido até o início de seu próximo turno.\n\nSinergia [Rubi]: Adicione Proficiência ao dano e metade da Proficiência ao resultado do Dado de Pulso'

/** Valor, modificador e aumento lado a lado, no lugar do bloco de atributos da planilha. */
function familiarAttribute(data: AttributeData, x: number, y: number): SheetComponent[] {
  const key = creatureKey('fam', data)
  return [
    computed(key, data.abbr, at(x, y, 1, 2), `=${FAMILIAR_BASES[data.abbr]} + ${key}_aumento`, {
      hint: data.label
    }),
    computed(`${key}_mod`, 'Mod', at(x + 1, y, 1, 2), `=piso((${key} - 10) / 2)`, {}, 'signed'),
    number(
      `${key}_aumento`,
      'Aum.',
      at(x + 2, y, 1, 2),
      { min: 0, defaultValue: 0 },
      { hint: 'Quanto este atributo está acima do valor que o nível dá.' }
    )
  ]
}

function familiarTab(): SheetTab {
  return {
    id: 'tab_familiar',
    label: 'Familiar',
    components: [
      heading('titulo_familiar', 'Familiar', at(0, 0, 12, 1)),
      image('fam_imagem', 'Imagem do familiar', at(0, 1, 3, 8), { shape: 'rect' }),
      text('fam_nome', 'Nome do familiar', at(3, 1, 4, 2)),
      // FAMILIAR!L23.
      computed('fam_nd', 'ND', at(7, 1, 1, 2), `=se(fam_nivel > 0, ${familiarLookup('nd')}, 0)`),
      number('fam_nivel', 'Lvl de conjuração', at(8, 1, 2, 2), { min: 0, max: 9, defaultValue: 0 }),
      // FAMILIAR!AF28.
      computed(
        'fam_tier',
        'Tier',
        at(10, 1, 2, 2),
        '=1 + se(fam_nivel > 3, 1, 0) + se(fam_nivel > 7, 1, 0)'
      ),

      ...ATTRIBUTES.flatMap((data, index) =>
        familiarAttribute(data, 3 + (index % 3) * 3, 3 + Math.floor(index / 3) * 2)
      ),

      // FAMILIAR!V23: a vida do familiar soma metade da vida máxima do conjurador.
      resource(
        'fam_vida',
        'Vida atual / máxima',
        at(3, 7, 5, 2),
        `=9 + fam_con_mod * fam_nivel + se(fam_nivel > 0, ${roundDown('vida.max / 2')}, 0)`,
        LIFE_COLOR,
        {}
      ),
      number('fam_vida_temp', 'Vida temp.', at(8, 7, 2, 2), { min: 0, defaultValue: 0 }),
      // FAMILIAR!AG22.
      computed('fam_ca', 'CA total', at(10, 7, 2, 2), '=10 + fam_dex_mod + teto(fam_nivel / 2)'),

      text('fam_tamanho', 'Tamanho', at(0, 9, 3, 2), undefined, { defaultValue: 'Miúdo' }),
      select('fam_tipo', 'Tipo', at(3, 9, 3, 2), ['—', 'Celestial', 'Feérico', 'Ínfero']),
      text('fam_especie', 'Espécie do familiar', at(6, 9, 3, 2)),
      // FAMILIAR!AJ41.
      computed(
        'fam_elo_mental',
        'Elo mental',
        at(9, 9, 3, 2),
        '=juntar(100 + 10 * fam_nivel, "ft")'
      ),

      heading('titulo_fam_salvaguardas', 'Salvaguardas', at(0, 11, 6, 1)),
      creatureSavesTable('fam', at(0, 12, 6, 6), familiarMod),

      // FAMILIAR!AJ8 e AJ9.
      heading('titulo_fam_pericias', 'Perícias', at(6, 11, 6, 1)),
      table(
        'fam_pericias',
        '',
        at(6, 12, 6, 3),
        [
          column('total', 'Total', 'computed', 0.6, {
            formula: '=se(atrib == "DEX", fam_dex_mod, fam_sab_mod) + proficiencia',
            format: 'signed'
          }),
          column('rolar', 'Rolar', 'rollButton', 0.9, {
            formula: '1d20 + {total}',
            ...NO_ROLL_RULE
          }),
          ATTRIBUTE_ROW_COLUMN
        ],
        [
          fixedRow('furtividade', 'Furtividade', { atrib: 'DEX' }),
          fixedRow('percepcao', 'Percepção', { atrib: 'SAB' })
        ],
        { playerCanAddRows: false, showRowLabels: true }
      ),

      heading('titulo_fam_conjuracao', 'Conjuração', at(6, 15, 6, 1)),
      number(
        'fam_mod_conjuracao',
        'Mod. conjuração',
        at(6, 16, 3, 2),
        { defaultValue: 0 },
        { hint: 'Modificador de conjuração do invocador.' }
      ),
      // FAMILIAR!AA37.
      computed(
        'fam_cd',
        'Classe de dificuldade',
        at(9, 16, 3, 2),
        '=10 + proficiencia + fam_mod_conjuracao'
      ),

      heading('titulo_fam_ataques', 'Ataques', at(0, 18, 12, 1)),
      table(
        'fam_ataques',
        '',
        at(0, 19, 12, 3),
        [
          column('arma', 'Ataque / arma', 'text', 2),
          column('dado', 'Dado', 'text', 0.6, {
            hint: 'Dano físico simples, dependendo do familiar.'
          }),
          // FAMILIAR!Z43 e AB43.
          column('acerto', 'Acerto', 'computed', 0.6, {
            formula: `=se(fam_nivel > 0, proficiencia, 0) + ${FAMILIAR_BEST_PHYSICAL}`,
            format: 'signed'
          }),
          column('dano', 'Dano', 'computed', 0.9, {
            formula: `=juntar(dado, se(${FAMILIAR_BEST_PHYSICAL} < 0, " ", " +"), ${FAMILIAR_BEST_PHYSICAL})`
          }),
          column('atacar', 'Atacar', 'rollButton', 0.9, {
            formula: '1d20 + {acerto}',
            ...ATTACK_ROLL_RULE
          }),
          column('rolar_dano', 'Dano', 'rollButton', 0.85, {
            formula: `{dado} + {${FAMILIAR_BEST_PHYSICAL}}`,
            ...NO_ROLL_RULE
          })
        ],
        [fixedRow('ataque', '', { arma: 'Ataque do familiar', dado: '1d4' })],
        { playerCanAddRows: false, showRowLabels: false }
      ),

      heading('titulo_fam_tabela', 'Aprimoramentos familiares', at(0, 22, 12, 1)),
      table(
        'fam_tabela',
        '',
        at(0, 23, 12, 9),
        [
          column('lvl', 'Lvl', 'text', 0.4),
          column('ca', 'CA', 'text', 0.4),
          column('nd', 'ND', 'text', 0.4),
          column('int', 'Int.', 'number', 0.5),
          column('caracteristicas', 'Características', 'text', 4)
        ],
        FAMILIAR_LEVELS.map(([armor, challenge, intelligence, features], index) =>
          fixedRow(`n${index + 1}`, '', {
            lvl: String(index + 1),
            ca: armor,
            nd: challenge,
            int: intelligence,
            caracteristicas: features
          })
        ),
        { playerCanAddRows: false, showRowLabels: false },
        { editableBy: 'gm' }
      ),
      paragraph('regra_emanacao', 'Emanação Energética', EMANATION_RULE, at(0, 32, 12, 3)),
      paragraph('regra_projecao', 'Projeção de Energia', ENERGY_PROJECTION_RULE, at(0, 35, 12, 5)),

      heading('titulo_fam_pulso', 'Pulso rúnico', at(0, 40, 6, 1)),
      text('fam_pulso_nome', 'Nome (escolha 1)', at(0, 41, 6, 2)),
      textarea('fam_pulso_efeito', 'Efeito', at(0, 43, 6, 4)),

      heading('titulo_fam_elo', 'Habilidades do elo familiar', at(6, 40, 6, 1)),
      text('fam_elo_nome', 'Nome', at(6, 41, 6, 2)),
      textarea('fam_habilidades', 'Habilidades', at(6, 43, 6, 4)),

      heading('titulo_fam_runa', 'Runa', at(0, 47, 6, 1)),
      text('fam_runa_nome', 'Nome', at(0, 48, 4, 2), undefined, {
        defaultValue: 'ATAQUE ELEMENTAL'
      }),
      number('fam_runa_usos', 'Atual', at(4, 48, 1, 2), { min: 0, defaultValue: 0 }),
      // FAMILIAR!P39. O `se` em volta protege a conta: "1/4" não é número, mas só aparece
      // até o nível 3, e o ND só é conferido do nível 4 para cima.
      computed(
        'fam_runa_usos_max',
        'Máximo',
        at(5, 48, 1, 2),
        `=se(fam_nivel > 3, ${PULSE_COUNT} + se(fam_nd > 4, 1, 0), 0)`
      ),
      textarea('fam_runa_efeito', 'Efeito', at(0, 50, 6, 7), undefined, {
        defaultValue: ELEMENTAL_ATTACK_RUNE
      }),
      // FAMILIAR!H44.
      computed(
        'fam_runa_dano',
        'Dano atual',
        at(0, 57, 3, 2),
        `=juntar(${PULSE_COUNT}, "D", ${PULSE_SIDES} + se(fam_nivel > 4, 2, 0))`
      ),
      roll(
        'rolar_fam_runa',
        'Rolar dano',
        at(3, 57, 3, 2),
        pulseRoll(`${PULSE_SIDES} + se(fam_nivel > 4, 2, 0)`)
      ),

      heading('titulo_fam_notas', 'Notas do familiar', at(6, 47, 6, 1)),
      textarea('fam_notas', '', at(6, 48, 6, 11))
    ]
  }
}

// ---------------------------------------------------------------------------
// COMPANHEIRO ANIMAL
// ---------------------------------------------------------------------------

/** COMPANHEIRO ANIMAL!AF11:AS22. */
const COMPANION_LEVELS: readonly (readonly [
  level: string,
  armor: string,
  intelligence: string,
  wisdom: number,
  features: string
])[] = [
  ['3', '+1', '+1', 7, 'APRI.VITAL'],
  ['4', '-', '-', 8, 'APRIM.FÍSICO'],
  ['6', '+2', '+2', 9, 'MULTI-ATAQUE 1'],
  ['8', '-', '-', 10, 'APRIM.COMBATE, DANO'],
  ['10', '+3', '+3', 11, 'APRIM.FÍSICO'],
  ['12', '-', '-', 12, 'MULTI-ATAQUE 2'],
  ['14', '+4', '+4', 13, 'APRIM.COMBATE, CRÍTICO'],
  ['16', '-', '-', 14, 'APRIM.FÍSICO'],
  ['18', '+5', '+5', 15, 'MULTI-ATAQUE 3'],
  ['19', '-', '-', 16, 'APRIM.COMBATE, DANO'],
  ['20', '+6', '+6', 18, 'APRIM.COMBATE, CRÍTICO']
]

const companionMod = (data: AttributeData): string => `${creatureKey('comp', data)}.mod`

function companionRune(index: number, x: number): SheetComponent[] {
  const key = `comp_runa${index}`
  return [
    text(`${key}_nome`, 'Runa', at(x, 49, 2, 2), 'Nome'),
    number(`${key}_usos`, 'Usos', at(x + 2, 49, 1, 2), { min: 0, defaultValue: 0 }),
    number(`${key}_usos_max`, 'Máx.', at(x + 3, 49, 1, 2), { min: 0, defaultValue: 0 }),
    textarea(`${key}_efeito`, 'Efeito', at(x, 51, 4, 6))
  ]
}

function companionTab(): SheetTab {
  return {
    id: 'tab_companheiro',
    label: 'Companheiro Animal',
    components: [
      heading('titulo_companheiro', 'Companheiro animal', at(0, 0, 12, 1)),
      image('comp_imagem', 'Imagem do companheiro', at(0, 1, 3, 8), { shape: 'rect' }),
      text('comp_nome', 'Nome do companheiro', at(3, 1, 5, 2)),
      number('comp_nd', 'ND', at(8, 1, 1, 2), { max: 1, defaultValue: 0 }),
      number('comp_nivel', "Lvl d'caçador", at(9, 1, 3, 2), { min: 0, defaultValue: 0 }),

      ...ATTRIBUTES.map((data, index) =>
        attribute(
          creatureKey('comp', data),
          data.label,
          at(3 + (index % 3) * 3, 3 + Math.floor(index / 3) * 3, 3, 3),
          { defaultValue: 10, modifierFormula: MODIFIER }
        )
      ),

      typedLifeBar('comp', at(0, 9, 5, 2)),
      number('comp_vida_max', 'Vida máxima', at(5, 9, 2, 2), { min: 0, defaultValue: 0 }),
      number('comp_vida_temp', 'Vida temp.', at(7, 9, 2, 2), { min: 0, defaultValue: 0 }),
      number('comp_ca', 'CA total', at(9, 9, 3, 2), { defaultValue: 10 }),

      // COMPANHEIRO ANIMAL!AM8 e AM9.
      heading('titulo_comp_pericias', 'Perícias', at(0, 11, 6, 1)),
      table(
        'comp_pericias',
        '',
        at(0, 12, 6, 3),
        [
          column('nome', 'Perícia', 'text', 2),
          column('atributo', 'Atributo', 'select', 1, { options: selectOptions(ABBREVIATIONS) }),
          column('total', 'Total', 'computed', 0.6, {
            formula: `=proficiencia + ${modifierOf('atributo', companionMod)}`,
            format: 'signed'
          }),
          column('rolar', 'Rolar', 'rollButton', 0.9, {
            formula: '1d20 + {total}',
            ...NO_ROLL_RULE
          })
        ],
        [
          fixedRow('p1', '', { nome: 'Perícia 1', atributo: optionId('FOR') }),
          fixedRow('p2', '', { nome: 'Perícia 2', atributo: optionId('FOR') })
        ],
        { playerCanAddRows: false, showRowLabels: false }
      ),

      heading('titulo_comp_salvaguardas', 'Salvaguardas', at(6, 11, 6, 1)),
      // A planilha tem aqui um `IF($J$35=TRUE,Prof.)` que aponta para o inventário, e por isso a
      // caixa Prof dela nunca fazia nada. Vale a fórmula do familiar, que é o que ela quis dizer.
      creatureSavesTable('comp', at(6, 12, 6, 6), companionMod),

      heading('titulo_comp_ataques', 'Ataques', at(0, 15, 6, 1)),
      attacksTable('comp', at(0, 16, 6, 9)),

      heading('titulo_comp_inventario', 'Inventário do companheiro animal', at(6, 18, 6, 1)),
      textarea('comp_inventario', '', at(6, 19, 6, 6)),

      heading('titulo_comp_tabela', 'Aprimoramentos do companheiro animal', at(0, 25, 12, 1)),
      table(
        'comp_tabela',
        '',
        at(0, 26, 12, 11),
        [
          column('lvl', 'Lvl', 'text', 0.4),
          column('ca', 'CA', 'text', 0.4),
          column('int', 'Int.', 'text', 0.4),
          column('sab', 'Sab.', 'number', 0.5),
          column('caracteristicas', 'Características', 'text', 4)
        ],
        COMPANION_LEVELS.map(([level, armor, intelligence, wisdom, features]) =>
          fixedRow(`n${level}`, '', {
            lvl: level,
            ca: armor,
            int: intelligence,
            sab: wisdom,
            caracteristicas: features
          })
        ),
        { playerCanAddRows: false, showRowLabels: false },
        { editableBy: 'gm' }
      ),

      heading('titulo_comp_notas', 'Notas do companheiro animal', at(0, 37, 6, 1)),
      textarea('comp_notas', '', at(0, 38, 6, 10)),

      heading('titulo_comp_pulso', 'Pulso rúnico', at(6, 37, 6, 1)),
      text('comp_pulso_nome', 'Nome', at(6, 38, 6, 2)),
      textarea('comp_pulso_efeito', 'Efeito', at(6, 40, 6, 8)),

      heading('titulo_comp_runas', 'Runas', at(0, 48, 12, 1)),
      ...companionRune(1, 0),
      ...companionRune(2, 4),
      ...companionRune(3, 8)
    ]
  }
}

// ---------------------------------------------------------------------------
// MECHA (TEC.)
// ---------------------------------------------------------------------------

const MECHA_HEAT: readonly (readonly [level: string, penalty: string])[] = [
  ['2', '-5 pés de deslocamento'],
  ['4', '-10 pés de deslocamento'],
  ['6', '-15 pés de deslocamento'],
  ['8', 'Desvantagem: Ataques e salvaguardas'],
  ['10', 'Seu deslocamento se torna 5 pés'],
  ['12', 'Superaquecido']
]

function mechaTab(): SheetTab {
  return {
    id: 'tab_mecha',
    label: 'Mecha (Tec.)',
    components: [
      heading('titulo_mecha', 'Mecha', at(0, 0, 12, 1)),
      image('mecha_imagem', 'Imagem do mecha', at(0, 1, 3, 7), { shape: 'rect' }),
      text('mecha_nome', 'Nome do mecha', at(3, 1, 4, 2)),
      select('mecha_tipo', 'Tipo', at(7, 1, 2, 2), ['Completo', 'Parcial']),
      select('mecha_tamanho', 'Tamanho mecha', at(9, 1, 3, 2), [
        'Pequeno',
        'Médio',
        'Grande',
        'Enorme'
      ]),

      attribute('mecha_for', 'Força', at(3, 3, 3, 3), {
        defaultValue: 10,
        modifierFormula: MODIFIER
      }),
      attribute('mecha_con', 'Constituição mecha', at(6, 3, 3, 3), {
        defaultValue: 10,
        modifierFormula: MODIFIER
      }),
      // MECHA!R18: a Destreza vem do personagem, com −2 no mecha completo.
      computed(
        'mecha_des',
        'Destreza',
        at(9, 3, 2, 2),
        '=destreza - se(mecha_tipo == "Completo", 2, 0)'
      ),
      computed(
        'mecha_des_mod',
        'Mod',
        at(11, 3, 1, 2),
        '=piso((mecha_des - 10) / 2)',
        {},
        'signed'
      ),

      number('mecha_ca', 'CA mecha', at(3, 6, 3, 2), { defaultValue: 0 }),
      number('mecha_aquecimento', 'Aquecimento (nível)', at(6, 6, 3, 2), {
        min: 0,
        defaultValue: 0
      }),
      number('mecha_suprimento', 'Suprimento (dado)', at(9, 6, 3, 2), { min: 0, defaultValue: 0 }),

      heading('titulo_mecha_combate', 'Combate e consumo de recursos', at(0, 8, 12, 1)),
      number('mecha_vida_max', 'Vida máxima', at(0, 9, 2, 2), { min: 0, defaultValue: 0 }),
      number('mecha_dano', 'Dano recebido', at(2, 9, 2, 2), { min: 0, defaultValue: 0 }),
      // MECHA!S42.
      computed('mecha_vida_atual', 'Vida atual', at(4, 9, 2, 2), '=mecha_vida_max - mecha_dano'),
      number(
        'mecha_vida_temp',
        'Vida temp.',
        at(6, 9, 2, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Reduza a vida temporária antes de adicionar dano.' }
      ),
      number('mecha_energia_max', 'Energia máx.', at(8, 9, 2, 2), { min: 0, defaultValue: 10 }),
      number(
        'mecha_energia_usada',
        'Energ. usada',
        at(10, 9, 2, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Não pode passar da energia máxima.' }
      ),
      // A planilha recusa digitar acima da energia máxima (validação de Z38). O campo daqui
      // não sabe recusar por outro campo, então avisa.
      computed(
        'mecha_energia_aviso',
        '',
        at(0, 11, 12, 1),
        `=${q('Energia usada acima da energia máxima')}`,
        { when: 'mecha_energia_usada > mecha_energia_max' }
      ),
      attacksTable('mecha', at(0, 12, 12, 6)),

      heading('titulo_mecha_aquecimento', 'Aquecimento do mecha', at(0, 18, 6, 1)),
      table(
        'mecha_aquecimento_tabela',
        '',
        at(0, 19, 6, 6),
        [column('nivel', 'Nível', 'text', 0.5), column('penalidades', 'Penalidades', 'text', 3.5)],
        MECHA_HEAT.map(([level, penalty]) =>
          fixedRow(`n${level}`, '', { nivel: level, penalidades: penalty })
        ),
        { playerCanAddRows: false, showRowLabels: false },
        { editableBy: 'gm' }
      ),

      heading('titulo_mecha_notas', 'Notas do mecha', at(6, 18, 6, 1)),
      textarea('mecha_notas', '', at(6, 19, 6, 6)),

      heading('titulo_mecha_custo', 'Custo do mecha em PO', at(0, 25, 12, 1)),
      number('mecha_custo', 'Custo total do mecha (PO)', at(0, 26, 4, 2), {
        min: 0,
        defaultValue: 0
      }),
      number('mecha_recuperacao', 'Recuperação ao atingir 0 de vida (PO)', at(4, 26, 4, 2), {
        min: 0,
        defaultValue: 0
      }),
      number('mecha_espacos_max', 'Espaços máximos para desenvolvimentos', at(8, 26, 4, 2), {
        min: 0,
        defaultValue: 0
      }),

      heading('titulo_mecha_dev', 'Desenvolvimentos', at(0, 28, 12, 1)),
      ...Array.from({ length: 8 }, (_unused, index) =>
        developmentBlock(
          'mecha',
          index + 1,
          index % 2 === 0 ? 0 : 6,
          29 + Math.floor(index / 2) * 5
        )
      ).flat()
    ]
  }
}

// ---------------------------------------------------------------------------
// SERVO (TEC.)
// ---------------------------------------------------------------------------

const SERVANT_NONE = '—'

/** SERVO!AL8: `IF(AO5>1,ROUNDUP((AO5+2)/4+IF(AO5=6,1),)+L23,"-")`. */
const SERVANT_SKILL_TOTAL =
  '=se(servo_neuron > 1, teto((servo_neuron + 2) / 4 + se(servo_neuron == 6, 1, 0)) + servo_nivel, "-")'

/** SERVO!AR24 a AR29: físicos pelo modificador; mentais, modificador + nível (ou "-"). */
const SERVANT_SAVE_TOTAL =
  '=se(atrib == "FOR", servo_for.mod, se(atrib == "DEX", servo_dex.mod, ' +
  'se(atrib == "CON", servo_con.mod, se(servo_neuron == 0, "-", ' +
  'se(atrib == "INT", servo_int_mod, se(atrib == "SAB", servo_sab_mod, servo_car_mod)) + servo_nivel))))'

/** Os mentais só existem com neuron: até lá, aparece "-", como na planilha. */
function servantMind(data: AttributeData, x: number): SheetComponent[] {
  const key = creatureKey('servo', data)
  return [
    computed(key, data.label, at(x, 6, 2, 2), '=se(servo_neuron == 0, "-", 6 + servo_neuron)'),
    computed(
      `${key}_mod`,
      'Mod',
      at(x + 2, 6, 1, 2),
      `=se(servo_neuron == 0, "-", piso((${key} - 10) / 2))`,
      {},
      'signed'
    )
  ]
}

function servantTab(): SheetTab {
  const skillRow = (key: string, skill: string): TableRowTemplate =>
    fixedRow(key, '', { pericia: optionId(skill) })

  return {
    id: 'tab_servo',
    label: 'Servo (Tec.)',
    components: [
      heading('titulo_servo', 'Servo', at(0, 0, 12, 1)),
      image('servo_imagem', 'Imagem do servo', at(0, 1, 3, 9), { shape: 'rect' }),
      text('servo_nome', 'Nome do servo', at(3, 1, 5, 2)),
      number('servo_nivel', 'Nível', at(8, 1, 2, 2), { max: 6, defaultValue: 1 }),
      number('servo_neuron', 'Nível neuron', at(10, 1, 2, 2), { min: 0, max: 6, defaultValue: 0 }),

      ...ATTRIBUTES.slice(0, 3).map((data, index) =>
        attribute(creatureKey('servo', data), data.label, at(3 + index * 3, 3, 3, 3), {
          defaultValue: 10,
          modifierFormula: MODIFIER
        })
      ),
      ...ATTRIBUTES.slice(3).flatMap((data, index) => servantMind(data, 3 + index * 3)),

      typedLifeBar('servo', at(3, 8, 4, 2)),
      number('servo_vida_max', 'Vida máxima', at(7, 8, 2, 2), { min: 0, defaultValue: 0 }),
      number('servo_vida_temp', 'Temp.', at(9, 8, 1, 2), { min: 0, defaultValue: 0 }),
      number('servo_ca', 'CA servo', at(10, 8, 2, 2), { defaultValue: 0 }),

      number('servo_energia_max', 'Energia máx.', at(0, 10, 3, 2), { min: 0, defaultValue: 0 }),
      number('servo_custo', 'Custo total do servo (PO)', at(3, 10, 3, 2), {
        min: 0,
        defaultValue: 0
      }),

      heading('titulo_servo_pericias', 'Perícias', at(0, 12, 6, 1)),
      table(
        'servo_pericias',
        '',
        at(0, 13, 6, 4),
        [
          column('pericia', 'Perícia', 'select', 2.4, {
            options: selectOptions([SERVANT_NONE, ...SKILLS.map(([name]) => name)])
          }),
          column('total', 'Total', 'computed', 0.6, {
            formula: SERVANT_SKILL_TOTAL,
            format: 'signed'
          }),
          column('rolar', 'Rolar', 'rollButton', 0.9, {
            formula: '1d20 + {se(total == "-", 0, total)}',
            ...NO_ROLL_RULE
          })
        ],
        [
          skillRow('p1', 'Lidar com Animais'),
          skillRow('p2', SERVANT_NONE),
          skillRow('p3', SERVANT_NONE)
        ],
        { playerCanAddRows: false, showRowLabels: false }
      ),

      heading('titulo_servo_salvaguardas', 'Salvaguardas', at(6, 12, 6, 1)),
      table(
        'servo_salvaguardas',
        '',
        at(6, 13, 6, 6),
        [
          ATTRIBUTE_ROW_COLUMN,
          column('total', 'Valor', 'computed', 0.6, {
            formula: SERVANT_SAVE_TOTAL,
            format: 'signed'
          }),
          column('rolar', 'Rolar', 'rollButton', 0.9, {
            formula: '1d20 + {se(total == "-", 0, total)}',
            ...NO_ROLL_RULE
          })
        ],
        attributeRows(),
        { playerCanAddRows: false, showRowLabels: true }
      ),

      heading('titulo_servo_caracteristicas', 'Características do servo', at(0, 17, 6, 1)),
      textarea('servo_caracteristicas', '', at(0, 18, 6, 5)),

      // SERVO!X39 e X40.
      heading('titulo_servo_defesas', 'Resistências e imunidades', at(6, 19, 6, 1)),
      computed(
        'servo_resistencias',
        'Resistências',
        at(6, 20, 2, 3),
        '=se(servo_neuron < 4, "", "Psíquico")'
      ),
      computed(
        'servo_imunidades',
        'Imunidades',
        at(8, 20, 4, 3),
        '=juntar("Dano necrótico", se(servo_neuron > 3, "", ", psíquico"), " e venenoso, condições Enfeitiçado e Amedrontado.")'
      ),

      heading('titulo_servo_ataques', 'Ataques', at(0, 23, 12, 1)),
      attacksTable('servo', at(0, 24, 12, 6)),

      heading('titulo_servo_dev', 'Desenvolvimentos', at(0, 30, 6, 1)),
      ...[0, 1, 2].flatMap((index) => developmentBlock('servo', index + 1, 0, 31 + index * 5)),

      heading('titulo_servo_notas', 'Notas do servo', at(6, 30, 6, 1)),
      textarea('servo_notas', '', at(6, 31, 6, 15))
    ]
  }
}

// ---------------------------------------------------------------------------
// Os modelos
// ---------------------------------------------------------------------------

function createSchema(character: CharacterData): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [
      characterTab(character),
      classTab(),
      combatTab(character),
      magicTab(),
      inheritancesTab(),
      belongingsTab(),
      craftsTab(character),
      runesTab(),
      familiarTab(),
      companionTab(),
      mechaTab(),
      servantTab()
    ]
  }
}

/** O modelo da mesa: toda ficha nasce sem personagem nenhum. */
export function createBlankSchema(): SheetSchema {
  return createSchema(NO_CHARACTER)
}

/** O mesmo modelo, nascendo com o que a planilha do Geralt trazia preenchido. */
export function createGeraltSchema(): SheetSchema {
  return createSchema(GERALT)
}

function templateFile(name: string, schema: SheetSchema): TemplateFile {
  return { format: TEMPLATE_FILE_FORMAT, fileVersion: 1, name, kind: 'character', schema }
}

/** Os arquivos no formato do botão Importar da biblioteca. */
export function createBlankTemplateFile(): TemplateFile {
  return templateFile(BLANK_TEMPLATE_NAME, createBlankSchema())
}

export function createGeraltTemplateFile(): TemplateFile {
  return templateFile(GERALT_TEMPLATE_NAME, createGeraltSchema())
}

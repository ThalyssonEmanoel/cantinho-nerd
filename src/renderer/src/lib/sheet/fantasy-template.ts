import { slugifyKey } from './keys'
import { TEMPLATE_FILE_FORMAT, type TemplateFile } from './schema'
import type {
  AttributeComponent,
  CheckboxComponent,
  ComponentBase,
  ComponentRole,
  ComputedComponent,
  EditPermission,
  GridPosition,
  HeadingComponent,
  ImageComponent,
  MarkersComponent,
  NumberComponent,
  NumberFormat,
  ResourceComponent,
  RollButtonComponent,
  SelectComponent,
  SelectOption,
  SheetComponent,
  SheetSchema,
  SheetTab,
  TableColumn,
  TableColumnKind,
  TableComponent,
  TableRowTemplate,
  TextareaComponent,
  TextComponent,
  ViewPermission
} from './types'

/**
 * Ficha padrão de fantasia (docs/FichaPadrao.md), montada só com as peças do construtor.
 *
 * O app não usa este arquivo: o teste ao lado gera dele o `docs/fichas/fantasia-padrao.json`,
 * que o mestre importa na biblioteca. Para mudar uma regra, edite aqui e rode
 * `npx vitest run fantasy-template -u` para regravar o JSON.
 *
 * O construtor não tem parágrafo nem lista que dependa de outra, então duas técnicas
 * aparecem o tempo todo:
 * - **Texto que muda com a raça ou a classe** é um campo calculado que devolve texto
 *   (`se(classe == "Mago", "…", …)`). Ele mora no modelo, então uma versão nova chega a
 *   todas as fichas — o texto das linhas fixas de tabela, ao contrário, é copiado para a
 *   ficha quando ela nasce e não muda mais.
 * - **Blocos de uma classe só** (tabela de habilidades, mecânica de magia) ficam empilhados
 *   no mesmo lugar, cada um visível só para a sua classe. Na ficha aparece um só e não sobra
 *   buraco; no construtor eles ficam uns sobre os outros. Empilhar em vez de pôr um embaixo
 *   do outro é de propósito: a grade da ficha não encolhe as linhas dos componentes ocultos.
 */

export const FANTASY_TEMPLATE_NAME = 'Fantasia — ficha padrão'

// ---------------------------------------------------------------------------
// Regras (seções 1 a 5 do documento)
// ---------------------------------------------------------------------------

type AttributeAbbr = 'FOR' | 'AGI' | 'INT' | 'ESP' | 'VIG'

interface AttributeData {
  key: string
  abbr: AttributeAbbr
  label: string
  influence: string
}

const ATTRIBUTES: readonly AttributeData[] = [
  {
    key: 'forca',
    abbr: 'FOR',
    label: 'Força',
    influence: 'ataques físicos, dano de armas pesadas e testes de força.'
  },
  {
    key: 'agilidade',
    abbr: 'AGI',
    label: 'Agilidade',
    influence: 'iniciativa, esquiva, precisão com armas ágeis e movimentação.'
  },
  {
    key: 'inteligencia',
    abbr: 'INT',
    label: 'Inteligência',
    influence: 'conhecimentos, enigmas e o poder das magias do Mago.'
  },
  {
    key: 'espirito',
    abbr: 'ESP',
    label: 'Espírito',
    influence: 'resistência mental, poder divino do Clérigo e energias sobrenaturais.'
  },
  { key: 'vigor', abbr: 'VIG', label: 'Vigor', influence: 'pontos de vida e resistência física.' }
]

/** Pontos da criação (1.3): todo atributo começa em 0 e o jogador distribui estes. */
const ATTRIBUTE_POINTS = 7
/** Teto de um atributo antes da raça; passar disso só com aval do mestre. */
const ATTRIBUTE_MAX = 5

/** Opção de lista que ainda não foi escolhida: não soma nada nas fórmulas. */
const PENDING = 'A escolher'

interface RaceData {
  label: string
  /** Quantas habilidades da classe a raça escolhe nos níveis 1, 2 e 3 (seção 2). */
  picks: readonly [number, number, number]
  /** Modificadores fixos. Os "à escolha" ficam em RACE_CHOICES. */
  modifiers: Partial<Record<AttributeAbbr, number>>
  benefit: string
  drawback: string
  attributes: string
  note?: string
}

const RACES: readonly RaceData[] = [
  {
    label: 'Humano',
    picks: [2, 1, 1],
    modifiers: {},
    benefit:
      'Adaptabilidade: 1×/combate, repete um teste de atributo que falhou e fica com o novo resultado.',
    drawback:
      'Mortalidade: sem resistência racial; não ignora condições negativas por causa da raça.',
    attributes: '+1 em um atributo à escolha (no fim da aba Atributos), até o máximo do mestre.',
    note: 'A raça mais difícil.'
  },
  {
    label: 'Elfo',
    picks: [2, 2, 2],
    modifiers: { AGI: 1, VIG: -1 },
    benefit:
      'Percepção Élfica: vantagem em percepção e para identificar magia; 1×/combate, −2 num dano mágico.',
    drawback: 'Constituição Delicada: −2 nos testes para resistir a venenos e doenças físicas.',
    attributes: '+1 em AGI e −1 em VIG.'
  },
  {
    label: 'Anão',
    picks: [4, 1, 1],
    modifiers: { VIG: 1, AGI: -1 },
    benefit:
      'Constituição Ancestral: −2 no dano de venenos; vantagem contra empurrões, quedas e deslocamentos.',
    drawback: 'Passos Curtos: move-se 1 unidade a menos por turno (mínimo 1).',
    attributes: '+1 em VIG e −1 em AGI.'
  },
  {
    label: 'Demônio',
    picks: [2, 1, 3],
    modifiers: { VIG: -1 },
    benefit:
      'Essência Infernal: 1×/combate, cura 50% do dano de um ataque seu (até 25% da vida máxima).',
    drawback:
      'Fraqueza Sagrada: +50% de dano de habilidades sagradas e penalidade contra purificação divina.',
    attributes: '+1 em FOR ou ESP (no fim da aba Atributos) e −1 em VIG.'
  },
  {
    label: 'Mutante',
    picks: [2, 3, 1],
    modifiers: { INT: -1 },
    benefit: 'Adaptação Biológica: uma mutação no início da aventura (no fim da aba Atributos).',
    drawback:
      'Instabilidade Genética: 1×/combate, abaixo de 25% da vida testa VIG (12); falhou, −2 no próximo teste.',
    attributes: '+1 em VIG ou FOR (no fim da aba Atributos) e −1 em INT.'
  },
  {
    label: 'Descendente de Anjo',
    picks: [4, 3, 2],
    modifiers: { ESP: 1, VIG: 1, FOR: -1 },
    benefit:
      'Graça Celestial: 1×/combate, recupera 2 + ESP de PV ou dá a um aliado proteção que absorve 3.',
    drawback:
      'Juramento Celestial: atacar aliado incapacitado ou ferir inocente tira a Graça até reparar.',
    attributes: '+1 em ESP e +1 em VIG, mas −1 em FOR.',
    note: 'A mais fácil para iniciantes.'
  }
]

/** Os "+1 à escolha" das raças, cada um numa lista que só aparece para a raça dele. */
const RACE_CHOICES: readonly {
  key: string
  race: string
  options: readonly AttributeAbbr[]
}[] = [
  { key: 'humano_bonus', race: 'Humano', options: ['FOR', 'AGI', 'INT', 'ESP', 'VIG'] },
  { key: 'demonio_bonus', race: 'Demônio', options: ['FOR', 'ESP'] },
  { key: 'mutante_bonus', race: 'Mutante', options: ['VIG', 'FOR'] }
]

const MUTATIONS: readonly { label: string; effect: string }[] = [
  { label: 'Garras', effect: 'Garras: ataques desarmados causam +2 de dano.' },
  { label: 'Visão noturna', effect: 'Visão noturna: enxerga em ambientes escuros.' },
  { label: 'Pele resistente', effect: 'Pele resistente: reduz em 1 o dano físico recebido.' },
  {
    label: 'Membros alongados',
    effect: 'Membros alongados: +1 unidade de alcance nos ataques corpo a corpo.'
  },
  {
    label: 'Regeneração',
    effect: 'Regeneração: recupera 1 PV ao fim de um combate vencido, se estiver vivo.'
  }
]

/** De onde vem a parte variável do valor de uma habilidade: a arma principal ou um atributo. */
type ValueSource = 'Arma' | AttributeAbbr

interface Ability {
  key: string
  name: string
  level: 1 | 2 | 3
  cost: number
  /** Número principal do efeito (dano, cura ou absorção). Zero quando não há. */
  base: number
  plus: ValueSource | ''
  effect: string
}

function ability(
  level: 1 | 2 | 3,
  cost: number,
  name: string,
  effect: string,
  base = 0,
  plus: ValueSource | '' = ''
): Ability {
  return { key: slugifyKey(name), name, level, cost, base, plus, effect }
}

interface ClassData {
  key: string
  label: string
  hp: number
  energy: number
  /** Atributo do ataque mágico; `null` para quem não usa magia. */
  magic: 'INT' | 'ESP' | null
  summary: string
  weakness: string
  abilities: readonly Ability[]
}

const CLASSES: readonly ClassData[] = [
  {
    key: 'guerreiro',
    label: 'Guerreiro',
    hp: 18,
    energy: 4,
    magic: null,
    summary:
      'Combate físico, proteção e resistência. Vida-base 18, energia-base 4. Ataque: FOR (bons: FOR e VIG).',
    weakness:
      'Especialista em combate direto: −2 no ataque contra inimigos fora do alcance da arma.',
    abilities: [
      ability(1, 1, 'Golpe Brutal', 'Ataque com a arma: dano da arma + 3.', 3, 'Arma'),
      ability(1, 1, 'Guarda de Ferro', 'Reduz em 3 o próximo dano recebido.'),
      ability(1, 1, 'Investida', 'Avança até o inimigo e ataca: dano da arma + 1.', 1, 'Arma'),
      ability(
        1,
        1,
        'Contra-ataque',
        'Depois de bloquear ou esquivar com sucesso, ataca com o dano da arma.',
        0,
        'Arma'
      ),
      ability(
        1,
        1,
        'Provocação',
        'Um inimigo que falhar em ESP (dif. 12) deve priorizar você no próximo ataque dele.'
      ),
      ability(
        2,
        3,
        'Redemoinho de Aço',
        'Atinge todos os inimigos adjacentes com o dano da arma.',
        0,
        'Arma'
      ),
      ability(2, 3, 'Determinação', 'Durante 2 turnos, não pode ser derrubado nem atordoado.'),
      ability(
        2,
        3,
        'Quebra-Defesa',
        'Dano da arma + 4 e ignora 2 pontos de defesa adicional.',
        4,
        'Arma'
      ),
      ability(
        3,
        5,
        'Último Bastião',
        'Durante 2 turnos: −5 no dano que você recebe e −2 no dano dos aliados adjacentes.'
      ),
      ability(
        3,
        5,
        'Execução',
        'Dano da arma + 8 contra um alvo com menos de 25% dos PV.',
        8,
        'Arma'
      ),
      ability(
        3,
        5,
        'Fúria de Guerra',
        'Durante 3 turnos: +3 de dano nos ataques físicos e −2 na Defesa.'
      )
    ]
  },
  {
    key: 'monge',
    label: 'Monge',
    hp: 14,
    energy: 8,
    magic: null,
    summary:
      'Mobilidade, combos e combate desarmado. Vida-base 14, energia-base 8. Ataque: AGI ou FOR.',
    weakness:
      'Disciplina corporal: sob lentidão ou imobilização, não usa habilidades que exijam deslocamento.',
    abilities: [
      ability(1, 1, 'Punho Rápido', 'Dois golpes; cada um causa 2 + FOR de dano.', 2, 'FOR'),
      ability(1, 1, 'Passo Fluido', 'Esquiva de um ataque com um teste de AGI e se reposiciona.'),
      ability(
        1,
        2,
        'Palma Atordoante',
        '2 + FOR de dano; o alvo testa VIG (dif. 12) ou perde a próxima ação principal.',
        2,
        'FOR'
      ),
      ability(1, 1, 'Concentração Interior', 'O próximo ataque desarmado causa +3 de dano.'),
      ability(
        1,
        1,
        'Varredura',
        '3 + FOR de dano; derruba o alvo se ele falhar em VIG (dif. 12).',
        3,
        'FOR'
      ),
      ability(
        2,
        3,
        'Oito Golpes Celestes',
        'Quatro golpes de 2 + FOR de dano contra o mesmo alvo.',
        2,
        'FOR'
      ),
      ability(2, 3, 'Corpo de Pedra', 'Reduz em 4 o dano físico recebido durante 2 turnos.'),
      ability(
        2,
        3,
        'Salto do Dragão',
        'Salta até um ponto visível e causa 5 + FOR de dano numa pequena área.',
        5,
        'FOR'
      ),
      ability(3, 5, 'Punho do Vazio', '8 + FOR de dano e ignora 3 pontos de defesa.', 8, 'FOR'),
      ability(
        3,
        5,
        'Dança das Sombras',
        'Até três ataques de 3 + AGI de dano; pode trocar de alvo entre os golpes.',
        3,
        'AGI'
      ),
      ability(3, 5, 'Espírito Indomável', 'Remove uma condição negativa e recupera 5 PV.', 5)
    ]
  },
  {
    key: 'clerigo',
    label: 'Clérigo',
    hp: 14,
    energy: 12,
    magic: 'ESP',
    summary: 'Cura, proteção e poder sagrado. Vida-base 14, energia-base 12. Ataque mágico: ESP.',
    weakness:
      'Dever sagrado: ferir de propósito um aliado inocente tira as habilidades sagradas (aba Magias).',
    abilities: [
      ability(1, 2, 'Toque Sagrado', 'Recupera 4 + ESP PV.', 4, 'ESP'),
      ability(1, 2, 'Luz Purificadora', '4 + ESP de dano mágico.', 4, 'ESP'),
      ability(1, 2, 'Bênção Protetora', 'Um aliado reduz em 3 o próximo dano que receber.'),
      ability(
        1,
        2,
        'Selo de Repulsão',
        '2 + ESP de dano e empurra os inimigos adjacentes.',
        2,
        'ESP'
      ),
      ability(1, 2, 'Purificação', 'Remove uma condição simples, como veneno ou queimadura.'),
      ability(
        2,
        4,
        'Círculo de Cura',
        'Recupera 4 + ESP PV dos aliados numa área pequena.',
        4,
        'ESP'
      ),
      ability(
        2,
        4,
        'Correntes Sagradas',
        'Prende por 1 turno um alvo que falhar em VIG (dif. 12).'
      ),
      ability(2, 4, 'Martelo Celestial', '7 + ESP de dano mágico.', 7, 'ESP'),
      ability(3, 6, 'Milagre Divino', 'Recupera 12 + ESP PV de um aliado.', 12, 'ESP'),
      ability(
        3,
        6,
        'Santuário',
        'Cria uma área que reduz em 4 o dano recebido pelos aliados durante 2 turnos.'
      ),
      ability(
        3,
        8,
        'Ressurreição',
        '1×/aventura: revive um aliado derrotado neste combate com 25% dos PV máximos dele.'
      )
    ]
  },
  {
    key: 'ladino',
    label: 'Ladino',
    hp: 12,
    energy: 8,
    magic: null,
    summary:
      'Furtividade, emboscadas e golpes precisos. Vida-base 12, energia-base 8. Ataque: AGI.',
    weakness:
      'Combate prolongado: errou 2 ataques seguidos no mesmo alvo, −2 no próximo contra ele.',
    abilities: [
      ability(
        1,
        1,
        'Ataque Furtivo',
        'Dano da arma + 4 se o alvo estiver distraído ou desprevenido.',
        4,
        'Arma'
      ),
      ability(1, 1, 'Passo Silencioso', 'Vantagem em um teste de furtividade.'),
      ability(
        1,
        2,
        'Adaga Envenenada',
        'O próximo ataque causa +2 de dano e mais 2 de dano no turno seguinte.'
      ),
      ability(1, 1, 'Rolamento Evasivo', 'Tenta evitar um ataque com AGI e se reposiciona.'),
      ability(
        1,
        1,
        'Truque Sujo',
        'Se o alvo falhar em VIG (dif. 12), sofre −2 no próximo ataque.'
      ),
      ability(2, 3, 'Lâminas Gêmeas', 'Dois ataques, cada um com dano da arma + 2.', 2, 'Arma'),
      ability(2, 3, 'Bomba de Fumaça', 'Cria uma área que bloqueia a visão durante 2 turnos.'),
      ability(
        2,
        3,
        'Golpe Incapacitante',
        'Dano da arma + 3 e o movimento do alvo cai pela metade por 2 turnos.',
        3,
        'Arma'
      ),
      ability(
        3,
        5,
        'Morte Silenciosa',
        'Dano da arma + 8 contra alvo desprevenido; contra alvo alerta, arma + 4.',
        8,
        'Arma'
      ),
      ability(3, 5, 'Desaparecimento', 'Fica oculto até atacar ou sofrer dano direto.'),
      ability(
        3,
        5,
        'Dança das Adagas',
        'Um ataque contra até três inimigos próximos: dano da arma + 3 por acerto.',
        3,
        'Arma'
      )
    ]
  },
  {
    key: 'arqueiro',
    label: 'Arqueiro',
    hp: 12,
    energy: 8,
    magic: null,
    summary:
      'Dano à distância, precisão e controle de área. Vida-base 12, energia-base 8. Ataque: AGI.',
    weakness: 'Pressão próxima: −2 nos ataques com arco contra inimigos adjacentes.',
    abilities: [
      ability(1, 1, 'Tiro Preciso', 'Disparo com dano da arma + 3.', 3, 'Arma'),
      ability(
        1,
        1,
        'Flecha Rasteira',
        'Dano da arma e o movimento do alvo cai pela metade por 1 turno.',
        0,
        'Arma'
      ),
      ability(1, 1, 'Recuo Tático', 'Recua e dispara uma flecha com o dano da arma.', 0, 'Arma'),
      ability(
        1,
        2,
        'Armadilha de Caçador',
        'Prende o primeiro inimigo que atravessar a área, se ele falhar em AGI (dif. 12).'
      ),
      ability(1, 1, 'Mira Firme', 'Prepara o próximo disparo, que causa +3 de dano.'),
      ability(
        2,
        3,
        'Chuva de Flechas',
        'Dano da arma a todos os inimigos numa área pequena.',
        0,
        'Arma'
      ),
      ability(
        2,
        3,
        'Flecha Perfurante',
        'Dano da arma + 3; pode atingir um segundo inimigo alinhado.',
        3,
        'Arma'
      ),
      ability(
        2,
        3,
        'Olho do Predador',
        'Marca um inimigo: +2 nos ataques contra ele durante 2 turnos.'
      ),
      ability(
        3,
        5,
        'Flecha Devastadora',
        'Dano da arma + 8 e ignora 2 pontos de defesa.',
        8,
        'Arma'
      ),
      ability(
        3,
        5,
        'Tempestade Celeste',
        'Dano da arma + 2 a todos os inimigos numa grande área.',
        2,
        'Arma'
      ),
      ability(
        3,
        5,
        'Caçada Implacável',
        'Durante 3 turnos, cada acerto no alvo marcado dá +2 de dano ao próximo (até +6).'
      )
    ]
  },
  {
    key: 'descendente_de_sata',
    label: 'Descendente de Satã',
    hp: 14,
    energy: 14,
    magic: 'ESP',
    summary:
      'Suporte sombrio: maldições, drenagem e sacrifícios. Vida-base 14, energia-base 14. Atributo: ESP.',
    weakness:
      'Pacto de Sangue: cura nunca é de graça e o PV sacrificado não é reduzido (aba Magias).',
    abilities: [
      ability(
        1,
        3,
        'Drenagem Profana',
        '4 + ESP de dano mágico; recupera metade do dano causado (para baixo). Alcance médio.',
        4,
        'ESP'
      ),
      ability(
        1,
        2,
        'Maldição da Fraqueza',
        'O alvo sofre −2 no dano dos ataques durante 2 turnos. Resiste com ESP (dif. 12).'
      ),
      ability(
        1,
        2,
        'Sacrifício Vital',
        'Custa também 3 PV: um aliado ganha escudo que absorve até 6 de dano. Alcance curto.',
        6
      ),
      ability(
        1,
        2,
        'Explosão Infernal',
        '3 + ESP de dano mágico a todos os inimigos adjacentes.',
        3,
        'ESP'
      ),
      ability(
        1,
        2,
        'Transferência de Agonia',
        'Tira uma condição simples (não permanente) de um aliado; você sofre 3 de dano verdadeiro.'
      ),
      ability(
        2,
        4,
        'Correntes do Inferno',
        'Prende um inimigo por 1 turno se ele falhar em VIG (dif. 12).'
      ),
      ability(2, 3, 'Pacto de Vitalidade', 'Perde 5 PV para recuperar 10 PV de um aliado.', 10),
      ability(
        2,
        4,
        'Marca da Condenação',
        'Marca um inimigo por 3 turnos: no 1º dano de cada turno, ele sofre +2 de dano sombrio.'
      ),
      ability(
        3,
        6,
        'Banquete das Almas',
        '8 + ESP de dano mágico; recupera metade do dano causado (para baixo).',
        8,
        'ESP'
      ),
      ability(
        3,
        7,
        'Domínio Profano',
        'Área sombria por 2 turnos: inimigos −2 nos ataques; aliados −3 no 1º dano de cada turno.'
      ),
      ability(
        3,
        6,
        'Avatar da Ruína',
        'Custa também 25% dos PV atuais: forma infernal por 3 turnos, +3 de dano mágico.'
      )
    ]
  },
  {
    key: 'mago',
    label: 'Mago',
    hp: 10,
    energy: 16,
    magic: 'INT',
    summary:
      'Elementos, controle de área e combinações arcanas. Vida-base 10, energia-base 16. Magia: INT.',
    weakness:
      'Fragilidade arcana: atingido ao preparar magia, testa INT (12) ou perde a preparação (aba Magias).',
    abilities: [
      ability(1, 2, 'Projétil Arcano', '4 + INT de dano mágico.', 4, 'INT'),
      ability(1, 2, 'Chama Viva', '3 + INT de dano e 2 de queimadura no turno seguinte.', 3, 'INT'),
      ability(1, 2, 'Barreira Mística', 'Absorve 4 + INT de dano.', 4, 'INT'),
      ability(
        1,
        2,
        'Rajada Gélida',
        '3 + INT de dano e o movimento do alvo cai pela metade por 1 turno.',
        3,
        'INT'
      ),
      ability(1, 2, 'Passo Arcano', 'Teletransporta-se por uma curta distância visível.'),
      ability(
        2,
        4,
        'Raio Encadeado',
        '5 + INT no primeiro alvo e 3 + INT em até dois alvos próximos.',
        5,
        'INT'
      ),
      ability(
        2,
        4,
        'Prisão de Cristal',
        'Imobiliza um alvo por 1 turno se ele falhar em VIG (dif. 12).'
      ),
      ability(2, 4, 'Meteoro Menor', '6 + INT de dano numa pequena área.', 6, 'INT'),
      ability(
        3,
        7,
        'Singularidade Arcana',
        'Puxa os inimigos próximos para um ponto central e causa 5 + INT de dano.',
        5,
        'INT'
      ),
      ability(
        3,
        8,
        'Tempestade Elemental',
        '8 + INT de dano numa grande área e aplica o efeito elemental escolhido antes.',
        8,
        'INT'
      ),
      ability(
        3,
        7,
        'Dobra da Realidade',
        'Reposiciona um alvo num ponto visível; um inimigo resiste com VIG (dif. 15).'
      )
    ]
  },
  {
    key: 'feiticeiro',
    label: 'Feiticeiro',
    hp: 12,
    energy: 14,
    magic: 'ESP',
    summary:
      'Magia inata, corrupção e explosões. Vida-base 12, energia-base 14. Atributo mágico: ESP.',
    weakness:
      'Instabilidade: toda habilidade de nível 3 pede teste de controle, 1d20 + ESP contra 12 (aba Magias).',
    abilities: [
      ability(1, 2, 'Orbe Caótico', '4 + ESP de dano mágico.', 4, 'ESP'),
      ability(
        1,
        2,
        'Maldição Enfraquecedora',
        'Reduz em 2 o dano causado pelo alvo durante 2 turnos.'
      ),
      ability(
        1,
        3,
        'Drenagem Vital',
        '3 + ESP de dano; recupera metade do dano causado (para baixo).',
        3,
        'ESP'
      ),
      ability(1, 2, 'Explosão Sombria', '3 + ESP de dano aos inimigos adjacentes.', 3, 'ESP'),
      ability(
        1,
        2,
        'Sobrecarga Mágica',
        'A próxima habilidade ofensiva causa +3 de dano; −2 na Defesa até o seu próximo turno.'
      ),
      ability(
        2,
        4,
        'Corrupção Arcana',
        '3 + ESP de dano agora e mais 3 de dano no turno seguinte.',
        3,
        'ESP'
      ),
      ability(2, 4, 'Mãos do Abismo', 'Prende um alvo por 1 turno se ele falhar em VIG (dif. 12).'),
      ability(
        2,
        3,
        'Transfusão de Poder',
        'Perde 3 PV: a próxima habilidade ofensiva ganha +5 de dano. Proibida com 3 PV ou menos.'
      ),
      ability(3, 7, 'Forma Abissal', 'Durante 3 turnos: +3 de dano mágico e −2 no dano recebido.'),
      ability(
        3,
        8,
        'Ruína Caótica',
        '8 + ESP numa grande área; escolha +2 de dano ou alcance maior. Controle com +2 de dif.',
        8,
        'ESP'
      ),
      ability(
        3,
        0,
        'Pacto da Última Chama',
        'Perde 25% dos PV atuais: 12 + ESP de dano mágico. Controle dif. 15; falhou, incapacitado.',
        12,
        'ESP'
      )
    ]
  }
]

// ---------------------------------------------------------------------------
// Fórmulas
// ---------------------------------------------------------------------------

/** Texto entre aspas para a fórmula. A linguagem não tem como escapar aspas dentro dele. */
function q(text: string): string {
  if (text.includes('"')) throw new Error(`Texto de fórmula com aspas: ${text}`)
  return `"${text}"`
}

type Branch = readonly [condition: string, value: string]

/** `se(a, x, se(b, y, z))`: o primeiro ramo verdadeiro ganha. */
function choose(branches: readonly Branch[], fallback: string): string {
  return branches.reduceRight<string>(
    (rest, [condition, value]) => `se(${condition}, ${value}, ${rest})`,
    fallback
  )
}

const isClass = (label: string): string => `classe == ${q(label)}`
const isRace = (label: string): string => `raca == ${q(label)}`

function byClass(value: (data: ClassData) => string, fallback: string): string {
  return `=${choose(
    CLASSES.map((data) => [isClass(data.label), value(data)]),
    fallback
  )}`
}

function byRace(value: (data: RaceData) => string, fallback: string): string {
  return `=${choose(
    RACES.map((data) => [isRace(data.label), value(data)]),
    fallback
  )}`
}

const MAGIC_CLASSES = CLASSES.filter((data) => data.magic !== null)
const IS_MAGIC = MAGIC_CLASSES.map((data) => isClass(data.label)).join(' ou ')
const IS_NOT_MAGIC = CLASSES.filter((data) => data.magic === null)
  .map((data) => isClass(data.label))
  .join(' ou ')

/** Valor final de um atributo escolhido numa lista com as siglas (FOR, AGI…). */
function attributeBySelect(selectKey: string): string {
  return choose(
    ATTRIBUTES.map((attribute) => [`${selectKey} == ${q(attribute.abbr)}`, `${attribute.key}.mod`]),
    '0'
  )
}

/** Modificador racial de um atributo: o fixo da raça mais os "+1 à escolha". */
function racialModifierFormula(abbr: AttributeAbbr): string {
  const parts: string[] = []

  const fixed = RACES.filter((race) => race.modifiers[abbr] !== undefined)
  if (fixed.length > 0) {
    parts.push(
      choose(
        fixed.map((race) => [isRace(race.label), String(race.modifiers[abbr])]),
        '0'
      )
    )
  }

  for (const choice of RACE_CHOICES) {
    if (!choice.options.includes(abbr)) continue
    parts.push(`se(${isRace(choice.race)} e ${choice.key} == ${q(abbr)}, 1, 0)`)
  }

  return `=${parts.length === 0 ? '0' : parts.join(' + ')}`
}

function picksText(race: RaceData): string {
  const [first, second, third] = race.picks
  const total = first + second + third
  const text = `Escolhe ${first} de nível 1, ${second} de nível 2 e ${third} de nível 3 (total ${total}).`
  return race.note === undefined ? text : `${text} ${race.note}`
}

const STATE_FORMULA = `=${choose(
  [
    ['vida <= 0', q('Incapacitado: o mestre decide o que acontece')],
    ['vida < vida.max / 4', q('Gravemente ferido (abaixo de 25%)')]
  ],
  q('De pé')
)}`

/**
 * Valor de uma habilidade: a base mais a arma principal ou o atributo final. O ajuste
 * temporário de dano físico entra só no que vem da arma, da FOR ou da AGI; cura e magia
 * ficam de fora.
 */
const ABILITY_VALUE_FORMULA = `=se(base == 0 e atrib == "", "—", base + ${choose(
  [
    ['atrib == "Arma"', 'arma1_dano'],
    ...ATTRIBUTES.map((attribute): Branch => [
      `atrib == ${q(attribute.abbr)}`,
      `${attribute.key}.mod`
    ])
  ],
  '0'
)} + se(atrib == "Arma" ou atrib == "FOR" ou atrib == "AGI", dano_fisico_ajuste, 0))`

/**
 * Situação de cada habilidade (seção 6: disponíveis, escolhidas e bloqueadas). Não consulta
 * os limites da raça: os contadores dependem desta mesma tabela, e a validação veria isso
 * como dependência circular — o aviso de limite fica nos contadores, em cima.
 */
const ABILITY_SITUATION_FORMULA =
  '=se(nv > nivel, se(esc, "Acima do nível", "Bloqueada"), ' +
  'se(esc, se(pe > energia, "Sem PE", "Escolhida"), "Disponível"))'

function levelLimitFormula(level: 1 | 2 | 3): string {
  return byRace((race) => String(race.picks[level - 1]), '0')
}

function chosenCountFormula(level: 1 | 2 | 3): string {
  return byClass((data) => `soma(hab_${data.key}.c${level})`, '0')
}

// ---------------------------------------------------------------------------
// Peças do construtor
// ---------------------------------------------------------------------------

interface Options {
  hint?: string
  editableBy?: EditPermission
  visibleTo?: ViewPermission
  when?: string
  role?: ComponentRole
  accent?: string
}

const WARNING_COLOR = '#f59e0b'
const GM_EDITS: Options = { editableBy: 'gm' }

function at(x: number, y: number, w: number, h: number): GridPosition {
  return { x, y, w, h }
}

function base(key: string, label: string, layout: GridPosition, options: Options): ComponentBase {
  const component: ComponentBase = {
    id: `c_${key}`,
    key,
    label,
    editableBy: options.editableBy ?? 'player',
    visibleTo: options.visibleTo ?? 'all',
    layout
  }
  if (options.hint !== undefined) component.hint = options.hint
  if (options.when !== undefined) component.visibleWhen = options.when
  if (options.role !== undefined) component.role = options.role
  if (options.accent !== undefined) component.accent = options.accent
  return component
}

type OptionSpec = string | readonly [label: string, value: number]

function selectOptions(specs: readonly OptionSpec[]): SelectOption[] {
  return specs.map((spec) => {
    const [label, value] = typeof spec === 'string' ? [spec, undefined] : spec
    const option: SelectOption = { id: `o_${slugifyKey(label)}`, label }
    if (value !== undefined) option.value = value
    return option
  })
}

function heading(
  key: string,
  text: string,
  layout: GridPosition,
  options: Options = {}
): HeadingComponent {
  return {
    ...base(key, text, layout, { editableBy: 'gm', ...options }),
    type: 'heading',
    text,
    level: 'section'
  }
}

function text(
  key: string,
  label: string,
  layout: GridPosition,
  placeholder?: string,
  options: Options = {}
): TextComponent {
  const component: TextComponent = { ...base(key, label, layout, options), type: 'text' }
  if (placeholder !== undefined) component.placeholder = placeholder
  return component
}

function textarea(
  key: string,
  label: string,
  layout: GridPosition,
  placeholder?: string,
  options: Options = {}
): TextareaComponent {
  const component: TextareaComponent = { ...base(key, label, layout, options), type: 'textarea' }
  if (placeholder !== undefined) component.placeholder = placeholder
  return component
}

function number(
  key: string,
  label: string,
  layout: GridPosition,
  limits: { min?: number; max?: number; defaultValue: number },
  options: Options = {}
): NumberComponent {
  return { ...base(key, label, layout, options), type: 'number', ...limits }
}

function checkbox(
  key: string,
  label: string,
  layout: GridPosition,
  options: Options = {}
): CheckboxComponent {
  return { ...base(key, label, layout, options), type: 'checkbox', defaultValue: false }
}

function select(
  key: string,
  label: string,
  layout: GridPosition,
  specs: readonly OptionSpec[],
  options: Options = {}
): SelectComponent {
  return { ...base(key, label, layout, options), type: 'select', options: selectOptions(specs) }
}

function image(key: string, label: string, layout: GridPosition, options: Options): ImageComponent {
  return { ...base(key, label, layout, options), type: 'image', shape: 'circle' }
}

function attribute(
  data: AttributeData,
  layout: GridPosition,
  modifierFormula: string
): AttributeComponent {
  return {
    ...base(data.key, `${data.label} (${data.abbr})`, layout, {
      hint: 'Em cima, os pontos distribuídos. Embaixo, o modificador (pontos + raça − 1: 0 dá −1, 2 dá +1): é ele que entra nas rolagens.'
    }),
    type: 'attribute',
    // Começa em 0 e vai até 5 antes da raça (1.3). O campo não trava o que se digita: o
    // mestre pode passar disso, e a aba avisa.
    min: 0,
    max: ATTRIBUTE_MAX,
    defaultValue: 0,
    modifierFormula
  }
}

function resource(
  key: string,
  label: string,
  layout: GridPosition,
  maxFormula: string,
  color: string,
  options: Options
): ResourceComponent {
  return {
    ...base(key, label, layout, options),
    type: 'resource',
    maxFormula,
    color,
    showButtons: true
  }
}

function markers(
  key: string,
  label: string,
  layout: GridPosition,
  count: number,
  options: Options
): MarkersComponent {
  return { ...base(key, label, layout, options), type: 'markers', count }
}

function computed(
  key: string,
  label: string,
  layout: GridPosition,
  formula: string,
  options: Options = {},
  format: NumberFormat = 'integer'
): ComputedComponent {
  return {
    ...base(key, label, layout, { editableBy: 'gm', ...options }),
    type: 'computed',
    formula,
    format
  }
}

/**
 * Linha de regra: campo calculado sem rótulo que devolve um texto fixo. É o único jeito de
 * ter texto corrido legível na ficha (o título corta numa linha só e em letras miúdas).
 */
function rule(key: string, y: number, ruleText: string, when?: string): ComputedComponent {
  return computed(key, '', at(0, y, 12, 1), `=${q(ruleText)}`, when === undefined ? {} : { when })
}

function rules(
  prefix: string,
  startY: number,
  texts: readonly string[],
  when?: string
): ComputedComponent[] {
  return texts.map((ruleText, index) =>
    rule(`${prefix}_${index + 1}`, startY + index, ruleText, when)
  )
}

function roll(
  key: string,
  label: string,
  layout: GridPosition,
  formula: string,
  options: Options = {}
): RollButtonComponent {
  return {
    ...base(key, label, layout, options),
    type: 'rollButton',
    formula,
    // As regras não falam de crítico: marcar 20 natural faria parecer que existe um.
    critical: { kind: 'none' },
    criticalFailureOnOne: false
  }
}

function table(
  key: string,
  label: string,
  layout: GridPosition,
  columns: TableColumn[],
  rows: TableRowTemplate[],
  shape: { playerCanAddRows: boolean; showRowLabels: boolean },
  options: Options = {}
): TableComponent {
  return { ...base(key, label, layout, options), type: 'table', columns, rows, ...shape }
}

function column(
  key: string,
  label: string,
  kind: TableColumnKind,
  width: number,
  extra: Partial<TableColumn> = {}
): TableColumn {
  return { id: `col_${key}`, key, label, kind, width, ...extra }
}

/**
 * Coluna calculada de largura zero: na tabela ela some (o texto dela é cortado em nada), e
 * serve para os contadores somarem com `soma(tabela.coluna)`. A linguagem não tem soma
 * condicional, então "quantas de nível 2 estão marcadas" precisa de uma coluna de 0 e 1.
 */
function hiddenColumn(key: string, formula: string): TableColumn {
  return column(key, `${key} (oculta)`, 'computed', 0, { formula })
}

// ---------------------------------------------------------------------------
// Abas (seção 7)
// ---------------------------------------------------------------------------

function summaryTab(): SheetTab {
  return {
    id: 'tab_resumo',
    label: 'Resumo',
    components: [
      heading('titulo_identificacao', 'Identificação', at(0, 0, 12, 1)),
      image('retrato', 'Retrato', at(0, 1, 2, 6), { role: 'portrait' }),
      text('nome', 'Nome do personagem', at(2, 1, 4, 2), 'Nome do personagem', { role: 'name' }),
      text('jogador', 'Jogador', at(6, 1, 3, 2), 'Quem joga'),
      number(
        'nivel',
        'Nível',
        at(9, 1, 3, 2),
        { min: 1, max: 3, defaultValue: 1 },
        { ...GM_EDITS, hint: 'Do 1 ao 3. Quem sobe o nível é o mestre (aba Progressão).' }
      ),
      select(
        'raca',
        'Raça',
        at(2, 3, 4, 2),
        RACES.map((race) => race.label)
      ),
      select(
        'classe',
        'Classe',
        at(6, 3, 3, 2),
        CLASSES.map((data) => data.label)
      ),
      computed(
        'deslocamento',
        'Deslocamento',
        at(9, 3, 3, 2),
        `=max(1, deslocamento_base - se(${isRace('Anão')}, 1, 0) + soma(itens_magicos.desl_ativo))`,
        { hint: 'Unidades (quadrados) por turno. Anão: −1, nunca abaixo de 1.' }
      ),
      resource(
        'vida',
        'Vida (PV)',
        at(2, 5, 5, 2),
        '=pv_base_classe + vigor.mod * 3 + bonus_racial_pv + pv_nivel + pv_itens',
        '#ef4444',
        { role: 'hp', hint: 'Vida-base da classe + VIG × 3 + bônus racial + nível + itens.' }
      ),
      resource(
        'energia',
        'Energia (PE)',
        at(7, 5, 5, 2),
        '=pe_base_classe + espirito.mod * 2 + bonus_racial_pe + pe_nivel + pe_itens',
        '#3b82f6',
        { role: 'bar2', hint: 'Energia-base da classe + ESP × 2 + bônus racial + nível + itens.' }
      ),
      computed(
        'defesa',
        'Defesa',
        at(0, 7, 2, 2),
        '=10 + agilidade.mod + armadura_bonus + escudo_bonus + defesa_ajuste',
        { role: 'defense', hint: '10 + AGI + armadura + escudo + ajuste temporário.' }
      ),
      roll('iniciativa', 'Iniciativa', at(2, 7, 2, 2), '1d20 + {agilidade.mod}', {
        role: 'initiative'
      }),
      computed('estado', 'Estado', at(4, 7, 4, 2), STATE_FORMULA),
      computed(
        'recursos_aviso',
        'Atenção',
        at(8, 7, 4, 2),
        `=${q('PV ou PE acima do máximo: ajuste na barra')}`,
        { when: 'vida > vida.max ou energia > energia.max', accent: WARNING_COLOR }
      ),

      heading('titulo_raca', 'Raça', at(0, 9, 12, 1)),
      computed(
        'raca_beneficio',
        'Benefício',
        at(0, 10, 12, 2),
        byRace((race) => q(race.benefit), q(''))
      ),
      computed(
        'raca_maleficio',
        'Malefício',
        at(0, 12, 12, 2),
        byRace((race) => q(race.drawback), q(''))
      ),
      computed(
        'raca_atributos',
        'Atributos raciais',
        at(0, 14, 12, 2),
        byRace((race) => q(race.attributes), q(''))
      ),
      computed(
        'raca_escolhas',
        'Habilidades de classe por nível',
        at(0, 16, 12, 2),
        byRace((race) => q(picksText(race)), q(''))
      ),

      heading('titulo_classe', 'Classe', at(0, 18, 12, 1)),
      computed(
        'classe_resumo',
        'Função',
        at(0, 19, 12, 2),
        byClass((data) => q(data.summary), q(''))
      ),
      computed(
        'classe_fraqueza',
        'Fraqueza',
        at(0, 21, 12, 2),
        byClass((data) => q(data.weakness), q(''))
      ),
      // Por último: para as outras raças ele some sem deixar buraco no meio da aba.
      computed(
        'mutacao_efeito',
        'Mutação',
        at(0, 23, 12, 2),
        `=${choose(
          MUTATIONS.map((mutation) => [`mutacao == ${q(mutation.label)}`, q(mutation.effect)]),
          q('Escolha a mutação no fim da aba Atributos.')
        )}`,
        { when: isRace('Mutante') }
      )
    ]
  }
}

function attributesTab(): SheetTab {
  const pendingChoices: Branch[] = RACE_CHOICES.map((choice) => [
    `${isRace(choice.race)} e ${choice.key} == ${q(PENDING)}`,
    q(`Escolha o +1 do ${choice.race} no fim desta aba`)
  ])

  const warning = choose(
    [
      [
        'pontos_livres < 0',
        q(`Pontos demais: são ${ATTRIBUTE_POINTS} para distribuir, antes da raça`)
      ],
      ['pontos_livres > 0', q('Ainda há pontos para distribuir')],
      [
        ATTRIBUTES.map((data) => `${data.key} > ${ATTRIBUTE_MAX}`).join(' ou '),
        q(`Atributo acima de ${ATTRIBUTE_MAX} antes da raça: só com aval do mestre`)
      ],
      [
        ATTRIBUTES.map((data) => `${data.key} < 0`).join(' ou '),
        q('Atributo negativo: os pontos começam em 0')
      ],
      ...pendingChoices,
      [`${isRace('Mutante')} e mutacao == ${q(PENDING)}`, q('Escolha a mutação no fim desta aba')]
    ],
    q('Distribuição certa')
  )

  return {
    id: 'tab_atributos',
    label: 'Atributos',
    components: [
      heading('titulo_atributos', 'Atributos', at(0, 0, 12, 1)),
      rule(
        'regra_atributos',
        1,
        `Comece com 0 em tudo e distribua ${ATTRIBUTE_POINTS} pontos (máx. ${ATTRIBUTE_MAX} antes da raça). Modificador = valor + raça − 1.`
      ),
      // O modificador (`forca.mod`) é o que entra em todas as fórmulas da ficha: rolagens,
      // PV, PE, Defesa e valor das habilidades. Com a raça, INT 0 do Mutante vira −1 e o
      // modificador, −2.
      ...ATTRIBUTES.map((data, index) =>
        attribute(data, at(index * 2, 2, 2, 3), `=valor + raca_${data.abbr.toLowerCase()} - 1`)
      ),
      computed(
        'pontos_livres',
        'Pontos a distribuir',
        at(10, 2, 2, 3),
        `=${ATTRIBUTE_POINTS} - (${ATTRIBUTES.map((data) => data.key).join(' + ')})`,
        { hint: `${ATTRIBUTE_POINTS} pontos, antes da raça. A raça soma ou tira depois.` }
      ),
      ...ATTRIBUTES.map((data, index) =>
        computed(
          `raca_${data.abbr.toLowerCase()}`,
          `Raça (${data.abbr})`,
          at(index * 2, 5, 2, 2),
          racialModifierFormula(data.abbr),
          {},
          'signed'
        )
      ),
      number(
        'teste_ajuste',
        'Ajuste nos testes',
        at(10, 5, 2, 2),
        { defaultValue: 0 },
        { hint: 'Temporário. Ex.: −2 do Truque Sujo ou da Instabilidade Genética.' }
      ),
      computed('atributos_aviso', 'Distribuição', at(0, 7, 12, 2), `=${warning}`),

      heading('titulo_testes', 'Testes de atributo', at(0, 9, 12, 1)),
      ...ATTRIBUTES.map((data, index) =>
        roll(
          `teste_${data.abbr.toLowerCase()}`,
          `Teste de ${data.abbr}`,
          at(index * 2, 10, 2, 2),
          `1d20 + {${data.key}.mod} + {teste_ajuste}`
        )
      ),
      ...ATTRIBUTES.map((data, index) =>
        roll(
          `vantagem_${data.abbr.toLowerCase()}`,
          `${data.abbr} com vantagem`,
          at(index * 2, 12, 2, 2),
          `2d20kh1 + {${data.key}.mod} + {teste_ajuste}`
        )
      ),

      heading('titulo_influencia', 'O que cada atributo faz', at(0, 14, 12, 1)),
      ...ATTRIBUTES.map((data, index) =>
        rule(
          `regra_${data.abbr.toLowerCase()}`,
          15 + index,
          `${data.abbr} — ${data.label}: ${data.influence}`
        )
      ),

      // As escolhas da raça ficam no fim da aba: para quem não tem escolha, somem sem
      // deixar linha vazia no meio.
      heading('titulo_escolhas_raca', 'Escolhas da raça', at(0, 20, 12, 1), {
        when: RACE_CHOICES.map((choice) => isRace(choice.race)).join(' ou ')
      }),
      ...RACE_CHOICES.map((choice, index) =>
        select(
          choice.key,
          `${choice.race}: +1 em`,
          at(index * 3, 21, 3, 2),
          [PENDING, ...choice.options],
          { when: isRace(choice.race) }
        )
      ),
      select(
        'mutacao',
        'Mutação',
        at(9, 21, 3, 2),
        [PENDING, ...MUTATIONS.map((mutation) => mutation.label)],
        { when: isRace('Mutante'), hint: 'Só uma, escolhida no início da aventura.' }
      )
    ]
  }
}

const ABILITY_COLUMNS: TableColumn[] = [
  column('esc', 'Esc.', 'checkbox', 0.4),
  column('nv', 'Nv', 'number', 0.35),
  column('pe', 'PE', 'number', 0.4),
  column('base', 'Base', 'number', 0.45),
  column('atrib', 'Soma', 'text', 0.5),
  column('valor', 'Valor', 'computed', 0.5, { formula: ABILITY_VALUE_FORMULA, format: 'integer' }),
  column('efeito', 'Efeito', 'text', 4),
  column('situacao', 'Situação', 'computed', 1.05, { formula: ABILITY_SITUATION_FORMULA }),
  column('usar', 'Usar', 'rollButton', 0.75, {
    // Manda o valor ao chat, onde o mestre aplica como dano ou cura. Sem valor, vai 0:
    // serve de anúncio de que a habilidade foi usada.
    formula: '{se(valor == "—", 0, valor)}',
    critical: { kind: 'none' },
    criticalFailureOnOne: false
  }),
  hiddenColumn('c1', '=se(esc e nv == 1, 1, 0)'),
  hiddenColumn('c2', '=se(esc e nv == 2, 1, 0)'),
  hiddenColumn('c3', '=se(esc e nv == 3, 1, 0)')
]

function abilityTable(data: ClassData, layout: GridPosition): TableComponent {
  return table(
    `hab_${data.key}`,
    `Habilidades — ${data.label}`,
    layout,
    ABILITY_COLUMNS,
    data.abilities.map((item) => ({
      id: `row_${item.key}`,
      key: item.key,
      label: item.name,
      cells: {
        nv: item.level,
        pe: item.cost,
        base: item.base,
        atrib: item.plus,
        efeito: item.effect
      }
    })),
    { playerCanAddRows: false, showRowLabels: true },
    {
      when: isClass(data.label),
      hint: 'Valor = Base + Soma (dano da arma principal ou atributo final). Usar manda o Valor ao chat.'
    }
  )
}

function abilitiesTab(): SheetTab {
  const levels = [1, 2, 3] as const

  const warning = choose(
    [
      [
        'escolhidas_n1 > limite_n1 ou escolhidas_n2 > limite_n2 ou escolhidas_n3 > limite_n3',
        q('Passou do limite da raça: desmarque alguma habilidade')
      ],
      [
        '(escolhidas_n2 > 0 e nivel < 2) ou (escolhidas_n3 > 0 e nivel < 3)',
        q('Há habilidade marcada acima do seu nível')
      ],
      ['escolhas_pendentes > 0', q('Ainda há habilidades para escolher')]
    ],
    q('Escolhas em dia')
  )

  return {
    id: 'tab_habilidades',
    label: 'Habilidades',
    components: [
      heading('titulo_habilidades', 'Habilidades da classe', at(0, 0, 12, 1)),
      rule(
        'regra_habilidades',
        1,
        'Marque Esc. para escolher. Usar manda o Valor ao chat (o mestre aplica); desconte o PE na barra.'
      ),
      ...levels.flatMap((level) => [
        computed(
          `escolhidas_n${level}`,
          `Nível ${level}: escolhidas`,
          at((level - 1) * 4, 2, 2, 2),
          chosenCountFormula(level)
        ),
        computed(
          `limite_n${level}`,
          `Nível ${level}: limite`,
          at((level - 1) * 4 + 2, 2, 2, 2),
          levelLimitFormula(level),
          { hint: 'Quantas habilidades deste nível a sua raça escolhe.' }
        )
      ]),
      computed('habilidades_aviso', 'Situação das escolhas', at(0, 4, 12, 2), `=${warning}`),
      // Empilhadas no mesmo lugar: só a da classe escolhida aparece.
      ...CLASSES.map((data) => abilityTable(data, at(0, 6, 12, 12)))
    ]
  }
}

function weaponAttackRow(slot: 1 | 2, y: number): SheetComponent[] {
  const name = slot === 1 ? 'principal' : 'secundária'
  return [
    computed(
      `arma${slot}_resumo`,
      `Arma ${name}`,
      at(0, y, 4, 2),
      `=se(arma${slot}_nome == "", "Nenhuma (aba Equipamentos)", arma${slot}_nome)`
    ),
    computed(
      `acerto_arma${slot}`,
      'Acerto',
      at(4, y, 2, 2),
      `=${attributeBySelect(`arma${slot}_atributo`)} + arma${slot}_bonus + ataque_ajuste`,
      { hint: 'Atributo da arma + bônus de ataque + ajuste temporário.' },
      'signed'
    ),
    roll(`atacar_arma${slot}`, `Ataque — ${name}`, at(6, y, 2, 2), `1d20 + {acerto_arma${slot}}`),
    computed(
      `dano_arma${slot}`,
      'Dano',
      at(8, y, 2, 2),
      `=max(0, arma${slot}_dano + dano_fisico_ajuste)`,
      { hint: 'Dano da arma + ajuste temporário de dano físico.' }
    ),
    roll(`rolar_dano_arma${slot}`, `Dano — ${name}`, at(10, y, 2, 2), `{dano_arma${slot}}`, {
      hint: 'Manda o dano ao chat para o mestre aplicar.'
    })
  ]
}

function combatTab(): SheetTab {
  const resistance = `=${choose(
    [
      [isRace('Anão'), q('Veneno: −2 de dano. Vantagem contra empurrões, quedas e deslocamentos.')],
      [isRace('Elfo'), q('−2 para resistir a venenos e doenças. 1×/combate: −2 num dano mágico.')],
      [isRace('Demônio'), q('Vulnerável: +50% de dano sagrado e penalidade contra purificação.')],
      [
        `${isRace('Mutante')} e mutacao == ${q('Pele resistente')}`,
        q('Pele resistente: −1 no dano físico recebido.')
      ]
    ],
    q('Nenhuma resistência racial.')
  )}`

  const magicSummary = `=${choose(
    [
      [isClass('Mago'), q('INT + foco mágico + ajuste')],
      [IS_MAGIC, q('ESP + foco mágico + ajuste')]
    ],
    q('Sua classe não faz ataque mágico')
  )}`

  return {
    id: 'tab_combate',
    label: 'Combate',
    components: [
      heading('titulo_combate', 'Combate', at(0, 0, 12, 1)),
      rule(
        'regra_turno',
        1,
        'Uma ação principal por turno. Com aval do mestre, também mover-se e uma interação simples com item.'
      ),
      computed('estado_combate', 'Estado', at(0, 2, 4, 2), '=estado'),
      computed('pv_atual', 'PV', at(4, 2, 2, 2), '=vida'),
      computed('pv_maximo', 'PV máximo', at(6, 2, 2, 2), '=vida.max'),
      computed('pe_atual', 'PE', at(8, 2, 2, 2), '=energia'),
      computed('pe_maximo', 'PE máximo', at(10, 2, 2, 2), '=energia.max'),
      computed('defesa_combate', 'Defesa', at(0, 4, 2, 2), '=defesa'),
      roll('iniciativa_combate', 'Iniciativa', at(2, 4, 2, 2), '1d20 + {agilidade.mod}'),
      computed('deslocamento_combate', 'Deslocamento', at(4, 4, 2, 2), '=deslocamento'),
      number(
        'defesa_ajuste',
        'Ajuste de Defesa',
        at(6, 4, 2, 2),
        { defaultValue: 0 },
        { hint: 'Temporário. Ex.: Fúria de Guerra −2, Sobrecarga Mágica −2.' }
      ),
      number(
        'ataque_ajuste',
        'Ajuste de ataque',
        at(8, 4, 2, 2),
        { defaultValue: 0 },
        {
          hint: 'Temporário, em todos os ataques. Ex.: fraqueza da classe −2, Olho do Predador +2.'
        }
      ),
      number(
        'dano_fisico_ajuste',
        'Ajuste de dano físico',
        at(10, 4, 2, 2),
        { defaultValue: 0 },
        { hint: 'Temporário: armas e habilidades com arma, FOR ou AGI. Ex.: Fúria de Guerra +3.' }
      ),

      heading('titulo_ataques', 'Ataques', at(0, 6, 12, 1)),
      ...weaponAttackRow(1, 7),
      ...weaponAttackRow(2, 9),
      computed('magia_resumo', 'Ataque mágico', at(0, 11, 4, 2), magicSummary),
      computed(
        'acerto_magico_combate',
        'Acerto',
        at(4, 11, 2, 2),
        '=acerto_magico',
        { when: IS_MAGIC },
        'signed'
      ),
      roll('ataque_magico_combate', 'Ataque mágico', at(6, 11, 2, 2), '1d20 + {acerto_magico}', {
        when: IS_MAGIC
      }),

      heading('titulo_uma_vez', 'Uma vez por combate', at(0, 13, 12, 1)),
      checkbox('racial_usado', 'Benefício racial', at(0, 14, 3, 2), {
        hint: 'Já usado neste combate'
      }),
      roll('graca_celestial', 'Graça Celestial (cura)', at(3, 14, 3, 2), '{2 + espirito.mod}', {
        when: isRace('Descendente de Anjo'),
        hint: 'Manda 2 + ESP ao chat para aplicar a cura.'
      }),
      computed(
        'essencia_limite',
        'Essência Infernal: cura máx.',
        at(6, 14, 3, 2),
        '=piso(vida.max / 4)',
        { when: isRace('Demônio'), hint: '25% da vida máxima, para baixo.' }
      ),
      roll(
        'instabilidade_genetica',
        'Instabilidade Genética',
        at(9, 14, 3, 2),
        '1d20 + {vigor.mod}',
        {
          when: isRace('Mutante'),
          hint: 'Abaixo de 25% da vida: teste de VIG contra 12.'
        }
      ),

      heading('titulo_condicoes', 'Condições e resistências', at(0, 16, 12, 1)),
      computed('resistencia_racial', 'Pela raça', at(0, 17, 12, 2), resistance),
      textarea('condicoes', 'Condições negativas', at(0, 19, 4, 4), 'Ex.: envenenado, derrubado'),
      textarea(
        'efeitos_temporarios',
        'Efeitos temporários',
        at(4, 19, 4, 4),
        'Ex.: Guarda de Ferro (−3 no próximo dano)'
      ),
      textarea(
        'resistencias',
        'Resistências e vulnerabilidades',
        at(8, 19, 4, 4),
        'De itens, magias e efeitos'
      ),

      heading('titulo_consumiveis', 'Consumíveis', at(0, 23, 12, 1)),
      computed('pocoes_cura_combate', 'Poções de cura', at(0, 24, 2, 2), '=pocoes_cura'),
      roll('beber_pocao_cura', 'Poção de Cura (6 PV)', at(2, 24, 4, 2), '6', {
        when: 'pocoes_cura > 0',
        hint: 'Manda 6 ao chat para o mestre aplicar a cura. Diminua a quantidade no Inventário.'
      }),
      computed('pocoes_energia_combate', 'Poções de energia', at(6, 24, 2, 2), '=pocoes_energia', {
        hint: 'Recupera 5 PE: some na barra de energia e diminua a quantidade no Inventário.'
      }),

      ...rules('regra_combate', 26, [
        'Dano final = dano da arma ou habilidade − redução de dano do alvo, nunca abaixo de 0.',
        'Habilidade pede requisitos, PE e recarga em dia. Ignorar defesa ou redução vale só para o que diz.',
        'Dano e cura aplicados pelo mestre (pelo chat ou pelo token) ficam no log do combate da mesa.',
        'Com 0 PV, o personagem fica incapacitado; o mestre decide o que acontece depois.'
      ])
    ]
  }
}

function magicTab(): SheetTab {
  const mage = { when: isClass('Mago') }
  const sorcerer = { when: isClass('Feiticeiro') }
  const satan = { when: isClass('Descendente de Satã') }
  const cleric = { when: isClass('Clérigo') }

  const element = `=${choose(
    [
      ['preparacao == "Fogo"', q('Fogo: dano adicional e queimadura')],
      ['preparacao == "Gelo"', q('Gelo: reduz o movimento do alvo')],
      ['preparacao == "Eletricidade"', q('Eletricidade: pode atingir alvos próximos')],
      ['preparacao == "Arcano"', q('Arcano: mais precisão ou penetração de defesa')],
      ['preparacao == "Espaço"', q('Espaço: empurra, puxa ou reposiciona alvos')]
    ],
    q('Nenhum elemento preparado')
  )}`

  const instability = `=${choose(
    [
      ['instabilidade <= 0', q('Estável')],
      ['instabilidade == 1', q('−1 no próximo teste de controle')],
      ['instabilidade == 2', q('−1 no teste de controle e a próxima habilidade custa +2 PE')]
    ],
    q('Sobrecarga: sofra 4 de dano verdadeiro e zere a Instabilidade')
  )}`

  return {
    id: 'tab_magias',
    label: 'Magias',
    components: [
      heading('titulo_magias', 'Magias e energia', at(0, 0, 12, 1)),
      computed('pe_magias', 'PE', at(0, 1, 2, 2), '=energia'),
      computed('pe_max_magias', 'PE máximo', at(2, 1, 2, 2), '=energia.max'),
      computed(
        'atributo_magico',
        'Atributo mágico',
        at(4, 1, 2, 2),
        `=${choose(
          [
            [isClass('Mago'), q('INT')],
            [IS_MAGIC, q('ESP')]
          ],
          q('Sem magia')
        )}`
      ),
      computed(
        'acerto_magico',
        'Acerto mágico',
        at(6, 1, 2, 2),
        `=se(${isClass('Mago')}, inteligencia.mod, espirito.mod) + foco_bonus + ataque_ajuste`,
        { when: IS_MAGIC, hint: 'Atributo mágico + bônus do foco + ajuste temporário de ataque.' },
        'signed'
      ),
      roll('ataque_magico', 'Ataque mágico', at(8, 1, 2, 2), '1d20 + {acerto_magico}', {
        when: IS_MAGIC
      }),
      computed(
        'foco_magias',
        'Bônus do foco',
        at(10, 1, 2, 2),
        '=foco_bonus',
        { when: IS_MAGIC, hint: 'Vem da aba Equipamentos.' },
        'signed'
      ),

      // Daqui para baixo, um bloco por classe, todos empilhados a partir da linha 3.

      heading('titulo_mago', 'Preparação Arcana (Mago)', at(0, 3, 12, 1), mage),
      select(
        'preparacao',
        'Preparação Arcana',
        at(0, 4, 4, 2),
        ['Nenhuma', 'Fogo', 'Gelo', 'Eletricidade', 'Arcano', 'Espaço'],
        mage
      ),
      computed('preparacao_efeito', 'Efeito do elemento', at(4, 4, 8, 2), element, mage),
      roll(
        'teste_concentracao',
        'Teste de INT (dif. 12)',
        at(0, 6, 4, 2),
        '1d20 + {inteligencia.mod} + {teste_ajuste}',
        { ...mage, hint: 'Quando é atingido enquanto prepara uma magia.' }
      ),
      ...rules(
        'regra_mago',
        8,
        [
          'Preparar: 1 ação principal + 2 PE. Na ação seguinte, a magia lançada ganha o efeito do elemento.',
          'A preparação não acumula consigo mesma e vale para qualquer magia do Mago.',
          'Atingido ao preparar: teste de INT (dif. 12). Falhou, perde a preparação e 1 PE (metade, para cima).',
          'Gelo + Prisão de Cristal: se o alvo falhar, fica imobilizado por mais 1 turno. Custo +2 PE.',
          'Eletricidade + Raio Encadeado: o raio pode atingir um quarto alvo próximo. Custo +2 PE.',
          'Espaço + Meteoro Menor: desloca levemente os alvos da área antes do impacto. Custo +2 PE.',
          'Outras combinações: o mestre aprova. Nenhuma duplica dano sem limite nem dispensa resistência.'
        ],
        mage.when
      ),

      heading('titulo_feiticeiro', 'Instabilidade (Feiticeiro)', at(0, 3, 12, 1), sorcerer),
      markers('instabilidade', 'Instabilidade', at(0, 4, 3, 2), 3, sorcerer),
      computed('instabilidade_efeito', 'Efeito agora', at(3, 4, 9, 2), instability, sorcerer),
      number(
        'instabilidade_voluntaria',
        'Instabilidade voluntária',
        at(0, 6, 3, 2),
        { min: 0, max: 3, defaultValue: 0 },
        {
          ...sorcerer,
          hint: 'Até 3, antes de rolar: cada ponto dá +2 de dano e +2 na dificuldade, e entra no marcador.'
        }
      ),
      select(
        'controle_para',
        'Teste de controle para',
        at(3, 6, 3, 2),
        [
          ['Habilidade de nível 3', 12],
          ['Ruína Caótica', 14],
          ['Pacto da Última Chama', 15]
        ],
        sorcerer
      ),
      computed(
        'dificuldade_controle',
        'Dificuldade',
        at(6, 6, 2, 2),
        '=controle_para + 2 * instabilidade_voluntaria',
        sorcerer
      ),
      computed(
        'bonus_controle',
        'Bônus no teste',
        at(8, 6, 2, 2),
        '=espirito.mod - se(instabilidade >= 1, 1, 0)',
        { ...sorcerer, hint: 'ESP, com −1 quando há Instabilidade.' },
        'signed'
      ),
      roll(
        'teste_controle',
        'Teste de controle',
        at(10, 6, 2, 2),
        '1d20 + {bonus_controle}',
        sorcerer
      ),
      computed(
        'dano_voluntario',
        'Dano extra (voluntária)',
        at(0, 8, 3, 2),
        '=2 * instabilidade_voluntaria',
        sorcerer,
        'signed'
      ),
      computed(
        'custo_ultima_chama',
        'PV do Pacto da Última Chama',
        at(3, 8, 3, 2),
        '=piso(vida / 4)',
        {
          ...sorcerer,
          hint: '25% dos PV atuais, para baixo.'
        }
      ),
      computed(
        'ultima_chama_status',
        'Pacto da Última Chama',
        at(6, 8, 6, 2),
        `=se(vida < vida.max / 4, ${q('Bloqueado: menos de 25% dos PV máximos')}, ${q('Liberado')})`,
        sorcerer
      ),
      ...rules(
        'regra_feiticeiro',
        10,
        [
          'Falhou no controle: +1 de Instabilidade, com a sobrecarga depois de resolver a habilidade.',
          'Os pontos voluntários entram no marcador: ao chegar em 3, vem a sobrecarga.',
          'Com 3 pontos: 4 de dano verdadeiro (ignora armadura e reduções) e a Instabilidade volta a zero.',
          'Descanso seguro zera a Instabilidade. Transfusão de Poder é proibida com 3 PV ou menos.'
        ],
        sorcerer.when
      ),

      heading('titulo_sata', 'Pacto de Sangue (Descendente de Satã)', at(0, 3, 12, 1), satan),
      computed(
        'sacrificio_status',
        'Sacrifício de PV',
        at(0, 4, 6, 2),
        `=se(vida < vida.max / 4, ${q('Bloqueado: abaixo de 25% da vida máxima')}, ${q('Liberado')})`,
        satan
      ),
      computed('custo_avatar', 'PV do Avatar da Ruína', at(6, 4, 3, 2), '=piso(vida / 4)', {
        ...satan,
        hint: '25% dos PV atuais, para baixo.'
      }),
      computed(
        'limite_sacrificio',
        '25% da vida máxima',
        at(9, 4, 3, 2),
        '=vida.max / 4',
        satan,
        'decimal'
      ),
      ...rules(
        'regra_sata',
        6,
        [
          'Cura nunca é de graça: as curas da classe sempre custam PE ou PV.',
          'O PV sacrificado não é reduzido por armadura nem por resistência.',
          'Abaixo de 25% da vida máxima, não pode usar habilidades que sacrificam PV.',
          'Ao ficar incapacitado, perde todas as maldições que mantinha ativas.',
          'Drenagem Profana e Banquete das Almas recuperam metade do dano efetivamente causado, para baixo.'
        ],
        satan.when
      ),

      heading('titulo_clerigo', 'Poder divino (Clérigo)', at(0, 3, 12, 1), cleric),
      checkbox('ressurreicao_usada', 'Ressurreição', at(0, 4, 4, 2), {
        ...cleric,
        hint: 'Já usada nesta aventura'
      }),
      ...rules(
        'regra_clerigo',
        6,
        [
          'Ataque mágico com ESP. O Martelo sagrado pode servir de foco (bônus do foco em Equipamentos).',
          'Dever sagrado: ferir um aliado inocente de propósito tira as habilidades sagradas até o fim do próximo turno.',
          'Ressurreição: 1×/aventura, revive um aliado derrotado neste combate com 25% dos PV máximos dele.'
        ],
        cleric.when
      ),

      rule(
        'regra_sem_magia',
        3,
        'Sua classe não usa magia: as habilidades ficam na aba Habilidades e o PE no Resumo.',
        IS_NOT_MAGIC
      )
    ]
  }
}

const WEAPON_CATEGORIES = [
  'Corpo a corpo',
  'Leve',
  'Pesada',
  'À distância',
  'Desarmada',
  'Foco mágico'
]

function weaponFields(slot: 1 | 2, y: number): SheetComponent[] {
  return [
    text(
      `arma${slot}_nome`,
      slot === 1 ? 'Arma principal' : 'Arma secundária',
      at(0, y, 3, 2),
      slot === 1 ? 'Ex.: Espada' : 'Ex.: Adaga'
    ),
    select(`arma${slot}_categoria`, 'Categoria', at(3, y, 2, 2), WEAPON_CATEGORIES),
    number(`arma${slot}_dano`, 'Dano', at(5, y, 1, 2), { min: 0, defaultValue: 0 }),
    select(
      `arma${slot}_atributo`,
      'Atributo',
      at(6, y, 2, 2),
      ATTRIBUTES.map((data) => data.abbr),
      { hint: 'Atributo que entra no acerto desta arma.' }
    ),
    number(`arma${slot}_bonus`, 'Bônus de ataque', at(8, y, 2, 2), { defaultValue: 0 }),
    select(`arma${slot}_alcance`, 'Alcance', at(10, y, 2, 2), ['Corpo a corpo', 'À distância']),
    text(
      `arma${slot}_propriedades`,
      'Propriedades especiais',
      at(0, y + 2, 6, 2),
      'Ex.: leve; ataques desarmados'
    ),
    number(`arma${slot}_for_minima`, 'FOR exigida', at(6, y + 2, 2, 2), {
      min: 0,
      defaultValue: 0
    }),
    // A FOR exigida compara com o valor do atributo (pontos + raça), não com o modificador.
    computed(
      `arma${slot}_requisito`,
      'Requisito',
      at(8, y + 2, 4, 2),
      `=se(arma${slot}_for_minima > forca + raca_for, ${q('Falta FOR para esta arma')}, ${q('Atendido')})`
    )
  ]
}

const MAGIC_ITEM_COLUMNS: TableColumn[] = [
  column('item', 'Item', 'text', 1.6),
  column('raridade', 'Raridade', 'select', 0.9, {
    options: selectOptions(['Comum', 'Incomum', 'Raro', 'Muito raro', 'Lendário'])
  }),
  column('efeito', 'Efeito', 'text', 2.6),
  column('duracao', 'Duração', 'text', 0.8),
  column('requisito', 'Requisito', 'text', 0.8),
  column('usos', 'Usos', 'number', 0.5),
  column('equipado', 'Equip.', 'checkbox', 0.45),
  column('pv', '+PV', 'number', 0.45),
  column('pe', '+PE', 'number', 0.45),
  column('desl', '+Desl.', 'number', 0.45),
  // Só o que está equipado conta nos máximos e no deslocamento.
  hiddenColumn('pv_ativo', '=se(equipado, pv, 0)'),
  hiddenColumn('pe_ativo', '=se(equipado, pe, 0)'),
  hiddenColumn('desl_ativo', '=se(equipado, desl, 0)')
]

const CATALOG: readonly [
  key: string,
  name: string,
  kind: string,
  value: string,
  details: string
][] = [
  ['adaga', 'Adaga', 'Arma', 'Dano 3', 'Leve, corpo a corpo.'],
  ['espada', 'Espada', 'Arma', 'Dano 5', 'Corpo a corpo.'],
  ['machado_pesado', 'Machado pesado', 'Arma', 'Dano 7', 'Corpo a corpo; exige FOR 3.'],
  [
    'cajado_arcano',
    'Cajado arcano',
    'Arma',
    'Dano 2',
    'Equipado, +1 no ataque mágico (bônus de foco).'
  ],
  ['arco', 'Arco', 'Arma', 'Dano 4', 'À distância.'],
  ['manoplas', 'Manoplas', 'Arma', 'Dano 3', 'Ataques desarmados.'],
  ['martelo_sagrado', 'Martelo sagrado', 'Arma', 'Dano 4', 'Pode servir de foco para o Clérigo.'],
  ['sem_armadura', 'Sem armadura', 'Armadura', '+0 Defesa', '—'],
  ['armadura_leve', 'Armadura leve', 'Armadura', '+1 Defesa', '—'],
  ['armadura_media', 'Armadura média', 'Armadura', '+2 Defesa', '−1 em testes de furtividade.'],
  [
    'armadura_pesada',
    'Armadura pesada',
    'Armadura',
    '+3 Defesa',
    '−2 em AGI nos testes de mobilidade e furtividade.'
  ],
  ['escudo', 'Escudo', 'Escudo', '+1 Defesa', 'Sugestão: as regras não definem escudos.'],
  ['anel_vital', 'Anel Vital', 'Item mágico', '+3 PV máx.', 'Incomum (sugestão).'],
  ['amuleto_arcano', 'Amuleto Arcano', 'Item mágico', '+3 PE máx.', 'Incomum (sugestão).'],
  ['botas_do_vento', 'Botas do Vento', 'Item mágico', '+1 deslocamento', 'Incomum (sugestão).'],
  ['pocao_de_cura', 'Poção de Cura', 'Consumível', '6 PV', 'Comum (sugestão). Some ao usar.'],
  ['pocao_de_energia', 'Poção de Energia', 'Consumível', '5 PE', 'Comum (sugestão). Some ao usar.'],
  [
    'cristal_elemental',
    'Cristal Elemental',
    'Item mágico',
    '—',
    'Raro (sugestão). 1×/combate, um elemento numa habilidade mágica, com aval do mestre.'
  ]
]

function equipmentTab(): SheetTab {
  const custom = 'armadura_tipo == "Personalizada"'

  return {
    id: 'tab_equipamentos',
    label: 'Equipamentos',
    components: [
      heading('titulo_armas', 'Armas', at(0, 0, 12, 1)),
      ...weaponFields(1, 1),
      ...weaponFields(2, 5),

      heading('titulo_armadura', 'Armadura e escudo', at(0, 9, 12, 1)),
      select(
        'armadura_tipo',
        'Armadura',
        at(0, 10, 3, 2),
        ['Sem armadura', 'Leve', 'Média', 'Pesada', 'Personalizada'],
        { hint: 'Um espaço só: não há como vestir duas armaduras.' }
      ),
      text('armadura_nome', 'Nome da armadura', at(3, 10, 3, 2), 'Ex.: Cota de malha'),
      number(
        'armadura_bonus_personalizado',
        'Bônus (personalizada)',
        at(6, 10, 2, 2),
        { defaultValue: 0 },
        { when: custom }
      ),
      computed(
        'armadura_bonus',
        'Bônus na Defesa',
        at(8, 10, 2, 2),
        `=${choose(
          [
            ['armadura_tipo == "Leve"', '1'],
            ['armadura_tipo == "Média"', '2'],
            ['armadura_tipo == "Pesada"', '3'],
            [custom, 'armadura_bonus_personalizado']
          ],
          '0'
        )}`,
        {},
        'signed'
      ),
      computed('defesa_equipamentos', 'Defesa', at(10, 10, 2, 2), '=defesa'),
      computed(
        'armadura_penalidade',
        'Penalidade',
        at(0, 12, 6, 2),
        `=${choose(
          [
            ['armadura_tipo == "Média"', q('−1 em testes de furtividade')],
            ['armadura_tipo == "Pesada"', q('−2 em AGI nos testes de mobilidade e furtividade')]
          ],
          q('Nenhuma')
        )}`,
        { when: 'armadura_tipo != "Personalizada"' }
      ),
      text(
        'armadura_penalidade_personalizada',
        'Penalidade (personalizada)',
        at(6, 12, 6, 2),
        'Ex.: −1 em furtividade',
        { when: custom }
      ),
      text('escudo_nome', 'Escudo', at(0, 14, 4, 2), 'Sem escudo'),
      number(
        'escudo_bonus',
        'Bônus do escudo',
        at(4, 14, 2, 2),
        { defaultValue: 0 },
        { hint: 'As regras não definem escudos: a sugestão é +1 para um escudo comum.' }
      ),
      text('escudo_propriedades', 'Propriedades do escudo', at(6, 14, 6, 2)),

      heading('titulo_acessorio', 'Acessório e foco mágico', at(0, 16, 12, 1)),
      text('acessorio_nome', 'Acessório', at(0, 17, 4, 2), 'Ex.: Anel de prata'),
      text('acessorio_efeito', 'Efeito do acessório', at(4, 17, 6, 2)),
      number(
        'foco_bonus',
        'Bônus de foco mágico',
        at(10, 17, 2, 2),
        { defaultValue: 0 },
        { hint: 'Entra no ataque mágico. Cajado arcano: +1.' }
      ),

      heading('titulo_itens_magicos', 'Itens mágicos', at(0, 19, 12, 1)),
      table(
        'itens_magicos',
        'Itens mágicos',
        at(0, 20, 12, 7),
        MAGIC_ITEM_COLUMNS,
        [],
        { playerCanAddRows: true, showRowLabels: false },
        { hint: 'Marque Equip. para o item contar nos máximos e no deslocamento.' }
      ),
      rule(
        'regra_itens',
        27,
        'Equip. marcado soma +PV, +PE e +Desl. sozinho. Usar: diminua Usos. Descartar: a lixeira da linha.'
      ),

      heading(
        'titulo_catalogo',
        'Catálogo sugerido (referência; o mestre ajusta)',
        at(0, 28, 12, 1)
      ),
      table(
        'catalogo',
        'Catálogo',
        at(0, 29, 12, 18),
        [
          column('tipo', 'Tipo', 'text', 0.9),
          column('valor', 'Dano / bônus', 'text', 1),
          column('detalhes', 'Detalhes', 'text', 3.5)
        ],
        CATALOG.map(([key, name, kind, value, details]) => ({
          id: `row_${key}`,
          key,
          label: name,
          cells: { tipo: kind, valor: value, detalhes: details }
        })),
        { playerCanAddRows: false, showRowLabels: true },
        GM_EDITS
      )
    ]
  }
}

function inventoryTab(): SheetTab {
  return {
    id: 'tab_inventario',
    label: 'Inventário',
    components: [
      heading('titulo_inventario', 'Inventário', at(0, 0, 12, 1)),
      number('moedas', 'Moedas de ouro', at(0, 1, 3, 2), { min: 0, defaultValue: 0 }),
      number(
        'pocoes_cura',
        'Poções de cura',
        at(3, 1, 3, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Recupera 6 PV; some ao usar.' }
      ),
      number(
        'pocoes_energia',
        'Poções de energia',
        at(6, 1, 3, 2),
        { min: 0, defaultValue: 0 },
        { hint: 'Recupera 5 PE; some ao usar.' }
      ),
      computed(
        'carga_total',
        'Peso / espaço total',
        at(9, 1, 3, 2),
        '=soma(inventario.total)',
        {},
        'decimal'
      ),
      table(
        'inventario',
        'Mochila',
        at(0, 3, 12, 10),
        [
          column('item', 'Item', 'text', 2.4),
          column('tipo', 'Tipo', 'select', 1, {
            options: selectOptions([
              'Equipamento',
              'Consumível',
              'Tesouro',
              'Item de missão',
              'Outro'
            ])
          }),
          column('quantidade', 'Qtd.', 'number', 0.6),
          column('peso', 'Peso', 'number', 0.6),
          column('total', 'Total', 'computed', 0.6, {
            formula: '=peso * quantidade',
            format: 'decimal'
          }),
          column('notas', 'Notas', 'text', 2)
        ],
        [],
        { playerCanAddRows: true, showRowLabels: false }
      ),
      rule(
        'regra_inventario',
        13,
        'Usar: diminua a quantidade. Descartar: a lixeira da linha. Equipar: passe o item para Equipamentos.'
      )
    ]
  }
}

function progressionTab(): SheetTab {
  const pending =
    '=max(0, limite_n1 - escolhidas_n1) + se(nivel >= 2, max(0, limite_n2 - escolhidas_n2), 0)' +
    ' + se(nivel >= 3, max(0, limite_n3 - escolhidas_n3), 0)'

  const levelUp = `=${choose(
    [
      ['nivel >= 3', q('Nível máximo')],
      ['xp_proximo <= 0', q('O mestre ainda não definiu o XP')],
      ['xp >= xp_proximo', q('Pode subir: fale com o mestre')]
    ],
    q('Ainda não')
  )}`

  return {
    id: 'tab_progressao',
    label: 'Progressão',
    components: [
      heading('titulo_progressao', 'Progressão', at(0, 0, 12, 1)),
      computed('nivel_atual', 'Nível', at(0, 1, 2, 2), '=nivel'),
      number('xp', 'Experiência atual', at(2, 1, 3, 2), { min: 0, defaultValue: 0 }),
      number(
        'xp_proximo',
        'XP para o próximo nível',
        at(5, 1, 3, 2),
        { min: 0, defaultValue: 0 },
        { ...GM_EDITS, hint: 'O mestre define. Zero: ainda não definido.' }
      ),
      computed('subir_nivel', 'Subir de nível', at(8, 1, 4, 2), levelUp),
      computed('escolhas_pendentes', 'Escolhas pendentes', at(0, 3, 3, 2), pending, {
        hint: 'Habilidades que a raça ainda deixa escolher até o seu nível.'
      }),
      computed('progressao_aviso', 'Habilidades', at(3, 3, 9, 2), '=habilidades_aviso'),

      heading('titulo_maximos', 'Como os máximos são calculados', at(0, 5, 12, 1)),
      computed(
        'pv_base_classe',
        'Vida-base da classe',
        at(0, 6, 2, 2),
        byClass((data) => String(data.hp), '0')
      ),
      computed('pv_vigor', 'VIG × 3', at(2, 6, 2, 2), '=vigor.mod * 3'),
      number(
        'bonus_racial_pv',
        'Bônus racial de PV',
        at(4, 6, 2, 2),
        { defaultValue: 0 },
        { ...GM_EDITS, hint: 'Nenhuma raça dá PV nas regras; fica para o mestre.' }
      ),
      computed('pv_nivel', 'Nível (+2 cada)', at(6, 6, 2, 2), '=2 * (nivel - 1)'),
      computed('pv_itens', 'Itens mágicos', at(8, 6, 2, 2), '=soma(itens_magicos.pv_ativo)'),
      computed('pv_max_progressao', 'Vida máxima', at(10, 6, 2, 2), '=vida.max'),
      computed(
        'pe_base_classe',
        'Energia-base da classe',
        at(0, 8, 2, 2),
        byClass((data) => String(data.energy), '0')
      ),
      computed('pe_espirito', 'ESP × 2', at(2, 8, 2, 2), '=espirito.mod * 2'),
      number(
        'bonus_racial_pe',
        'Bônus racial de PE',
        at(4, 8, 2, 2),
        { defaultValue: 0 },
        { ...GM_EDITS, hint: 'Nenhuma raça dá PE nas regras; fica para o mestre.' }
      ),
      computed('pe_nivel', 'Nível (+1 cada)', at(6, 8, 2, 2), '=nivel - 1'),
      computed('pe_itens', 'Itens mágicos', at(8, 8, 2, 2), '=soma(itens_magicos.pe_ativo)'),
      computed('pe_max_progressao', 'Energia máxima', at(10, 8, 2, 2), '=energia.max'),
      number(
        'deslocamento_base',
        'Deslocamento-base',
        at(0, 10, 3, 2),
        { min: 1, defaultValue: 6 },
        {
          ...GM_EDITS,
          hint: 'As regras não definem: a sugestão é 6 unidades (quadrados) por turno.'
        }
      ),
      computed(
        'descanso_curto_pe',
        'PE no descanso curto',
        at(3, 10, 3, 2),
        '=piso(energia.max / 4)',
        {
          hint: '25% dos PE máximos, para baixo.'
        }
      ),

      heading('titulo_regras_progressao', 'Progressão e descanso', at(0, 12, 12, 1)),
      ...rules('regra_progressao', 13, [
        'Começa no nível 1 e vai até o 3. O mestre decide quando a experiência permite subir.',
        'Ao subir: +2 PV máximos e +1 PE máximo. Os valores atuais não sobem sozinhos.',
        'Ao subir: escolha as habilidades que a raça libera no novo nível; as anteriores continuam.',
        'Descanso curto: recupera 25% dos PE máximos. Descanso seguro: recupera todos os PV e PE.',
        'O mestre dá experiência por combate, exploração, interpretação e objetivos concluídos.'
      ])
    ]
  }
}

function notesTab(): SheetTab {
  return {
    id: 'tab_anotacoes',
    label: 'Anotações',
    components: [
      heading('titulo_anotacoes', 'Anotações', at(0, 0, 12, 1)),
      textarea('historia', 'História e descrição', at(0, 1, 6, 6), 'Opcional'),
      textarea('missao', 'Missão e objetivos', at(6, 1, 6, 6)),
      textarea('anotacoes', 'Anotações do jogador', at(0, 7, 12, 4)),
      textarea('notas_mestre', 'Observações do mestre', at(0, 11, 12, 4), undefined, {
        editableBy: 'gm',
        visibleTo: 'gm',
        hint: 'O jogador nem recebe este campo.'
      })
    ]
  }
}

export function createFantasySchema(): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [
      summaryTab(),
      attributesTab(),
      abilitiesTab(),
      combatTab(),
      magicTab(),
      equipmentTab(),
      inventoryTab(),
      progressionTab(),
      notesTab()
    ]
  }
}

/** O arquivo no formato do botão Importar da biblioteca. */
export function createFantasyTemplateFile(): TemplateFile {
  return {
    format: TEMPLATE_FILE_FORMAT,
    fileVersion: 1,
    name: FANTASY_TEMPLATE_NAME,
    kind: 'character',
    schema: createFantasySchema()
  }
}

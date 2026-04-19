// ─────────────────────────────────────────────────────────────
//  Sistemas suportados pela plataforma
// ─────────────────────────────────────────────────────────────

export type SystemId = 'dnd5e' | 'ordem_paranormal';

export interface SystemInfo {
  id: SystemId;
  name: string;
  shortName: string;
  description: string;
  /** Cor de destaque usada na UI para identificar o sistema */
  accentColor: string;
}

export const SYSTEMS: Record<SystemId, SystemInfo> = {
  dnd5e: {
    id: 'dnd5e',
    name: 'Dungeons & Dragons 5ª Edição',
    shortName: 'D&D 5e',
    description: 'O sistema de RPG mais popular do mundo.',
    accentColor: '#c8a84b',
  },
  ordem_paranormal: {
    id: 'ordem_paranormal',
    name: 'Ordem Paranormal RPG',
    shortName: 'Ordem Paranormal',
    description: 'Sistema brasileiro de horror paranormal criado por Cellbit.',
    accentColor: '#7c3aed',
  },
};

export const DEFAULT_SYSTEM: SystemId = 'dnd5e';

export function getSystem(id: string): SystemInfo {
  return SYSTEMS[id as SystemId] ?? SYSTEMS.dnd5e;
}

// ─────────────────────────────────────────────────────────────
//  Tipos compartilhados entre sistemas
// ─────────────────────────────────────────────────────────────

export interface Attack {
  name: string;
  bonus: string;
  damage: string;
  type: string;
}

export interface InventoryItem {
  name: string;
  qty: number;
  weight: number;
  cost: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────
//  D&D 5e — tipos e constantes
// ─────────────────────────────────────────────────────────────

export const DND5E_ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Dnd5eAttr = typeof DND5E_ATTRIBUTES[number];

export const DND5E_ATTR_LABELS: Record<Dnd5eAttr, string> = {
  str: 'Força', dex: 'Destreza', con: 'Constituição',
  int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma',
};

// ─────────────────────────────────────────────────────────────
//  Ordem Paranormal — tipos e constantes
// ─────────────────────────────────────────────────────────────

export const OP_ATTRIBUTES = ['agi', 'for', 'int', 'pre', 'vig'] as const;
export type OPAttr = typeof OP_ATTRIBUTES[number];

export const OP_ATTR_LABELS: Record<OPAttr, string> = {
  agi: 'Agilidade',
  for: 'Força',
  int: 'Intelecto',
  pre: 'Presença',
  vig: 'Vigor',
};

export const OP_ATTR_SHORT: Record<OPAttr, string> = {
  agi: 'AGI', for: 'FOR', int: 'INT', pre: 'PRE', vig: 'VIG',
};

export type OPClasse = 'Mundano' | 'Ocultista' | 'Combatente' | 'Especialista';
export type OPTrilha = 'Sobrevivência' | 'Sanidade' | 'Morte';
export type OPProficiencia = 0 | 1 | 2 | 3;

export interface OPClasseData {
  dadoVida: number;
  dadoEsforco: number;
  atributosPrimarios: OPAttr[];
  descricao: string;
  habilidades: string;
}

export const OP_CLASSES: Record<OPClasse, OPClasseData> = {
  Mundano: {
    dadoVida: 20,
    dadoEsforco: 6,
    atributosPrimarios: ['agi', 'for', 'int', 'pre', 'vig'],
    descricao: 'Pessoa comum sem poderes paranormais. Mais PV, sem rituais.',
    habilidades: 'Sortudo (rerrola 1 dado por cena), Especialista (dobra bônus em 2 perícias)',
  },
  Ocultista: {
    dadoVida: 8,
    dadoEsforco: 6,
    atributosPrimarios: ['int', 'pre'],
    descricao: 'Usa rituais e magia paranormal. Menos PV, mais poder arcano.',
    habilidades: 'Acesso a rituais, Magia Paranormal, Foco em PE',
  },
  Combatente: {
    dadoVida: 16,
    dadoEsforco: 10,
    atributosPrimarios: ['for', 'agi', 'vig'],
    descricao: 'Especialista em combate físico e tático.',
    habilidades: 'Ataque Extra, Manobras de Combate, Resistência',
  },
  Especialista: {
    dadoVida: 12,
    dadoEsforco: 8,
    atributosPrimarios: ['agi', 'int'],
    descricao: 'Habilidoso em perícias específicas. Equilibrado.',
    habilidades: 'Especialização, Truques, Habilidades de Trilha',
  },
};

export interface OPPericia {
  nome: string;
  atributo: OPAttr;
  label: string;
}

export const OP_PERICIAS: OPPericia[] = [
  { nome: 'acrobacia',       atributo: 'agi', label: 'Acrobacia' },
  { nome: 'adestramento',    atributo: 'pre', label: 'Adestramento' },
  { nome: 'atletismo',       atributo: 'for', label: 'Atletismo' },
  { nome: 'atualidades',     atributo: 'int', label: 'Atualidades' },
  { nome: 'ciencias',        atributo: 'int', label: 'Ciências' },
  { nome: 'crime',           atributo: 'agi', label: 'Crime' },
  { nome: 'diplomacia',      atributo: 'pre', label: 'Diplomacia' },
  { nome: 'enganacao',       atributo: 'pre', label: 'Enganação' },
  { nome: 'fortitude',       atributo: 'vig', label: 'Fortitude' },
  { nome: 'furtividade',     atributo: 'agi', label: 'Furtividade' },
  { nome: 'iniciativa',      atributo: 'agi', label: 'Iniciativa' },
  { nome: 'intimidacao',     atributo: 'pre', label: 'Intimidação' },
  { nome: 'intuicao',        atributo: 'pre', label: 'Intuição' },
  { nome: 'investigacao',    atributo: 'int', label: 'Investigação' },
  { nome: 'luta',            atributo: 'for', label: 'Luta' },
  { nome: 'medicina',        atributo: 'int', label: 'Medicina' },
  { nome: 'ocultismo',       atributo: 'int', label: 'Ocultismo' },
  { nome: 'percepcao',       atributo: 'pre', label: 'Percepção' },
  { nome: 'pilotagem',       atributo: 'agi', label: 'Pilotagem' },
  { nome: 'pontaria',        atributo: 'agi', label: 'Pontaria' },
  { nome: 'profissao',       atributo: 'int', label: 'Profissão' },
  { nome: 'reflexos',        atributo: 'agi', label: 'Reflexos' },
  { nome: 'religiao',        atributo: 'int', label: 'Religião' },
  { nome: 'resiliencia',     atributo: 'pre', label: 'Resiliência' },
  { nome: 'sobrevivencia',   atributo: 'int', label: 'Sobrevivência' },
  { nome: 'tatica',          atributo: 'int', label: 'Tática' },
  { nome: 'tecnologia',      atributo: 'int', label: 'Tecnologia' },
  { nome: 'vontade',         atributo: 'pre', label: 'Vontade' },
];

/** Tabela de dificuldades padrão de Ordem Paranormal */
export const OP_DIFICULDADES = [
  { label: 'Fácil',       cd: 10 },
  { label: 'Médio',       cd: 15 },
  { label: 'Difícil',     cd: 20 },
  { label: 'Absurdo',     cd: 25 },
  { label: 'Impossível',  cd: 30 },
] as const;

/** Tabela de Pânico (resultado do d20 quando PS = 0) */
export const OP_TABELA_PANICO: Record<number, string> = {
  1:  'Colapso Total — fica inconsciente por 1d4 rodadas.',
  2:  'Fuga Desesperada — deve fugir da fonte de horror pelo máximo de movimento.',
  3:  'Paralisia de Medo — fica paralisado por 1 rodada.',
  4:  'Grito de Terror — grita incontrolavelmente, alertando inimigos próximos.',
  5:  'Tremores — -2 em todos os testes até o fim da cena.',
  6:  'Visões — alucinações leves; -1 em testes de Percepção.',
  7:  'Choro Incontrolável — ação bônus perdida nesta rodada.',
  8:  'Negação — recusa-se a acreditar no que viu; ignora pistas óbvias.',
  9:  'Raiva Irracional — ataca o aliado mais próximo (TR Vontade CD 15 para resistir).',
  10: 'Desmaio Breve — cai inconsciente por 1 rodada.',
  11: 'Náusea — fica enjoado; -1 em ataques e testes até descanso.',
  12: 'Paranoia — desconfia de todos os aliados até o fim da cena.',
  13: 'Mutismo — não consegue falar por 1d4 rodadas.',
  14: 'Compulsão — repete uma ação inútil por 1 rodada.',
  15: 'Pesadelo Acordado — sofre 1d6 de dano psíquico.',
  16: 'Dissociação — perde 1 PE adicional.',
  17: 'Superação — supera o medo; +2 em testes até o fim da cena.',
  18: 'Adrenalina — ganha uma ação bônus extra nesta rodada.',
  19: 'Foco Extremo — vantagem no próximo teste.',
  20: 'Determinação — recupera 1d6 PS e age normalmente.',
};

export interface OPRitual {
  nome: string;
  circulo: number;
  elemento: string;
  execucao: string;
  alcance: string;
  custo: string;
  descricao: string;
}

export interface OPAtaque {
  nome: string;
  bonus: string;
  dano: string;
  tipo: string;
  critico: string;
  alcance: string;
}

export interface OPSheetData {
  // Identidade
  nomePersonagem: string;
  nomeJogador: string;
  classe: OPClasse | '';
  origem: string;
  nex: number;
  trilha: OPTrilha | '';

  // Atributos
  agi: number;
  for: number;
  int: number;
  pre: number;
  vig: number;

  // Perícias (0 = sem treino, 1 = treinado, 2 = veterano, 3 = expert)
  pericias: Record<string, OPProficiencia>;

  // Recursos
  maxPV: number;
  pvAtual: number;
  maxPS: number;
  psAtual: number;
  maxPE: number;
  peAtual: number;

  // Combate
  defesa: number;
  deslocamento: number;
  protecao: number;
  panico: number;
  morteIminente: boolean;
  traumas: string[];

  // Conteúdo
  rituais: OPRitual[];
  habilidades: string;
  ataques: OPAtaque[];

  // Inventário
  equipamentos: InventoryItem[];
  dinheiro: number;

  // Anotações
  anotacoes: string;
}

export function defaultOPSheet(): OPSheetData {
  return {
    nomePersonagem: '', nomeJogador: '', classe: '', origem: '',
    nex: 5, trilha: '',
    agi: 1, for: 1, int: 1, pre: 1, vig: 1,
    pericias: Object.fromEntries(OP_PERICIAS.map(p => [p.nome, 0])),
    maxPV: 20, pvAtual: 20,
    maxPS: 20, psAtual: 20,
    maxPE: 3,  peAtual: 3,
    defesa: 10, deslocamento: 9, protecao: 0,
    panico: 0, morteIminente: false, traumas: [],
    rituais: [], habilidades: '',
    ataques: [{ nome: '', bonus: '', dano: '', tipo: '', critico: '20/x2', alcance: '' }],
    equipamentos: [], dinheiro: 0,
    anotacoes: '',
  };
}

/** Calcula bônus de perícia: atributo + bônus de treinamento */
export function opSkillBonus(
  sheet: OPSheetData,
  pericia: OPPericia,
): number {
  const attrVal = sheet[pericia.atributo];
  const prof = (sheet.pericias[pericia.nome] ?? 0) as OPProficiencia;
  const profBonus = [0, 2, 5, 8][prof];
  return attrVal + profBonus;
}

/** Calcula PV máximo baseado na classe e VIG */
export function calcOPMaxPV(classe: OPClasse, vig: number, nex: number): number {
  const base = OP_CLASSES[classe]?.dadoVida ?? 8;
  const nexBonus = Math.floor(nex / 5);
  return base + vig + nexBonus;
}

/** Calcula PE máximo baseado na classe e nex */
export function calcOPMaxPE(classe: OPClasse, nex: number): number {
  const dado = OP_CLASSES[classe]?.dadoEsforco ?? 6;
  return Math.max(1, Math.floor(dado * (nex / 20)));
}

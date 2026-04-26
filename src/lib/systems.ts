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
export type OPAgeBracket = 'Crianca' | 'Adolescente' | 'Jovem' | 'Adulto' | 'Maduro' | 'Idoso';

export interface OPClasseData {
  pvBase: number;
  pvPorNex: number;
  peBase: number;
  pePorNex: number;
  sanBase: number;
  sanPorNex: number;
  dadoVida: number;
  dadoEsforco: number;
  atributosPrimarios: OPAttr[];
  descricao: string;
  habilidades: string;
  pvInicial: string;
  peInicial: string;
  sanInicial: string;
  periciasTreinadas: string;
  proficiencias: string;
  progressaoNex: Array<{ nex: string; habilidades: string }>;
}

export const OP_CLASSES: Record<OPClasse, OPClasseData> = {
  Mundano: {
    pvBase: 2,
    pvPorNex: 2,
    peBase: 4,
    pePorNex: 4,
    sanBase: 5,
    sanPorNex: 5,
    dadoVida: 20,
    dadoEsforco: 6,
    atributosPrimarios: ['agi', 'for', 'int', 'pre', 'vig'],
    descricao: 'Pessoa comum sem poderes paranormais. Mais PV, sem rituais.',
    habilidades: 'Sortudo (rerrola 1 dado por cena), Especialista (dobra bônus em 2 perícias)',
    pvInicial: '2 PV (+Vig)',
    peInicial: '4 PE (+Pre)',
    sanInicial: '5 SAN',
    periciasTreinadas: '1 + Intelecto, duas à escolha entre as perícias de classe/origem conforme a ficha',
    proficiencias: 'Armas simples, armas táticas e proteções leves',
    progressaoNex: [
      { nex: '5%', habilidades: 'Habilidade de classe base' },
      { nex: '10%', habilidades: 'Habilidade de trilha' },
      { nex: '15%', habilidades: 'Poder de classe' },
    ],
  },
  Ocultista: {
    pvBase: 12,
    pvPorNex: 2,
    peBase: 4,
    pePorNex: 4,
    sanBase: 20,
    sanPorNex: 5,
    dadoVida: 8,
    dadoEsforco: 6,
    atributosPrimarios: ['int', 'pre'],
    descricao: 'Usa rituais e magia paranormal. Menos PV, mais poder arcano.',
    habilidades: 'Acesso a rituais, Magia Paranormal, Foco em PE',
    pvInicial: '12 PV (+Vig)',
    peInicial: '4 PE (+Pre)',
    sanInicial: '20 SAN',
    periciasTreinadas: 'Ocultismo e Vontade, mais 3 + Intelecto à escolha',
    proficiencias: 'Armas simples',
    progressaoNex: [
      { nex: '5%', habilidades: 'Escolhido pelo Outro Lado (1º círculo)' },
      { nex: '10%', habilidades: 'Habilidade de trilha' },
      { nex: '15%', habilidades: 'Poder de ocultista' },
      { nex: '20%', habilidades: 'Aumento de atributo' },
      { nex: '25%', habilidades: 'Escolhido pelo Outro Lado (2º círculo)' },
      { nex: '30%', habilidades: 'Poder de ocultista' },
      { nex: '35%', habilidades: 'Grau de treinamento' },
      { nex: '40%', habilidades: 'Habilidade de trilha' },
      { nex: '45%', habilidades: 'Poder de ocultista' },
      { nex: '50%', habilidades: 'Aumento de atributo, versatilidade' },
      { nex: '55%', habilidades: 'Escolhido pelo Outro Lado (3º círculo)' },
      { nex: '60%', habilidades: 'Poder de ocultista' },
      { nex: '65%', habilidades: 'Habilidade de trilha' },
      { nex: '70%', habilidades: 'Grau de treinamento' },
      { nex: '75%', habilidades: 'Poder de ocultista' },
      { nex: '80%', habilidades: 'Aumento de atributo' },
      { nex: '85%', habilidades: 'Escolhido pelo Outro Lado (4º círculo)' },
      { nex: '90%', habilidades: 'Poder de ocultista' },
      { nex: '95%', habilidades: 'Aumento de atributo' },
      { nex: '99%', habilidades: 'Habilidade de trilha' },
    ],
  },
  Combatente: {
    pvBase: 20,
    pvPorNex: 4,
    peBase: 2,
    pePorNex: 2,
    sanBase: 12,
    sanPorNex: 3,
    dadoVida: 16,
    dadoEsforco: 10,
    atributosPrimarios: ['for', 'agi', 'vig'],
    descricao: 'Especialista em combate físico e tático.',
    habilidades: 'Ataque Extra, Manobras de Combate, Resistência',
    pvInicial: '20 PV (+Vig)',
    peInicial: '2 PE (+Pre)',
    sanInicial: '12 SAN',
    periciasTreinadas: 'Luta ou Pontaria, Fortitude ou Reflexos, mais 1 + Intelecto à escolha',
    proficiencias: 'Armas simples, armas táticas e proteções leves',
    progressaoNex: [
      { nex: '5%', habilidades: 'Ataque especial (2 PE, +5)' },
      { nex: '10%', habilidades: 'Habilidade de trilha' },
      { nex: '15%', habilidades: 'Poder de combatente' },
      { nex: '20%', habilidades: 'Aumento de atributo' },
      { nex: '25%', habilidades: 'Ataque especial (3 PE, +10)' },
      { nex: '30%', habilidades: 'Poder de combatente' },
      { nex: '35%', habilidades: 'Grau de treinamento' },
      { nex: '40%', habilidades: 'Habilidade de trilha' },
      { nex: '45%', habilidades: 'Poder de combatente' },
      { nex: '50%', habilidades: 'Aumento de atributo, versatilidade' },
      { nex: '55%', habilidades: 'Ataque especial (4 PE, +15)' },
      { nex: '60%', habilidades: 'Poder de combatente' },
      { nex: '65%', habilidades: 'Habilidade de trilha' },
      { nex: '70%', habilidades: 'Grau de treinamento' },
      { nex: '75%', habilidades: 'Poder de combatente' },
      { nex: '80%', habilidades: 'Aumento de atributo' },
      { nex: '85%', habilidades: 'Ataque especial (5 PE, +20)' },
      { nex: '90%', habilidades: 'Poder de combatente' },
      { nex: '95%', habilidades: 'Aumento de atributo' },
      { nex: '99%', habilidades: 'Habilidade de trilha' },
    ],
  },
  Especialista: {
    pvBase: 16,
    pvPorNex: 3,
    peBase: 3,
    pePorNex: 3,
    sanBase: 16,
    sanPorNex: 4,
    dadoVida: 12,
    dadoEsforco: 8,
    atributosPrimarios: ['agi', 'int'],
    descricao: 'Habilidoso em perícias específicas. Equilibrado.',
    habilidades: 'Especialização, Truques, Habilidades de Trilha',
    pvInicial: '16 PV (+Vig)',
    peInicial: '3 PE (+Pre)',
    sanInicial: '16 SAN',
    periciasTreinadas: '7 + Intelecto à escolha',
    proficiencias: 'Armas simples e proteções leves',
    progressaoNex: [
      { nex: '5%', habilidades: 'Eclético, perito (2 PE, +1d6)' },
      { nex: '10%', habilidades: 'Habilidade de trilha' },
      { nex: '15%', habilidades: 'Poder de especialista' },
      { nex: '20%', habilidades: 'Aumento de atributo' },
      { nex: '25%', habilidades: 'Perito (3 PE, +1d8)' },
      { nex: '30%', habilidades: 'Poder de especialista' },
      { nex: '35%', habilidades: 'Grau de treinamento' },
      { nex: '40%', habilidades: 'Engenhosidade (veterano), habilidade de trilha' },
      { nex: '45%', habilidades: 'Poder de especialista' },
      { nex: '50%', habilidades: 'Aumento de atributo, versatilidade' },
      { nex: '55%', habilidades: 'Perito (4 PE, +1d10)' },
      { nex: '60%', habilidades: 'Poder de especialista' },
      { nex: '65%', habilidades: 'Habilidade de trilha' },
      { nex: '70%', habilidades: 'Grau de treinamento' },
      { nex: '75%', habilidades: 'Engenhosidade (expert), poder de especialista' },
      { nex: '80%', habilidades: 'Aumento de atributo' },
      { nex: '85%', habilidades: 'Perito (5 PE, +1d12)' },
      { nex: '90%', habilidades: 'Poder de especialista' },
      { nex: '95%', habilidades: 'Aumento de atributo' },
      { nex: '99%', habilidades: 'Habilidade de trilha' },
    ],
  },
};

export interface OPPericia {
  nome: string;
  atributo: OPAttr;
  label: string;
  descricao: string;
  somenteTreinada?: boolean;
  aplicaCarga?: boolean;
  requerKit?: boolean;
}

export interface OPAgeBracketData {
  label: string;
  faixa: string;
  descricao: string;
  desvantagensObrigatorias: number;
}

export const OP_AGE_BRACKETS: Record<OPAgeBracket, OPAgeBracketData> = {
  Crianca: {
    label: 'Crianca',
    faixa: '9 a 12 anos',
    descricao: 'Forca e Vigor limitados, deslocamento reduzido e sorte de principiante.',
    desvantagensObrigatorias: 0,
  },
  Adolescente: {
    label: 'Adolescente',
    faixa: '13 a 16 anos',
    descricao: 'Forca limitada, menos beneficios de origem e impeto juvenil.',
    desvantagensObrigatorias: 0,
  },
  Jovem: {
    label: 'Jovem',
    faixa: '17 a 24 anos',
    descricao: 'Sem modificadores mecanicos por idade.',
    desvantagensObrigatorias: 0,
  },
  Adulto: {
    label: 'Adulto',
    faixa: '25 a 44 anos',
    descricao: 'Vivencia e 1 desvantagem de idade obrigatoria.',
    desvantagensObrigatorias: 1,
  },
  Maduro: {
    label: 'Maduro',
    faixa: '45 a 64 anos',
    descricao: 'NEX efetivo +5% e 2 desvantagens de idade obrigatorias.',
    desvantagensObrigatorias: 2,
  },
  Idoso: {
    label: 'Idoso',
    faixa: '65+ anos',
    descricao: 'NEX efetivo +10% e 3 desvantagens de idade obrigatorias.',
    desvantagensObrigatorias: 3,
  },
};

export interface OPAgeDrawback {
  nome: string;
  descricao: string;
}

export const OP_AGE_DRAWBACKS: OPAgeDrawback[] = [
  { nome: 'Catarata', descricao: '-5 em Percepcao e Pontaria.' },
  { nome: 'Definhamento', descricao: '-5 em Fortitude e manobras de combate.' },
  { nome: 'Devagar, Jovem!', descricao: 'Deslocamento -3m e nao pode fazer investidas.' },
  { nome: 'Distraido', descricao: 'Fica surpreendido na primeira rodada de acao e perde o primeiro turno em investigacao.' },
  { nome: 'Fragil', descricao: 'Perde 2 PV por NEX.' },
  { nome: 'Gota', descricao: 'Ao usar Agilidade (ou pericias de Agilidade) e esquiva, sofre 1d6 de dano.' },
  { nome: 'Juntas Duras', descricao: '-5 em Acrobacia e Reflexos.' },
  { nome: 'Melancolico', descricao: 'Perde 1 PE por NEX.' },
  { nome: 'No Meu Tempo', descricao: '-5 em Intuicao e Vontade.' },
  { nome: 'Pulmao Ruim', descricao: 'Ao usar Forca (ou pericias de Forca), sofre 1d6 de dano; penalidades de folego e investida.' },
  { nome: 'Rabugento', descricao: '-5 em testes de Presenca e pericias de Presenca (exceto Intimidacao).' },
  { nome: 'Recurvado', descricao: 'Tamanho Pequeno (sem bonus de Furtividade da regra Tampinha).' },
  { nome: 'Sono Ruim', descricao: 'Descanso sempre conta uma categoria pior.' },
  { nome: 'Teimoso', descricao: 'Nao pode receber nem fornecer bonus por ajuda.' },
  { nome: 'Tosse', descricao: 'Pode perder turno por crise de tosse em acao/investigacao.' },
];

export interface OPOrigemData {
  nome: string;
  periciasTreinadas: string[];
  poderNome: string;
  poderDescricao: string;
}

export interface OPClassAbility {
  nome: string;
  classe: OPClasse;
  descricao: string;
  prerequisitos?: string;
  requisitoAtributo?: { atributo: OPAttr; minimo: number };
  requisitoNex?: number;
  requisitosPericiasTreinadas?: string[];
  requisitosPericiasAlternativas?: string[];
  requisitosHabilidadesClasse?: string[];
}

export interface OPGeneralAbility {
  nome: string;
  descricao: string;
  prerequisitos: string;
  requisitoAtributo?: { atributo: OPAttr; minimo: number };
  requisitoNex?: number;
  requisitosPericiasTreinadas?: string[];
  requerPericiaEscolhidaTreinada?: boolean;
}

export const OP_GENERAL_ABILITIES: OPGeneralAbility[] = [
  { nome: 'Acrobatico', descricao: 'Treina Acrobacia (ou +2 se ja treinado) e ignora penalidades de terreno dificil para deslocamento e investida.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'As do Volante', descricao: 'Treina Pilotagem (ou +2) e pode evitar dano ao veiculo com teste de Pilotagem uma vez por rodada.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Atletico', descricao: 'Treina Atletismo (ou +2) e recebe +3m de deslocamento.', prerequisitos: 'For 2', requisitoAtributo: { atributo: 'for', minimo: 2 } },
  { nome: 'Atraente', descricao: 'Recebe +5 em Artes, Diplomacia, Enganacao e Intimidacao contra alvos fisicamente atraidos por voce.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Dedos Ageis', descricao: 'Treina Crime (ou +2) e melhora tempo de arrombar, furtar e sabotar.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Detector de Mentiras', descricao: 'Treina Intuicao (ou +2) e impone -10 em Enganacao de outros para mentir para voce.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Especialista em Emergencias', descricao: 'Treina Medicina (ou +2) e melhora uso/saque de cicatrizantes e medicamentos.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Estigmado', descricao: 'Pode converter dano mental de medo em perda equivalente de PV.', prerequisitos: '-' },
  { nome: 'Foco em Pericia', descricao: 'Escolha uma pericia (exceto Luta e Pontaria): recebe +1d em testes dela. Pode ser escolhido mais vezes para pericias diferentes.', prerequisitos: 'Treinado na pericia escolhida', requerPericiaEscolhidaTreinada: true },
  { nome: 'Inventario Organizado', descricao: 'Soma Intelecto no limite de espacos e itens de 0,5 passam a ocupar 0,25 espaco.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Informado', descricao: 'Treina Atualidades (ou +2) e pode usar Atualidades no lugar de outras pericias para informacoes, a criterio do mestre.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Interrogador', descricao: 'Treina Intimidacao (ou +2) e pode coagir com Intimidacao como acao padrao (1 vez por cena por alvo).', prerequisitos: 'For 2', requisitoAtributo: { atributo: 'for', minimo: 2 } },
  { nome: 'Mentiroso Nato', descricao: 'Treina Enganacao (ou +2) e reduz penalidade de mentiras muito implausiveis.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Observador', descricao: 'Treina Investigacao (ou +2) e soma Intelecto em Intuicao.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Pai de Pet', descricao: 'Treina Adestramento (ou +2) e ganha um pet aliado com bonus em duas pericias aprovadas pelo mestre.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Palavras de Devocao', descricao: 'Treina Religiao (ou +2) e pode executar oracao que concede resistencia a dano mental 5 ate o fim da cena.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Parceiro', descricao: 'Ganha um aliado parceiro que acompanha e ajuda em missoes, conforme regras de aliado.', prerequisitos: 'Treinado em Diplomacia, NEX 30%', requisitoNex: 30, requisitosPericiasTreinadas: ['diplomacia'] },
  { nome: 'Pensamento Tatico', descricao: 'Treina Tatica (ou +2) e pode conceder acao de movimento adicional para aliados na primeira rodada do combate no terreno analisado.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Personalidade Esoterica', descricao: 'Recebe +3 PE e treinamento em Ocultismo (ou +2).', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Persuasivo', descricao: 'Treina Diplomacia (ou +2) e reduz penalidade ao pedir coisas custosas ou perigosas.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Pesquisador Cientifico', descricao: 'Treina Ciencias (ou +2) e pode usar Ciencias no lugar de Ocultismo/Sobrevivencia para identificacoes especificas.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Proativo', descricao: 'Treina Iniciativa (ou +2) e pode ganhar acao padrao adicional no primeiro turno com resultado alto de iniciativa.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Provisoes de Emergencia', descricao: 'Uma vez por missao, recupera suprimentos de esconderijo como nova preparacao de missao.', prerequisitos: '-' },
  { nome: 'Racionalidade Inflexivel', descricao: 'Pode usar Intelecto no lugar de Presenca como atributo-chave de Vontade e para calcular PE.', prerequisitos: 'Int 3', requisitoAtributo: { atributo: 'int', minimo: 3 } },
  { nome: 'Rato de Computador', descricao: 'Treina Tecnologia (ou +2), melhora acoes com dispositivos e pode buscar pistas sem gastar rodada de investigacao em certas condicoes.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Resposta Rapida', descricao: 'Treina Reflexos (ou +2) e pode rerrolar para evitar desprevenido usando Reflexos ao gastar 2 PE.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Talentoso', descricao: 'Treina Artes (ou +2) e melhora bonus concedidos ao impressionar com Artes.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Teimosia Obstinada', descricao: 'Treina Vontade (ou +2) e pode gastar 2 PE para +5 em testes de Vontade contra efeitos mentais especificos.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Tenacidade', descricao: 'Treina Fortitude (ou +2) e pode encerrar condicao morrendo com teste de Fortitude em combate.', prerequisitos: 'Vig 2', requisitoAtributo: { atributo: 'vig', minimo: 2 } },
  { nome: 'Sentidos Agucados', descricao: 'Treina Percepcao (ou +2), evita desprevenido contra inimigos invisiveis e melhora chance contra camuflagem.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
  { nome: 'Sobrevivencialista', descricao: 'Treina Sobrevivencia (ou +2), recebe bonus contra clima e ignora parte das penalidades de terreno dificil natural.', prerequisitos: 'Int 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Sorrateiro', descricao: 'Treina Furtividade (ou +2) e reduz penalidades para se mover ou seguir furtivo.', prerequisitos: 'Agi 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Vitalidade Reforcada', descricao: 'Recebe +1 PV a cada 5% de NEX e +2 em Fortitude.', prerequisitos: 'Vig 2', requisitoAtributo: { atributo: 'vig', minimo: 2 } },
  { nome: 'Vontade Inabalavel', descricao: 'Recebe +1 PE a cada 10% de NEX e +2 em Vontade.', prerequisitos: 'Pre 2', requisitoAtributo: { atributo: 'pre', minimo: 2 } },
];

export const OP_PERICIAS: OPPericia[] = [
  { nome: 'acrobacia', atributo: 'agi', label: 'Acrobacia', descricao: 'Equilibrar-se, escapar de amarras, levantar rapido e atravessar espacos perigosos.', aplicaCarga: true },
  { nome: 'adestramento', atributo: 'pre', label: 'Adestramento', descricao: 'Lidar com animais: acalmar, cavalgar, galopar e manejar montarias.', somenteTreinada: true },
  { nome: 'artes', atributo: 'pre', label: 'Artes', descricao: 'Expressao artistica para impressionar e influenciar socialmente.', somenteTreinada: true },
  { nome: 'atletismo', atributo: 'for', label: 'Atletismo', descricao: 'Corrida, escalada, natacao e saltos em situacoes fisicas extremas.' },
  { nome: 'atualidades', atributo: 'int', label: 'Atualidades', descricao: 'Conhecimento geral sobre noticias, politica, esportes e entretenimento.' },
  { nome: 'ciencias', atributo: 'int', label: 'Ciências', descricao: 'Conhecimento cientifico para responder duvidas tecnicas e experimentais.', somenteTreinada: true },
  { nome: 'crime', atributo: 'agi', label: 'Crime', descricao: 'Arrombar, furtar, ocultar objetos e sabotar dispositivos.', somenteTreinada: true, aplicaCarga: true, requerKit: true },
  { nome: 'diplomacia', atributo: 'pre', label: 'Diplomacia', descricao: 'Persuadir, acalmar e mudar atitude de NPCs com dialogo.' },
  { nome: 'enganacao', atributo: 'pre', label: 'Enganação', descricao: 'Blefar, mentir, disfarcar, falsificar e manipular percepcao alheia.', requerKit: true },
  { nome: 'fortitude', atributo: 'vig', label: 'Fortitude', descricao: 'Resistencia fisica contra venenos, doencas, corrida prolongada e falta de ar.' },
  { nome: 'furtividade', atributo: 'agi', label: 'Furtividade', descricao: 'Esconder-se, mover-se sem ser notado e seguir alvos discretamente.', aplicaCarga: true },
  { nome: 'iniciativa', atributo: 'agi', label: 'Iniciativa', descricao: 'Velocidade de reacao para agir primeiro em cenas de acao.' },
  { nome: 'intimidacao', atributo: 'pre', label: 'Intimidação', descricao: 'Assustar e coagir pessoas por meio de presenca e ameaca.' },
  { nome: 'intuicao', atributo: 'pre', label: 'Intuição', descricao: 'Perceber mentiras, anomalias sociais e ler intencoes de situacoes.' },
  { nome: 'investigacao', atributo: 'int', label: 'Investigação', descricao: 'Interrogar, procurar pistas e descobrir informacoes escondidas.' },
  { nome: 'luta', atributo: 'for', label: 'Luta', descricao: 'Ataques corpo a corpo com armas ou desarmado.' },
  { nome: 'medicina', atributo: 'int', label: 'Medicina', descricao: 'Primeiros socorros, tratamento, necropsia e cuidados prolongados.', requerKit: true },
  { nome: 'ocultismo', atributo: 'int', label: 'Ocultismo', descricao: 'Conhecimento paranormal para identificar criaturas, rituais e itens.', somenteTreinada: true },
  { nome: 'percepcao', atributo: 'pre', label: 'Percepção', descricao: 'Notar detalhes visuais e sonoros, inclusive itens e presencas ocultas.' },
  { nome: 'pilotagem', atributo: 'agi', label: 'Pilotagem', descricao: 'Operar veiculos terrestres e aquaticos em situacoes simples ou extremas.', somenteTreinada: true },
  { nome: 'pontaria', atributo: 'agi', label: 'Pontaria', descricao: 'Ataques a distancia com armas de disparo ou arremesso.' },
  { nome: 'profissao', atributo: 'int', label: 'Profissão', descricao: 'Aplicar especializacao profissional para resolver problemas da missao.', somenteTreinada: true },
  { nome: 'reflexos', atributo: 'agi', label: 'Reflexos', descricao: 'Resistencia a explosoes, armadilhas e efeitos que exigem resposta rapida.' },
  { nome: 'religiao', atributo: 'int', label: 'Religião', descricao: 'Conhecimento teologico, ritos e informacoes sobre mitos e reliquias.', somenteTreinada: true },
  { nome: 'resiliencia', atributo: 'pre', label: 'Resiliência', descricao: 'Controle emocional e recuperacao mental em situacoes de pressao.' },
  { nome: 'sobrevivencia', atributo: 'int', label: 'Sobrevivência', descricao: 'Orientacao em ermos, rastreamento, acampamento e identificacao de fauna.' },
  { nome: 'tatica', atributo: 'int', label: 'Tática', descricao: 'Analise de terreno e coordenacao estrategica de aliados.', somenteTreinada: true },
  { nome: 'tecnologia', atributo: 'int', label: 'Tecnologia', descricao: 'Hackear, operar sistemas eletronicos e localizar dados digitais.', somenteTreinada: true, requerKit: true },
  { nome: 'vontade', atributo: 'pre', label: 'Vontade', descricao: 'Resistencia mental contra medo, intimidacao e efeitos sobrenaturais.' },
];

/** Origens de Ordem com pericias treinadas e poder principal */
export const OP_ORIGENS: OPOrigemData[] = [
  { nome: 'Academico', periciasTreinadas: ['ciencias', 'investigacao'], poderNome: 'Saber e Poder', poderDescricao: 'Ao fazer teste com Intelecto, pode gastar 2 PE para receber +5 no teste.' },
  { nome: 'Agente de Saude', periciasTreinadas: ['intuicao', 'medicina'], poderNome: 'Tecnica Medicinal', poderDescricao: 'Sempre que cura um personagem, adiciona seu Intelecto ao total de PV curados.' },
  { nome: 'Amnesico', periciasTreinadas: [], poderNome: 'Vislumbres do Passado', poderDescricao: 'Pericias ficam a criterio do mestre. Uma vez por sessao, teste de Intelecto DT 10 para recuperar memoria util e ganhar PE temporarios.' },
  { nome: 'Artista', periciasTreinadas: ['artes', 'enganacao'], poderNome: 'Magnum Opus', poderDescricao: 'Uma vez por missao, pode ser reconhecido e receber +5 em testes de Presenca e pericias baseadas em Presenca contra essa pessoa.' },
  { nome: 'Atleta', periciasTreinadas: ['acrobacia', 'atletismo'], poderNome: '110%', poderDescricao: 'Em teste de pericia com Forca ou Agilidade (exceto Luta e Pontaria), pode gastar 2 PE para receber +5.' },
  { nome: 'Chef', periciasTreinadas: ['fortitude', 'profissao'], poderNome: 'Ingrediente Secreto', poderDescricao: 'Em interludio, ao cozinhar prato especial, o grupo pode receber beneficio de dois pratos.' },
  { nome: 'Criminoso', periciasTreinadas: ['crime', 'furtividade'], poderNome: 'O Crime Compensa', poderDescricao: 'No fim de missao, escolhe item encontrado para levar na proxima missao sem contar no limite de itens por patente.' },
  { nome: 'Cultista Arrependido', periciasTreinadas: ['ocultismo', 'religiao'], poderNome: 'Tracos do Outro Lado', poderDescricao: 'Ganha um poder paranormal a escolha, mas comeca com metade da Sanidade normal da classe.' },
  { nome: 'Desgarrado', periciasTreinadas: ['fortitude', 'sobrevivencia'], poderNome: 'Calejado', poderDescricao: 'Recebe +1 PV para cada 5% de NEX.' },
  { nome: 'Engenheiro', periciasTreinadas: ['profissao', 'tecnologia'], poderNome: 'Ferramenta Favorita', poderDescricao: 'Um item escolhido (exceto armas) conta como uma categoria abaixo para voce.' },
  { nome: 'Executivo', periciasTreinadas: ['diplomacia', 'profissao'], poderNome: 'Processo Otimizado', poderDescricao: 'Em teste estendido ou revisao de documentos, pode gastar 2 PE para receber +5.' },
  { nome: 'Investigador', periciasTreinadas: ['investigacao', 'percepcao'], poderNome: 'Faro para Pistas', poderDescricao: 'Uma vez por cena, ao procurar pistas, pode gastar 1 PE para receber +5 no teste.' },
  { nome: 'Lutador', periciasTreinadas: ['luta', 'reflexos'], poderNome: 'Mao Pesada', poderDescricao: 'Recebe +2 em rolagens de dano com ataques corpo a corpo.' },
  { nome: 'Magnata', periciasTreinadas: ['diplomacia', 'pilotagem'], poderNome: 'Patrocinador da Ordem', poderDescricao: 'Seu limite de credito e sempre considerado um acima do atual.' },
  { nome: 'Mercenario', periciasTreinadas: ['iniciativa', 'intimidacao'], poderNome: 'Posicao de Combate', poderDescricao: 'No primeiro turno de cada cena de acao, pode gastar 2 PE para receber uma acao de movimento adicional.' },
  { nome: 'Militar', periciasTreinadas: ['pontaria', 'tatica'], poderNome: 'Para Bellum', poderDescricao: 'Recebe +2 em rolagens de dano com armas de fogo.' },
  { nome: 'Operario', periciasTreinadas: ['fortitude', 'profissao'], poderNome: 'Ferramenta de Trabalho', poderDescricao: 'Escolhe arma simples ou tatica ligada ao trabalho, recebendo +1 em ataque, dano e margem de ameaca com ela.' },
  { nome: 'Policial', periciasTreinadas: ['percepcao', 'pontaria'], poderNome: 'Patrulha', poderDescricao: 'Recebe +2 em Defesa.' },
  { nome: 'Religioso', periciasTreinadas: ['religiao', 'vontade'], poderNome: 'Acalentar', poderDescricao: 'Recebe +5 em testes de Religiao para acalmar e, ao acalmar, o alvo recupera Sanidade igual a 1d6 + Presenca.' },
  { nome: 'Servidor Publico', periciasTreinadas: ['intuicao', 'vontade'], poderNome: 'Espirito Civico', poderDescricao: 'Em testes para ajudar, pode gastar 1 PE para aumentar o bonus concedido em +2.' },
  { nome: 'Teorico da Conspiracao', periciasTreinadas: ['investigacao', 'ocultismo'], poderNome: 'Eu Ja Sabia', poderDescricao: 'Recebe resistencia a dano mental igual ao seu Intelecto.' },
  { nome: 'T.I.', periciasTreinadas: ['investigacao', 'tecnologia'], poderNome: 'Motor de Busca', poderDescricao: 'Com acesso a internet, pode gastar 2 PE para substituir um teste de pericia qualquer por Tecnologia.' },
  { nome: 'Trabalhador Rural', periciasTreinadas: ['adestramento', 'sobrevivencia'], poderNome: 'Desbravador', poderDescricao: 'Em Adestramento ou Sobrevivencia, pode gastar 2 PE para receber +5 e nao sofre penalidade de terreno dificil.' },
  { nome: 'Trambiqueiro', periciasTreinadas: ['crime', 'enganacao'], poderNome: 'Impostor', poderDescricao: 'Uma vez por cena, pode gastar 2 PE para substituir um teste de pericia qualquer por Enganacao.' },
  { nome: 'Universitario', periciasTreinadas: ['atualidades', 'investigacao'], poderNome: 'Dedicacao', poderDescricao: 'Recebe +1 PE e +1 adicional a cada NEX impar; limite de PE por turno aumenta em 1.' },
  { nome: 'Vitima', periciasTreinadas: ['reflexos', 'vontade'], poderNome: 'Cicatrizes Psicologicas', poderDescricao: 'Recebe +1 de Sanidade para cada 5% de NEX.' },
  { nome: 'Amigo dos Animais', periciasTreinadas: ['adestramento', 'percepcao'], poderNome: 'Companheiro Animal', poderDescricao: 'Conexao com animais e beneficios ligados ao companheiro animal.' },
  { nome: 'Astronauta', periciasTreinadas: ['ciencias', 'fortitude'], poderNome: 'Acostumado ao Extremo', poderDescricao: 'Ao sofrer dano de fogo, frio ou mental, pode gastar 1 PE para reduzir em 5; custo aumenta na mesma cena.' },
  { nome: 'Chef do Outro Lado', periciasTreinadas: ['ocultismo', 'profissao'], poderNome: 'Fome do Outro Lado', poderDescricao: 'Pode usar partes de criaturas como ingredientes para pratos com efeitos especiais e risco severo a Sanidade.' },
  { nome: 'Colegial', periciasTreinadas: ['atualidades', 'tecnologia'], poderNome: 'Poder da Amizade', poderDescricao: 'Escolhe melhor amigo para receber bonus em testes quando em alcance medio e trocar olhares.' },
  { nome: 'Cosplayer', periciasTreinadas: ['artes', 'vontade'], poderNome: 'Nao e Fantasia, e Cosplay!', poderDescricao: 'Pode usar Artes em disfarce e recebe +2 em testes ligados ao cosplay usado.' },
  { nome: 'Diplomata', periciasTreinadas: ['atualidades', 'diplomacia'], poderNome: 'Conexoes', poderDescricao: 'Recebe +2 em Diplomacia e pode substituir testes por Diplomacia ao contatar NPC apropriado.' },
  { nome: 'Explorador', periciasTreinadas: ['fortitude', 'sobrevivencia'], poderNome: 'Manual do Sobrevivente', poderDescricao: 'Pode gastar 2 PE para receber +5 em testes de resistencia ambiental e considera sono precario como normal.' },
  { nome: 'Experimento', periciasTreinadas: ['atletismo', 'fortitude'], poderNome: 'Mutacao', poderDescricao: 'Recebe resistencia a dano 2 e +2 em uma pericia ligada a Forca, Agilidade ou Vigor; sofre penalidade em Diplomacia.' },
  { nome: 'Fanatico por Criaturas', periciasTreinadas: ['investigacao', 'ocultismo'], poderNome: 'Conhecimento Oculto', poderDescricao: 'Pode usar Ocultismo para identificar criatura por pistas e ganha +2 em testes contra ela ate o fim da missao.' },
  { nome: 'Fotografo', periciasTreinadas: ['artes', 'percepcao'], poderNome: 'Atraves da Lente', poderDescricao: 'Em Investigacao ou Percepcao usando camera/fotos, pode gastar 2 PE para receber +5.' },
  { nome: 'Inventor Paranormal', periciasTreinadas: ['profissao', 'vontade'], poderNome: 'Invencao Paranormal', poderDescricao: 'Possui invento com ritual de 1 circulo, ativado por teste de Profissao (engenheiro).' },
  { nome: 'Jovem Mistico', periciasTreinadas: ['ocultismo', 'religiao'], poderNome: 'A Culpa e das Estrelas', poderDescricao: 'Escolhe numero da sorte; no inicio da cena pode gastar 1 PE para tentar ganhar +2 em testes de pericia ate o fim da cena.' },
  { nome: 'Legista do Turno da Noite', periciasTreinadas: ['ciencias', 'medicina'], poderNome: 'Luto Habitual', poderDescricao: 'Sofre metade do dano mental em cenas de necropsia/morte e pode gastar 2 PE para +5 em Medicina apropriada.' },
  { nome: 'Mateiro', periciasTreinadas: ['percepcao', 'sobrevivencia'], poderNome: 'Mapa Celeste', poderDescricao: 'Sempre sabe os pontos cardeais sob o ceu e pode rerrolar Sobrevivencia ao gastar 2 PE.' },
  { nome: 'Mergulhador', periciasTreinadas: ['atletismo', 'fortitude'], poderNome: 'Folego de Nadador', poderDescricao: 'Recebe +5 PV, prende respiracao por mais tempo e melhora deslocamento em natacao.' },
  { nome: 'Motorista', periciasTreinadas: ['pilotagem', 'reflexos'], poderNome: 'Maos no Volante', poderDescricao: 'Nao sofre penalidades de ataque em veiculo em movimento e pode gastar 2 PE para +5 em Pilotagem/resistencia ao dirigir.' },
  { nome: 'Nerd Entusiasta', periciasTreinadas: ['ciencias', 'tecnologia'], poderNome: 'O Inteligentao', poderDescricao: 'Aumenta em +1 dado o bonus da acao de interludio Ler.' },
  { nome: 'Profetizado', periciasTreinadas: ['vontade'], poderNome: 'Luta ou Fuga', poderDescricao: 'Recebe +2 em Vontade e PE temporarios ao reconhecer sinais da premonicao. Escolhe mais uma pericia ao criar.' },
  { nome: 'Psicologo', periciasTreinadas: ['intuicao', 'profissao'], poderNome: 'Terapia', poderDescricao: 'Pode usar Profissao (psicologo) como Diplomacia e apoiar resistencias contra dano mental.' },
  { nome: 'Reporter Investigativo', periciasTreinadas: ['atualidades', 'investigacao'], poderNome: 'Encontrar a Verdade', poderDescricao: 'Pode usar Investigacao no lugar de Diplomacia para persuadir e gastar 2 PE para +5 em Investigacao.' },
];

/** Habilidades de classe (foco atual: Combatente) */
export const OP_CLASS_ABILITIES: OPClassAbility[] = [
  { nome: 'Armamento Pesado', classe: 'Combatente', descricao: 'Recebe proficiencia com armas pesadas.', prerequisitos: 'Forca 2', requisitoAtributo: { atributo: 'for', minimo: 2 } },
  { nome: 'Artista Marcial', classe: 'Combatente', descricao: 'Ataques desarmados causam 1d6, podem causar dano letal e se tornam ageis. Em NEX 35% sobe para 1d8 e em NEX 70% para 1d10.' },
  { nome: 'Ataque de Oportunidade', classe: 'Combatente', descricao: 'Quando um ser sai voluntariamente de um espaco adjacente, pode gastar reacao e 1 PE para ataque corpo a corpo.' },
  { nome: 'Combater com Duas Armas', classe: 'Combatente', descricao: 'Ao agredir com duas armas (ao menos uma leve), pode fazer dois ataques. Sofre penalidade em testes de ataque ate o proximo turno.', prerequisitos: 'Agilidade 3, treinado em Luta ou Pontaria', requisitoAtributo: { atributo: 'agi', minimo: 3 }, requisitosPericiasAlternativas: ['luta', 'pontaria'] },
  { nome: 'Combate Defensivo', classe: 'Combatente', descricao: 'Ao usar agredir, pode combater defensivamente: penalidade nos ataques e +5 Defesa ate o proximo turno.', prerequisitos: 'Intelecto 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Golpe Demolidor', classe: 'Combatente', descricao: 'Ao usar quebrar ou atacar objeto, pode gastar 1 PE para causar dois dados de dano extra do mesmo tipo da arma.', prerequisitos: 'Forca 2, treinado em Luta', requisitoAtributo: { atributo: 'for', minimo: 2 }, requisitosPericiasTreinadas: ['luta'] },
  { nome: 'Golpe Pesado', classe: 'Combatente', descricao: 'Com arma corpo a corpo em maos, o dano aumenta em mais um dado do mesmo tipo.' },
  { nome: 'Incansavel', classe: 'Combatente', descricao: 'Uma vez por cena, pode gastar 2 PE para fazer uma acao de investigacao adicional usando Forca ou Agilidade.' },
  { nome: 'Presteza Atletica', classe: 'Combatente', descricao: 'Em teste de facilitar investigacao, pode gastar 1 PE para usar Forca ou Agilidade no lugar do atributo-base. Se passar, proximo aliado recebe bonus adicional.' },
  { nome: 'Protecao Pesada', classe: 'Combatente', descricao: 'Recebe proficiencia com protecoes pesadas.', prerequisitos: 'NEX 30%', requisitoNex: 30 },
  { nome: 'Reflexos Defensivos', classe: 'Combatente', descricao: 'Recebe +2 em Defesa e testes de resistencia.', prerequisitos: 'Agilidade 2', requisitoAtributo: { atributo: 'agi', minimo: 2 } },
  { nome: 'Saque Rapido', classe: 'Combatente', descricao: 'Sacar/guardar itens vira acao livre. Com regra de municao, uma recarga por rodada tambem pode ser acao livre.', prerequisitos: 'Treinado em Iniciativa', requisitosPericiasTreinadas: ['iniciativa'] },
  { nome: 'Segurar o Gatilho', classe: 'Combatente', descricao: 'Ao acertar ataque com arma de fogo, pode fazer novo ataque contra o mesmo alvo pagando PE crescente por ataque extra.', prerequisitos: 'NEX 60%', requisitoNex: 60 },
  { nome: 'Sentido Tatico', classe: 'Combatente', descricao: 'Com acao de movimento e 2 PE, analisa o ambiente e recebe bonus em Defesa e resistencia igual ao Intelecto ate o fim da cena.', prerequisitos: 'Intelecto 2, treinado em Percepcao e Tatica', requisitoAtributo: { atributo: 'int', minimo: 2 }, requisitosPericiasTreinadas: ['percepcao', 'tatica'] },
  { nome: 'Tanque de Guerra', classe: 'Combatente', descricao: 'Com protecao pesada, Defesa e resistencia a dano da protecao aumentam em +2.', prerequisitos: 'Protecao Pesada', requisitosHabilidadesClasse: ['Protecao Pesada'] },
  { nome: 'Tiro Certeiro', classe: 'Combatente', descricao: 'Com arma de disparo, soma Agilidade no dano e ignora penalidade contra alvos em combate corpo a corpo.', prerequisitos: 'Treinado em Pontaria', requisitosPericiasTreinadas: ['pontaria'] },
  { nome: 'Tiro de Cobertura', classe: 'Combatente', descricao: 'Com acao padrao e 1 PE, faz teste de Pontaria contra Vontade para forcar alvo a se proteger e reduzir capacidade ofensiva ate seu proximo turno.' },
  { nome: 'Transcender', classe: 'Combatente', descricao: 'Escolhe um poder paranormal. Nao ganha Sanidade neste aumento de NEX. Pode escolher varias vezes.' },
  { nome: 'Treinamento em Pericia', classe: 'Combatente', descricao: 'Escolhe duas pericias para treinar. Em NEX 35% pode elevar treinadas para veterano; em NEX 70% pode elevar veteranas para expert. Pode escolher varias vezes.' },
  { nome: 'Aumento de Atributo', classe: 'Combatente', descricao: 'Em NEX 20%, 50%, 80% e 95%, aumenta um atributo em +1 (maximo 5 por esta regra).' },
  { nome: 'Grau de Treinamento', classe: 'Combatente', descricao: 'Em NEX 35% e 70%, escolhe 2 + Intelecto pericias treinadas para subir um grau (treinado->veterano, veterano->expert).' },
  { nome: 'Versatilidade', classe: 'Combatente', descricao: 'Em NEX 50%, escolhe entre um poder de combatente ou primeiro poder de trilha de combatente diferente da sua.' },

  { nome: 'Camuflar Ocultismo', classe: 'Ocultista', descricao: 'Pode gastar acao livre para esconder simbolos e sigilos em objetos ou na pele. Ao lancar ritual, pode gastar +2 PE para lancar sem componentes e sem gestos, usando apenas concentracao; outros percebem com teste de Ocultismo DT 25.' },
  { nome: 'Criar Selo', classe: 'Ocultista', descricao: 'Sabe fabricar selos paranormais de rituais conhecidos. Fabricar gasta acao de interludio e PE igual ao custo do ritual. Maximo de selos ativos igual a Presenca.' },
  { nome: 'Envolto em Misterio', classe: 'Ocultista', descricao: 'Aparencia e postura assombrosas. Recebe +5 em Enganacao e Intimidacao contra pessoas nao treinadas em Ocultismo.' },
  { nome: 'Especialista em Elemento', classe: 'Ocultista', descricao: 'Escolhe um elemento. A DT para resistir aos rituais desse elemento aumenta em +2.' },
  { nome: 'Ferramentas Paranormais', classe: 'Ocultista', descricao: 'Reduz em I a categoria de um item paranormal e pode ativar itens paranormais sem pagar custo em PE.' },
  { nome: 'Fluxo de Poder', classe: 'Ocultista', descricao: 'Pode manter dois efeitos sustentados de rituais com apenas uma acao livre, pagando o custo de cada efeito separadamente.', prerequisitos: 'NEX 60%', requisitoNex: 60 },
  { nome: 'Guiado pelo Paranormal', classe: 'Ocultista', descricao: 'Uma vez por cena, pode gastar 2 PE para fazer uma acao de investigacao adicional.' },
  { nome: 'Identificacao Paranormal', classe: 'Ocultista', descricao: 'Recebe +10 em testes de Ocultismo para identificar criaturas, objetos ou rituais.' },
  { nome: 'Improvisar Componentes', classe: 'Ocultista', descricao: 'Uma vez por cena, pode gastar acao completa para fazer teste de Investigacao DT 15 e improvisar componentes ritualisticos de um elemento (a criterio do mestre).' },
  { nome: 'Intuicao Paranormal', classe: 'Ocultista', descricao: 'Sempre que usa facilitar investigacao, soma Intelecto ou Presenca no teste (a escolha).' },
  { nome: 'Mestre em Elemento', classe: 'Ocultista', descricao: 'Escolhe um elemento. O custo para lancar rituais desse elemento diminui em -1 PE.', prerequisitos: 'Especialista em Elemento no elemento escolhido, NEX 45%', requisitoNex: 45, requisitosHabilidadesClasse: ['Especialista em Elemento'] },
  { nome: 'Ritual Potente', classe: 'Ocultista', descricao: 'Soma Intelecto nas rolagens de dano ou efeitos de cura dos rituais.', prerequisitos: 'Intelecto 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Ritual Predileto', classe: 'Ocultista', descricao: 'Escolhe um ritual conhecido e reduz em -1 PE o custo desse ritual (acumula com outras reducoes).' },
  { nome: 'Tatuagem Ritualistica', classe: 'Ocultista', descricao: 'Simbolos na pele reduzem em -1 PE o custo de rituais de alcance pessoal com voce como alvo.' },
  { nome: 'Transcender', classe: 'Ocultista', descricao: 'Escolhe um poder paranormal. Nao ganha Sanidade neste aumento de NEX. Pode escolher varias vezes.' },
  { nome: 'Treinamento em Pericia', classe: 'Ocultista', descricao: 'Escolhe duas pericias para treinar. Em NEX 35% pode elevar treinadas para veterano; em NEX 70% pode elevar veteranas para expert. Pode escolher varias vezes.' },
  { nome: 'Aumento de Atributo', classe: 'Ocultista', descricao: 'Em NEX 20%, 50%, 80% e 95%, aumenta um atributo em +1 (maximo 5 por esta regra).' },
  { nome: 'Grau de Treinamento', classe: 'Ocultista', descricao: 'Em NEX 35% e 70%, escolhe 3 + Intelecto pericias treinadas para subir um grau (treinado->veterano, veterano->expert).' },
  { nome: 'Versatilidade', classe: 'Ocultista', descricao: 'Em NEX 50%, escolhe entre um poder de ocultista ou primeiro poder de trilha de ocultista diferente da sua.' },

  { nome: 'Artista Marcial', classe: 'Especialista', descricao: 'Ataques desarmados causam 1d6, podem causar dano letal e contam como armas ageis. Em NEX 35% sobe para 1d8 e em NEX 70% para 1d10.' },
  { nome: 'Balistica Avancada', classe: 'Especialista', descricao: 'Recebe proficiencia com armas taticas de fogo e +2 em rolagens de dano com armas de fogo.' },
  { nome: 'Conhecimento Aplicado', classe: 'Especialista', descricao: 'Ao fazer teste de pericia (exceto Luta e Pontaria), pode gastar 2 PE para trocar o atributo-base para Intelecto.', prerequisitos: 'Intelecto 2', requisitoAtributo: { atributo: 'int', minimo: 2 } },
  { nome: 'Hacker', classe: 'Especialista', descricao: 'Recebe +5 em testes de Tecnologia para invadir sistemas e reduz o tempo de hackear para uma acao completa.', prerequisitos: 'Treinado em Tecnologia', requisitosPericiasTreinadas: ['tecnologia'] },
  { nome: 'Maos Rapidas', classe: 'Especialista', descricao: 'Ao fazer teste de Crime, pode pagar 1 PE para realizar como acao livre.', prerequisitos: 'Agilidade 3, treinado em Crime', requisitoAtributo: { atributo: 'agi', minimo: 3 }, requisitosPericiasTreinadas: ['crime'] },
  { nome: 'Mochila de Utilidades', classe: 'Especialista', descricao: 'Um item a escolha (exceto armas) conta como uma categoria abaixo e ocupa 1 espaco a menos.' },
  { nome: 'Movimento Tatico', classe: 'Especialista', descricao: 'Pode gastar 1 PE para ignorar penalidade de terreno dificil e escalada ate o fim do turno.', prerequisitos: 'Treinado em Atletismo', requisitosPericiasTreinadas: ['atletismo'] },
  { nome: 'Na Trilha Certa', classe: 'Especialista', descricao: 'Ao ter sucesso em procurar pistas, pode gastar PE para receber bonus no proximo teste, acumulando em sucessos consecutivos.' },
  { nome: 'Nerd', classe: 'Especialista', descricao: 'Uma vez por cena, pode gastar 2 PE para teste de Atualidades DT 20 e obter informacao util para a cena.' },
  { nome: 'Ninja Urbano', classe: 'Especialista', descricao: 'Recebe proficiencia com armas taticas de ataque corpo a corpo e de disparo (exceto de fogo) e +2 em dano com essas armas.' },
  { nome: 'Pensamento Agil', classe: 'Especialista', descricao: 'Uma vez por rodada, em cena de investigacao, pode gastar 2 PE para fazer uma acao adicional de procurar pistas.' },
  { nome: 'Perito em Explosivos', classe: 'Especialista', descricao: 'Soma Intelecto na DT para resistir aos explosivos e pode excluir alvos da explosao em numero igual ao Intelecto.' },
  { nome: 'Primeira Impressao', classe: 'Especialista', descricao: 'Recebe +2 no primeiro teste de Diplomacia, Enganacao, Intimidacao ou Intuicao em uma cena.' },
  { nome: 'Transcender', classe: 'Especialista', descricao: 'Escolhe um poder paranormal. Nao ganha Sanidade neste aumento de NEX. Pode escolher varias vezes.' },
  { nome: 'Treinamento em Pericia', classe: 'Especialista', descricao: 'Escolhe duas pericias para treinar. Em NEX 35% pode elevar treinadas para veterano; em NEX 70% pode elevar veteranas para expert. Pode escolher varias vezes.' },
  { nome: 'Aumento de Atributo', classe: 'Especialista', descricao: 'Em NEX 20%, 50%, 80% e 95%, aumenta um atributo em +1 (maximo 5 por esta regra).' },
  { nome: 'Grau de Treinamento', classe: 'Especialista', descricao: 'Em NEX 35% e 70%, escolhe numero de pericias treinadas para subir um grau (treinado->veterano, veterano->expert).' },
  { nome: 'Versatilidade', classe: 'Especialista', descricao: 'Em NEX 50%, escolhe entre um poder de especialista ou primeiro poder de trilha de especialista diferente da sua.' },
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
  regraIdadeAtiva: boolean;
  faixaEtaria: OPAgeBracket;
  desvantagensIdade: string[];

  // Atributos
  agi: number;
  for: number;
  int: number;
  pre: number;
  vig: number;

  // Perícias (0 = sem treinamento, 1 = treinado, 2 = experiente, 3 = expert)
  pericias: Record<string, OPProficiencia>;

  // Recursos
  maxPV: number;
  pvAtual: number;
  pvTemp: number;
  maxPS: number;
  psAtual: number;
  psTemp: number;
  maxPE: number;
  peAtual: number;
  peTemp: number;

  // Combate
  defesa: number;
  defesaOutrosMod: number;
  deslocamento: number;
  protecao: number;
  panico: number;
  morteIminente: boolean;
  traumas: string[];

  // Conteúdo
  rituais: OPRitual[];
  origemPoderNome: string;
  origemPoderDescricao: string;
  habilidadesExtras: string[];
  origemPericiasTreinadas: string[];
  habilidadesClasseSelecionadas: string[];
  poderesGeraisSelecionados: string[];
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
    regraIdadeAtiva: false,
    faixaEtaria: 'Jovem',
    desvantagensIdade: [],
    agi: 1, for: 1, int: 1, pre: 1, vig: 1,
    pericias: Object.fromEntries(OP_PERICIAS.map(p => [p.nome, 0])),
    maxPV: 0, pvAtual: 0,
    pvTemp: 0,
    maxPS: 0, psAtual: 0,
    psTemp: 0,
    maxPE: 0,  peAtual: 0,
    peTemp: 0,
    defesa: 11, defesaOutrosMod: 0, deslocamento: 9, protecao: 0,
    panico: 0, morteIminente: false, traumas: [],
    rituais: [], origemPoderNome: '', origemPoderDescricao: '', habilidadesExtras: [], origemPericiasTreinadas: [], habilidadesClasseSelecionadas: [], poderesGeraisSelecionados: [],
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
  const profBonus = [0, 5, 10, 15][prof];
  return attrVal + profBonus;
}

/** Calcula PV máximo baseado na classe e VIG */
export function calcOPMaxPV(classe: OPClasse, vig: number, nex: number): number {
  const classData = OP_CLASSES[classe];
  const base = classData?.pvBase ?? 2;
  const perNex = classData?.pvPorNex ?? 2;
  const levels = Math.max(0, Math.floor((nex - 5) / 5));
  return base + vig + levels * (perNex + vig);
}

/** Calcula PE máximo baseado na classe, nex e Presenca */
export function calcOPMaxPE(classe: OPClasse, nex: number, pre: number): number {
  const classData = OP_CLASSES[classe];
  const base = classData?.peBase ?? 4;
  const perNex = classData?.pePorNex ?? 4;
  const levels = Math.max(0, Math.floor((nex - 5) / 5));
  return base + pre + levels * (perNex + pre);
}

/** Calcula SAN máxima baseada na classe e no NEX */
export function calcOPMaxSAN(classe: OPClasse, nex: number): number {
  const classData = OP_CLASSES[classe];
  const base = classData?.sanBase ?? 5;
  const perNex = classData?.sanPorNex ?? 5;
  const levels = Math.max(0, Math.floor((nex - 5) / 5));
  return base + levels * perNex;
}

/** Defesa derivada: 10 + Agilidade + protecao + outros modificadores */
export function calcOPDefesa(agi: number, protecao: number, outrosMod: number): number {
  return 10 + agi + protecao + outrosMod;
}

export function getOPAgeNexBonus(regraAtiva: boolean, faixa: OPAgeBracket): number {
  if (!regraAtiva) return 0;
  if (faixa === 'Maduro') return 5;
  if (faixa === 'Idoso') return 10;
  return 0;
}

export function getOPAgePEFlatBonus(regraAtiva: boolean, faixa: OPAgeBracket): number {
  if (!regraAtiva) return 0;
  return faixa === 'Adolescente' ? 5 : 0;
}

export function getOPAgeDefesaBonus(regraAtiva: boolean, faixa: OPAgeBracket): number {
  if (!regraAtiva) return 0;
  return faixa === 'Crianca' ? 2 : 0;
}

export function getOPAgeRequiredDrawbacks(regraAtiva: boolean, faixa: OPAgeBracket): number {
  if (!regraAtiva) return 0;
  return OP_AGE_BRACKETS[faixa].desvantagensObrigatorias;
}

export function getOPAgeAttrMax(regraAtiva: boolean, faixa: OPAgeBracket, attr: OPAttr): number {
  if (!regraAtiva) return 5;
  if (faixa === 'Crianca' && (attr === 'for' || attr === 'vig')) return 1;
  if (faixa === 'Adolescente' && attr === 'for') return 2;
  return 5;
}

export function getOPAgeBaseDeslocamento(regraAtiva: boolean, faixa: OPAgeBracket): number {
  if (!regraAtiva) return 9;
  return faixa === 'Crianca' ? 6 : 9;
}

export function getOPAgeDeslocamentoPenalty(drawbacks: string[]): number {
  return drawbacks.includes('Devagar, Jovem!') ? 3 : 0;
}

export function getOPAgePVPenaltyPerLevel(drawbacks: string[]): number {
  return drawbacks.includes('Fragil') ? 2 : 0;
}

export function getOPAgePEPenaltyPerLevel(drawbacks: string[]): number {
  return drawbacks.includes('Melancolico') ? 1 : 0;
}

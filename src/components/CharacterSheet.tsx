import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { X, Save, Sword, BookOpen, Package, Sparkles, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────────────────────────────────────
   D&D 5e Helpers
───────────────────────────────────────────── */
const mod = (score: number) => Math.floor((score - 10) / 2);
const modStr = (score: number) => { const m = mod(score); return m >= 0 ? `+${m}` : `${m}`; };
const profBonus = (level: number) => Math.ceil(level / 4) + 1;

const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type Attr = typeof ATTRIBUTES[number];

const ATTR_LABELS: Record<Attr, string> = {
  str: 'Força', dex: 'Destreza', con: 'Constituição',
  int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma',
};
const ATTR_SHORT: Record<Attr, string> = {
  str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
};

const SKILLS: { name: string; attr: Attr; label: string }[] = [
  { name: 'acrobatics', attr: 'dex', label: 'Acrobacia' },
  { name: 'animal_handling', attr: 'wis', label: 'Lidar c/ Animais' },
  { name: 'arcana', attr: 'int', label: 'Arcanismo' },
  { name: 'athletics', attr: 'str', label: 'Atletismo' },
  { name: 'deception', attr: 'cha', label: 'Enganação' },
  { name: 'history', attr: 'int', label: 'História' },
  { name: 'insight', attr: 'wis', label: 'Intuição' },
  { name: 'intimidation', attr: 'cha', label: 'Intimidação' },
  { name: 'investigation', attr: 'int', label: 'Investigação' },
  { name: 'medicine', attr: 'wis', label: 'Medicina' },
  { name: 'nature', attr: 'int', label: 'Natureza' },
  { name: 'perception', attr: 'wis', label: 'Percepção' },
  { name: 'performance', attr: 'cha', label: 'Performance' },
  { name: 'persuasion', attr: 'cha', label: 'Persuasão' },
  { name: 'religion', attr: 'int', label: 'Religião' },
  { name: 'sleight_of_hand', attr: 'dex', label: 'Prestidigitação' },
  { name: 'stealth', attr: 'dex', label: 'Furtividade' },
  { name: 'survival', attr: 'wis', label: 'Sobrevivência' },
];

const SPELL_LEVELS = ['Truques', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º'];
const SPELL_SLOTS_BY_LEVEL: Record<number, number[]> = {
  1:  [0,2,0,0,0,0,0,0,0,0],
  2:  [0,3,0,0,0,0,0,0,0,0],
  3:  [0,4,2,0,0,0,0,0,0,0],
  4:  [0,4,3,0,0,0,0,0,0,0],
  5:  [0,4,3,2,0,0,0,0,0,0],
  6:  [0,4,3,3,0,0,0,0,0,0],
  7:  [0,4,3,3,1,0,0,0,0,0],
  8:  [0,4,3,3,2,0,0,0,0,0],
  9:  [0,4,3,3,3,1,0,0,0,0],
  10: [0,4,3,3,3,2,0,0,0,0],
  11: [0,4,3,3,3,2,1,0,0,0],
  12: [0,4,3,3,3,2,1,0,0,0],
  13: [0,4,3,3,3,2,1,1,0,0],
  14: [0,4,3,3,3,2,1,1,0,0],
  15: [0,4,3,3,3,2,1,1,1,0],
  16: [0,4,3,3,3,2,1,1,1,0],
  17: [0,4,3,3,3,2,1,1,1,1],
  18: [0,4,3,3,3,3,1,1,1,1],
  19: [0,4,3,3,3,3,2,1,1,1],
  20: [0,4,3,3,3,3,2,2,1,1],
};

/* ─────────────────────────────────────────────
   D&D 5e Race Data
───────────────────────────────────────────── */
interface RaceData {
  asi: Partial<Record<Attr, number>>;
  speed: number;
  languages: string;
  traits: string;
  freeAsi?: number; // number of free +1 choices (e.g., Meio-Elfo gets 2 free)
}

const RACE_DATA: Record<string, RaceData> = {
  'Humano': {
    asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    languages: 'Comum + 1 idioma à escolha',
    traits: '+1 em todos os atributos. Proficiência em uma habilidade à escolha. Um idioma adicional.',
  },
  'Alto Elfo': {
    asi: { dex: 2, int: 1 },
    speed: 30,
    languages: 'Comum, Élfico + 1 idioma',
    traits: 'Visão no Escuro (60ft). Sentidos Aguçados (Percepção proficiente). Transe (descanso longo em 4h). Magia de Elfo (1 truque de Mago). Treinamento Élfico (espada longa, espada curta, arco longo, arco curto).',
  },
  'Elfo da Floresta': {
    asi: { dex: 2, wis: 1 },
    speed: 35,
    languages: 'Comum, Élfico',
    traits: 'Visão no Escuro (60ft). Sentidos Aguçados. Transe. Máscara da Natureza (Furtividade em terreno natural). Deslocamento 35ft.',
  },
  'Drow': {
    asi: { dex: 2, cha: 1 },
    speed: 30,
    languages: 'Comum, Élfico, Subcomum',
    traits: 'Visão no Escuro Superior (120ft). Sensibilidade à Luz Solar. Magia Drow (Luzes Dançantes, Chama das Fadas, Escuridão). Treinamento Drow (rapieiras, bestas de mão).',
  },
  'Anão da Colina': {
    asi: { con: 2, wis: 1 },
    speed: 25,
    languages: 'Comum, Anão',
    traits: 'Visão no Escuro (60ft). Resiliência dos Anões (+2 TR contra veneno, resistência ao dano de veneno). Proficiência em machados, martelos e picaretas. Treinamento de Combate de Anão. Habilidade com Ferramentas. Tenacidade da Colina (+1 PV máximo por nível).',
  },
  'Anão da Montanha': {
    asi: { str: 2, con: 2 },
    speed: 25,
    languages: 'Comum, Anão',
    traits: 'Visão no Escuro (60ft). Resiliência dos Anões. Treinamento de combate de anão. Proficiência com armaduras leves e médias. Habilidade com Ferramentas.',
  },
  'Halfling Pés Leves': {
    asi: { dex: 2, cha: 1 },
    speed: 25,
    languages: 'Comum, Halfling',
    traits: 'Sortudo (relança 1s naturais). Corajoso (vantagem contra medo). Ágil halfling (mover por espaço de criatura maior). Furtividade Natural (Furtividade atrás de criatura maior).',
  },
  'Halfling Robusto': {
    asi: { dex: 2, con: 1 },
    speed: 25,
    languages: 'Comum, Halfling',
    traits: 'Sortudo. Corajoso. Ágil halfling. Resiliência Robusta (vantagem em TR contra veneno, resistência ao dano de veneno).',
  },
  'Gnomo da Rocha': {
    asi: { int: 2, con: 1 },
    speed: 25,
    languages: 'Comum, Gnômico',
    traits: 'Visão no Escuro (60ft). Esperteza de Gnomo (vantagem em TR de Int, Sab e Car contra magia). Engenhocas (criar dispositivos simples). Comunicador (falar com pequenos mamíferos).',
  },
  'Gnomo da Floresta': {
    asi: { int: 2, dex: 1 },
    speed: 25,
    languages: 'Comum, Gnômico',
    traits: 'Visão no Escuro (60ft). Esperteza de Gnomo. Ilusão Natural (truque Ilusão Menor). Falar com Animais Pequenos.',
  },
  'Meio-Elfo': {
    asi: { cha: 2 },
    speed: 30,
    languages: 'Comum, Élfico + 1 idioma',
    traits: 'Visão no Escuro (60ft). Herança Feérica (vantagem contra encantamentos, imune a sono mágico). Sentidos Aguçados. Versatilidade de Habilidade (proficiência em 2 habilidades à escolha). +1 em dois atributos à escolha.',
    freeAsi: 2,
  },
  'Meio-Orc': {
    asi: { str: 2, con: 1 },
    speed: 30,
    languages: 'Comum, Orc',
    traits: 'Visão no Escuro (60ft). Ameaçador (proficiente em Intimidação). Resistência Implacável (cair a 1 PV em vez de 0, uma vez por descanso longo). Ataques Selvagens (acerto crítico adiciona 1 dado de dano).',
  },
  'Tiefling': {
    asi: { int: 1, cha: 2 },
    speed: 30,
    languages: 'Comum, Infernal',
    traits: 'Visão no Escuro (60ft). Resistência Infernal (resistência a dano de fogo). Legado Infernal: Thaumaturgia (truque), Chama Infernal (nível 3), Escuridão (nível 5).',
  },
  'Draconato': {
    asi: { str: 2, cha: 1 },
    speed: 30,
    languages: 'Comum, Dracônico',
    traits: 'Ancestralidade Dracônica (escolha o tipo de dragão). Sopro (ação, CD 8+Con+Prof). Resistência Dracônica (ao tipo de dano do sopro).',
  },
};

/* ─────────────────────────────────────────────
   D&D 5e Class Data
───────────────────────────────────────────── */
interface ClassData {
  hitDice: number;
  savingThrows: Attr[];
  armorProfs: string;
  weaponProfs: string;
  toolProfs: string;
  spellcastingAbility: Attr | '';
  features: string;
  primaryAttr: Attr;
  isSpellcaster: boolean;
}

const CLASS_DATA: Record<string, ClassData> = {
  'Bárbaro': {
    hitDice: 12,
    savingThrows: ['str', 'con'],
    armorProfs: 'Leves, médias, escudos',
    weaponProfs: 'Armas simples e marciais',
    toolProfs: 'Nenhuma',
    spellcastingAbility: '',
    features: 'Fúria (2/descanso longo), Defesa Sem Armadura (CA = 10 + mod DES + mod CON sem armadura)',
    primaryAttr: 'str',
    isSpellcaster: false,
  },
  'Bardo': {
    hitDice: 8,
    savingThrows: ['dex', 'cha'],
    armorProfs: 'Leves',
    weaponProfs: 'Armas simples, bestas de mão, espada longa, rapieira, espada curta',
    toolProfs: '3 instrumentos musicais à escolha',
    spellcastingAbility: 'cha',
    features: 'Conjuração (CAR), Inspiração de Bardo (d6, bônus em teste de habilidade/ataque/TR)',
    primaryAttr: 'cha',
    isSpellcaster: true,
  },
  'Clérigo': {
    hitDice: 8,
    savingThrows: ['wis', 'cha'],
    armorProfs: 'Leves, médias, escudos',
    weaponProfs: 'Armas simples',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'wis',
    features: 'Conjuração (SAB), Canal de Divindade (1/descanso curto), Domínio Divino (escolha subclasse)',
    primaryAttr: 'wis',
    isSpellcaster: true,
  },
  'Druida': {
    hitDice: 8,
    savingThrows: ['int', 'wis'],
    armorProfs: 'Leves, médias, escudos (não metálicos)',
    weaponProfs: 'Bordão, adaga, dardo, azagaia, maça, machadinha, cimitarra, foice, funda, lança',
    toolProfs: 'Kit de herbalismo',
    spellcastingAbility: 'wis',
    features: 'Conjuração (SAB), Druídico (idioma secreto), Forma Selvagem (CR 1/4, sem voo ou nado)',
    primaryAttr: 'wis',
    isSpellcaster: true,
  },
  'Guerreiro': {
    hitDice: 10,
    savingThrows: ['str', 'con'],
    armorProfs: 'Todas as armaduras, escudos',
    weaponProfs: 'Armas simples e marciais',
    toolProfs: 'Nenhuma',
    spellcastingAbility: '',
    features: 'Estilo de Combate (escolha), Retorno das Forças (recuperar PV em ação bônus, PV = 1d10 + nível Guerreiro), Segunda Ação de Ataque no nível 5',
    primaryAttr: 'str',
    isSpellcaster: false,
  },
  'Ladino': {
    hitDice: 8,
    savingThrows: ['dex', 'int'],
    armorProfs: 'Leves',
    weaponProfs: 'Armas simples, bestas de mão, espada longa, rapieira, espada curta',
    toolProfs: 'Ferramentas de ladrão',
    spellcastingAbility: '',
    features: 'Especialização (dobrar bônus de proficiência em 2 perícias), Ataque Furtivo (1d6), Jíria dos Ladrões',
    primaryAttr: 'dex',
    isSpellcaster: false,
  },
  'Mago': {
    hitDice: 6,
    savingThrows: ['int', 'wis'],
    armorProfs: 'Nenhuma',
    weaponProfs: 'Adagas, dardos, fundas, bordões, bestas leves',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'int',
    features: 'Conjuração (INT), Recuperação Arcana (recuperar espaços de magia no descanso curto), Tradição Arcana (escolha subclasse)',
    primaryAttr: 'int',
    isSpellcaster: true,
  },
  'Monge': {
    hitDice: 8,
    savingThrows: ['str', 'dex'],
    armorProfs: 'Nenhuma',
    weaponProfs: 'Armas simples, espadas curtas',
    toolProfs: '1 tipo de ferramenta de artesão ou instrumento musical',
    spellcastingAbility: '',
    features: 'Artes Marciais (1d4 + mod DES desarmado, bônus de ação para ataque extra), Pontos de Ki (igual ao nível), Movimento Sem Armadura (+10ft de deslocamento)',
    primaryAttr: 'dex',
    isSpellcaster: false,
  },
  'Paladino': {
    hitDice: 10,
    savingThrows: ['wis', 'cha'],
    armorProfs: 'Todas as armaduras, escudos',
    weaponProfs: 'Armas simples e marciais',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'cha',
    features: 'Sentido Divino (detectar bem/mal, iguais a 1 + mod CAR/descanso longo), Imposição de Mãos (pool de PV = 5 × nível Paladino), Conjuração (CAR) a partir do nível 2',
    primaryAttr: 'str',
    isSpellcaster: true,
  },
  'Patrulheiro': {
    hitDice: 10,
    savingThrows: ['str', 'dex'],
    armorProfs: 'Leves, médias, escudos',
    weaponProfs: 'Armas simples e marciais',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'wis',
    features: 'Inimigo Favorito (vantagem em TR, rastrear, e recordar informações), Explorador Natural (ignorar terreno difícil, não se perde, dobrar proficiência em INT/SAB em terreno favorito)',
    primaryAttr: 'dex',
    isSpellcaster: true,
  },
  'Feiticeiro': {
    hitDice: 6,
    savingThrows: ['con', 'cha'],
    armorProfs: 'Nenhuma',
    weaponProfs: 'Adagas, dardos, fundas, bordões, bestas leves',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'cha',
    features: 'Conjuração (CAR), Origem de Feitiçaria (escolha subclasse), Pontos de Feitiçaria (igual ao nível, a partir do nível 2)',
    primaryAttr: 'cha',
    isSpellcaster: true,
  },
  'Bruxo': {
    hitDice: 8,
    savingThrows: ['wis', 'cha'],
    armorProfs: 'Leves',
    weaponProfs: 'Armas simples',
    toolProfs: 'Nenhuma',
    spellcastingAbility: 'cha',
    features: 'Patrono Sobrenatural (escolha), Magia do Pacto (espaços recuperados no descanso curto), Invocações Místicas (a partir do nível 2)',
    primaryAttr: 'cha',
    isSpellcaster: true,
  },
};

/* ─────────────────────────────────────────────
   Background Data
───────────────────────────────────────────── */
interface BackgroundData {
  skillProfs: string[];
  toolProfs: string;
  languages: string;
  feature: string;
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

const BACKGROUND_DATA: Record<string, BackgroundData> = {
  'Acólito': {
    skillProfs: ['insight', 'religion'],
    toolProfs: 'Nenhuma',
    languages: '2 idiomas à escolha',
    feature: 'Abrigo dos Fiéis: abrigo e cura em templos.',
    traits: ['Admiro um herói de minha fé.', 'Posso encontrar um terreno comum entre os inimigos mais ferozes.'],
    ideals: ['Tradição: a cristandade dos rituais sagrados deve ser preservada.', 'Caridade: esforço para ajudar os necessitados.'],
    bonds: ['Eu daria minha vida pelos outros membros do meu templo.'],
    flaws: ['Sou inflexível em meu pensamento.'],
  },
  'Criminoso': {
    skillProfs: ['deception', 'stealth'],
    toolProfs: 'Ferramentas de ladrão, 1 tipo de jogo',
    languages: 'Nenhuma',
    feature: 'Contato Criminal: um contato confiável na rede criminosa.',
    traits: ['Tenho sempre um plano para quando as coisas derem errado.'],
    ideals: ['Liberdade: correntes são para servas.'],
    bonds: ['Algo importante foi tomado de mim.'],
    flaws: ['Quando vejo algo valioso, nunca me lembro se é meu.'],
  },
  'Herói do Povo': {
    skillProfs: ['animal_handling', 'survival'],
    toolProfs: '1 tipo de ferramenta de artesão, veículos (terrestres)',
    languages: 'Nenhuma',
    feature: 'Hospitalidade Rústica: o povo simples te abriga.',
    traits: ['Julgo as pessoas por suas ações, não suas palavras.'],
    ideals: ['Respeito: todos merecem ser tratados com dignidade.'],
    bonds: ['Tenho uma família, mas não sei onde estão.'],
    flaws: ['O tirano que governava minha terra ainda me assombra.'],
  },
  'Nobre': {
    skillProfs: ['history', 'persuasion'],
    toolProfs: '1 tipo de jogo',
    languages: '1 idioma à escolha',
    feature: 'Posição de Privilégio: reconhecimento e tratamento preferencial da nobreza.',
    traits: ['Minha palavra favorita é honra.'],
    ideals: ['Nobreza Obriga: minha posição obriga a cuidar das pessoas sob minha proteção.'],
    bonds: ['Fiz um inimigo na corte que continua a me molestar.'],
    flaws: ['Secretamente, acredito que todos estão abaixo de mim.'],
  },
  'Sábio': {
    skillProfs: ['arcana', 'history'],
    toolProfs: 'Nenhuma',
    languages: '2 idiomas à escolha',
    feature: 'Pesquisador: sabe onde encontrar informações que não conhece.',
    traits: ['Uso palavras polissilábicas que dão impressão de erudição.'],
    ideals: ['Conhecimento: o caminho para o poder é pelo conhecimento.'],
    bonds: ['Trabalho para preservar uma biblioteca ou academia.',],
    flaws: ['Não consigo guardar um segredo.'],
  },
  'Soldado': {
    skillProfs: ['athletics', 'intimidation'],
    toolProfs: '1 tipo de jogo, veículos (terrestres)',
    languages: 'Nenhuma',
    feature: 'Hierarquia Militar: oficiais e soldados reconhecem seu posto.',
    traits: ['Sou sempre respeitoso com a autoridade.'],
    ideals: ['Maior Bem: nossa missão era servir para um bem maior.'],
    bonds: ['Alguém salvou minha vida no campo de batalha.'],
    flaws: ['Cometí erros terríveis na batalha que me assombram.'],
  },
  'Forasteiro': {
    skillProfs: ['athletics', 'survival'],
    toolProfs: '1 instrumento musical',
    languages: '1 idioma à escolha',
    feature: 'Andarilho: sempre encontro comida e água para si e até 5 aliados.',
    traits: ['Sou empurrado por uma sensação de destino.'],
    ideals: ['Mudança: a vida é como as estações, em constante mudança.'],
    bonds: ['Uma família devastada pela bestialidade ancora-me ao mundo.'],
    flaws: ['Não me importo com minhas próprias necessidades.'],
  },
  'Charlatão': {
    skillProfs: ['deception', 'sleight_of_hand'],
    toolProfs: 'Ferramentas de disfarce, kit de falsificação',
    languages: 'Nenhuma',
    feature: 'Identidade Falsa: segunda identidade com documentos.',
    traits: ['Tenho uma história para toda situação.'],
    ideals: ['Independência: sou um espírito livre.'],
    bonds: ['Devo dinheiro a um patrono generoso.'],
    flaws: ['Não consigo resistir a enganar alguém que é mais esperto do que eu.'],
  },
  'Artista': {
    skillProfs: ['acrobatics', 'performance'],
    toolProfs: '2 instrumentos musicais',
    languages: 'Nenhuma',
    feature: 'Pela Popularidade: abrigo e comida em troca de performances.',
    traits: ['Sei que sou bom no que faço.'],
    ideals: ['Criatividade: o mundo precisa de novidade.'],
    bonds: ['Quero ser famoso, custe o que custar.'],
    flaws: ['Uma vez que tenho a palavra, dificilmente paro de falar.'],
  },
  'Ermitão': {
    skillProfs: ['medicine', 'religion'],
    toolProfs: 'Kit de herbalismo',
    languages: '1 idioma à escolha',
    feature: 'Descoberta: guarda um segredo ou verdade poderosa.',
    traits: ['Estou em paz com o mundo e me adapto facilmente.'],
    ideals: ['Maior Bem: meu isolamento me deu perspectiva nas maiores ideias do cosmos.'],
    bonds: ['Saí de meu isolamento para proteger alguém querido.'],
    flaws: ['Agora que voltei ao mundo, acho difícil interagir com ele.'],
  },
};

/* ─────────────────────────────────────────────
   Alignment Options
───────────────────────────────────────────── */
const ALIGNMENTS = [
  'Leal Bom', 'Neutro Bom', 'Caótico Bom',
  'Leal Neutro', 'Neutro', 'Caótico Neutro',
  'Leal Mau', 'Neutro Mau', 'Caótico Mau',
];

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface Attack { name: string; bonus: string; damage: string; type: string; }
interface InventoryItem { name: string; qty: number; weight: number; cost: string; notes: string; }
interface SpellEntry { name: string; level: number; school: string; castTime: string; range: string; notes: string; }

export interface SheetData {
  characterName: string;
  playerName: string;
  class: string;
  level: number;
  race: string;
  background: string;
  alignment: string;
  experience: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  savingThrowProfs: Partial<Record<Attr, boolean>>;
  skillProfs: Record<string, 0 | 1 | 2>;
  maxHp: number; currentHp: number; tempHp: number;
  ac: number;
  speedOverride: string;
  hitDiceType: number; hitDiceCurrent: number;
  deathSaveSucc: number; deathSaveFail: number;
  inspiration: boolean;
  personalityTraits: string; ideals: string; bonds: string; flaws: string;
  languages: string;
  armorProfs: string; weaponProfs: string; toolProfs: string;
  features: string;
  attacks: Attack[];
  cp: number; sp: number; gp: number; pp: number;
  backpack: InventoryItem[];
  equipped: InventoryItem[];
  treasure: InventoryItem[];
  spellcastingAbility: Attr | '';
  spellSlotsUsed: number[];
  spells: SpellEntry[];
  notes: string;
}

const defaultSheet = (): SheetData => ({
  characterName: '', playerName: '', class: '', level: 1, race: '',
  background: '', alignment: '', experience: 0,
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  savingThrowProfs: {},
  skillProfs: Object.fromEntries(SKILLS.map(s => [s.name, 0])),
  maxHp: 8, currentHp: 8, tempHp: 0,
  ac: 10, speedOverride: '30', hitDiceType: 8, hitDiceCurrent: 1,
  deathSaveSucc: 0, deathSaveFail: 0, inspiration: false,
  personalityTraits: '', ideals: '', bonds: '', flaws: '',
  languages: 'Comum', armorProfs: '', weaponProfs: '', toolProfs: '', features: '',
  attacks: [{ name: '', bonus: '', damage: '', type: '' }],
  cp: 0, sp: 0, gp: 0, pp: 0,
  backpack: [], equipped: [], treasure: [],
  spellcastingAbility: '', spellSlotsUsed: Array(10).fill(0),
  spells: [], notes: '',
});

/* ─────────────────────────────────────────────
   Apply race/class automation
───────────────────────────────────────────── */
function applyRace(sheet: SheetData, raceName: string): SheetData {
  const race = RACE_DATA[raceName];
  if (!race) return { ...sheet, race: raceName };
  const next = { ...sheet, race: raceName };
  // Apply ASI
  for (const [attr, bonus] of Object.entries(race.asi)) {
    (next as any)[attr] = Math.min(20, (sheet as any)[attr] + (bonus ?? 0));
  }
  next.speedOverride = String(race.speed);
  next.languages = race.languages;
  // Append traits (don't overwrite class features)
  const existingFeatures = next.features.split('\n').filter(l => !l.startsWith('[Raça]'));
  next.features = [`[Raça] ${raceName}:\n${race.traits}`, ...existingFeatures].join('\n\n');
  return next;
}

function applyClass(sheet: SheetData, className: string): SheetData {
  const cls = CLASS_DATA[className];
  if (!cls) return { ...sheet, class: className };
  const next = { ...sheet, class: className };
  next.hitDiceType = cls.hitDice;
  next.hitDiceCurrent = sheet.level;
  // Max HP at level 1 = hit die + con mod
  const conMod = mod(sheet.con);
  next.maxHp = cls.hitDice + conMod;
  next.currentHp = Math.max(1, next.maxHp);
  // Saving throw proficiencies
  const newSaves: Partial<Record<Attr, boolean>> = {};
  cls.savingThrows.forEach(a => { newSaves[a] = true; });
  next.savingThrowProfs = newSaves;
  // Proficiencies
  next.armorProfs = cls.armorProfs;
  next.weaponProfs = cls.weaponProfs;
  next.toolProfs = cls.toolProfs;
  // Spellcasting
  next.spellcastingAbility = cls.spellcastingAbility;
  // Class features
  const existingFeatures = next.features.split('\n\n').filter(l => !l.startsWith('[Classe]'));
  next.features = [`[Classe] ${className} (Nível ${sheet.level}):\n${cls.features}`, ...existingFeatures].join('\n\n');
  return next;
}

function applyBackground(sheet: SheetData, bgName: string): SheetData {
  const bg = BACKGROUND_DATA[bgName];
  if (!bg) return { ...sheet, background: bgName };
  const next = { ...sheet, background: bgName };
  // Mark skill proficiencies
  const newSkillProfs = { ...sheet.skillProfs };
  bg.skillProfs.forEach(skill => {
    if (newSkillProfs[skill] === 0) newSkillProfs[skill] = 1;
  });
  next.skillProfs = newSkillProfs;
  next.toolProfs = [sheet.toolProfs, bg.toolProfs].filter(Boolean).join(', ');
  // Set personality info if empty
  if (!next.personalityTraits && bg.traits.length > 0) next.personalityTraits = bg.traits[0];
  if (!next.ideals && bg.ideals.length > 0) next.ideals = bg.ideals[0];
  if (!next.bonds && bg.bonds.length > 0) next.bonds = bg.bonds[0];
  if (!next.flaws && bg.flaws.length > 0) next.flaws = bg.flaws[0];
  // Append background feature
  const existingFeatures = next.features.split('\n\n').filter(l => !l.startsWith('[Antecedente]'));
  next.features = [...existingFeatures, `[Antecedente] ${bgName}:\n${bg.feature}`].join('\n\n');
  return next;
}

/* ─────────────────────────────────────────────
   UI Sub-components (defined OUTSIDE to preserve focus)
───────────────────────────────────────────── */
interface NProps { val: number; onChange: (v: number) => void; min?: number; max?: number; className?: string; readOnly?: boolean; }
const N = ({ val, onChange, min, max, className = '', readOnly }: NProps) => (
  <input
    type="number" value={val}
    min={min} max={max}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(parseInt(e.target.value) || 0)}
    className={`bg-secondary border border-border rounded px-1 text-center text-sm font-display text-foreground focus:outline-none focus:border-gold/50 ${readOnly ? 'opacity-70 cursor-default' : ''} ${className}`}
  />
);

interface TFProps { val: string; onChange: (v: string) => void; placeholder?: string; className?: string; readOnly?: boolean; }
const TF = ({ val, onChange, placeholder = '', className = '', readOnly }: TFProps) => (
  <input
    type="text" value={val} placeholder={placeholder}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(e.target.value)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${readOnly ? 'opacity-70 cursor-default' : ''} ${className}`}
  />
);

interface TAProps { val: string; onChange: (v: string) => void; placeholder?: string; rows?: number; readOnly?: boolean; }
const TA = ({ val, onChange, placeholder = '', rows = 3, readOnly }: TAProps) => (
  <textarea
    value={val} placeholder={placeholder} rows={rows}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(e.target.value)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full resize-none ${readOnly ? 'opacity-70 cursor-default' : ''}`}
  />
);

interface CheckboxProps { checked: boolean; onChange: (v: boolean) => void; label?: string; readOnly?: boolean; }
const Checkbox = ({ checked, onChange, label, readOnly }: CheckboxProps) => (
  <label className="flex items-center gap-1 cursor-pointer">
    <span
      onClick={() => !readOnly && onChange(!checked)}
      className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center text-[10px] transition-colors ${checked ? 'bg-gold border-gold text-background' : 'border-border bg-secondary'} ${readOnly ? 'opacity-70 cursor-default' : ''}`}
    >
      {checked ? '✓' : ''}
    </span>
    {label && <span className="text-xs text-muted-foreground">{label}</span>}
  </label>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-display text-gold/80 tracking-widest uppercase border-b border-gold/20 pb-0.5 mb-2">{children}</div>
);

interface SelectProps { val: string; onChange: (v: string) => void; options: string[]; placeholder?: string; className?: string; readOnly?: boolean; }
const Sel = ({ val, onChange, options, placeholder, className = '', readOnly }: SelectProps) => (
  <select
    value={val}
    disabled={readOnly}
    onChange={e => onChange(e.target.value)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${readOnly ? 'opacity-70 cursor-default' : ''} ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export interface CharacterSheetProps {
  sessionId: string;
  onClose: () => void;
  /** When GM opens another player's sheet, pass that player's id here */
  targetPlayerId?: string;
  /** Name shown in header when viewing another player's sheet */
  targetPlayerName?: string;
  /** Read-only for non-owners viewing other sheets */
  readOnly?: boolean;
}

type Tab = 'main' | 'combat' | 'spells' | 'inventory';

export default function CharacterSheet({ sessionId, onClose, targetPlayerId, targetPlayerName, readOnly = false }: CharacterSheetProps) {
  const { player, role } = useAuth();
  const [sheet, setSheet] = useState<SheetData>(defaultSheet());
  const [tab, setTab] = useState<Tab>('main');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const isDm = role === 'dm';

  // The actual player whose sheet we're showing
  const ownerId = targetPlayerId ?? player?.id;
  // DM can always edit; others can only edit their own
  const canEdit = !readOnly && (isDm || ownerId === player?.id);

  useEffect(() => {
    const load = async () => {
      if (!ownerId) return;
      const { data } = await supabase
        .from('character_sheets' as any)
        .select('data')
        .eq('session_id', sessionId)
        .eq('player_id', ownerId)
        .maybeSingle();
      if (data?.data) setSheet({ ...defaultSheet(), ...(data.data as Partial<SheetData>) });
      else setSheet(defaultSheet());
      setDirty(false);
    };
    load();
  }, [sessionId, ownerId]);

  const set = useCallback(<K extends keyof SheetData>(key: K, value: SheetData[K]) => {
    setSheet(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const save = async () => {
    if (!ownerId) return;
    setSaving(true);
    const { error } = await supabase
      .from('character_sheets' as any)
      .upsert({
        session_id: sessionId,
        player_id: ownerId,
        data: sheet as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id,player_id' });
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Ficha salva!'); setDirty(false); }
  };

  const handleClassChange = (className: string) => {
    setSheet(prev => applyClass(prev, className));
    setDirty(true);
  };

  const handleRaceChange = (raceName: string) => {
    setSheet(prev => applyRace(prev, raceName));
    setDirty(true);
  };

  const handleBackgroundChange = (bgName: string) => {
    setSheet(prev => applyBackground(prev, bgName));
    setDirty(true);
  };

  const pb = profBonus(sheet.level);
  const attrMod = (a: Attr) => mod(sheet[a]);
  const skillBonus = (s: typeof SKILLS[0]) => {
    const base = attrMod(s.attr);
    const prof = sheet.skillProfs[s.name] ?? 0;
    return base + (prof === 1 ? pb : prof === 2 ? pb * 2 : 0);
  };
  const saveBonus = (a: Attr) => attrMod(a) + (sheet.savingThrowProfs[a] ? pb : 0);
  const passivePerc = 10 + skillBonus(SKILLS.find(s => s.name === 'perception')!);
  const initiative = attrMod('dex');
  const defaultSlots = SPELL_SLOTS_BY_LEVEL[sheet.level] ?? Array(10).fill(0);

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'main', label: 'Principal', icon: BookOpen },
    { id: 'combat', label: 'Combate', icon: Sword },
    { id: 'spells', label: 'Magias', icon: Sparkles },
    { id: 'inventory', label: 'Inventário', icon: Package },
  ];

  const headerLabel = targetPlayerName ? `Ficha de ${targetPlayerName}` : (isDm && targetPlayerId ? 'Ficha do Jogador' : 'Minha Ficha');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 backdrop-blur-sm p-2 sm:p-4 overflow-auto">
      <div className="bg-card-gradient border border-border rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground font-display mb-0.5">{headerLabel}{readOnly ? ' (somente leitura)' : ''}</div>
            <input
              value={sheet.characterName}
              onChange={e => canEdit && set('characterName', e.target.value)}
              readOnly={!canEdit}
              placeholder="Nome do Personagem"
              className="bg-transparent text-xl font-display text-foreground focus:outline-none w-full placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="flex items-center gap-2">
            {dirty && canEdit && (
              <Button size="sm" onClick={save} disabled={saving} className="font-display text-xs h-7">
                <Save className="w-3 h-3 mr-1" />{saving ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
            <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-display transition-colors flex items-center justify-center gap-1.5 ${
                tab === t.id ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">

          {/* ══════════ TAB: PRINCIPAL ══════════ */}
          {tab === 'main' && (
            <div className="space-y-4">

              {/* Character info row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Classe</label>
                  {canEdit ? (
                    <Sel
                      val={sheet.class}
                      onChange={handleClassChange}
                      options={Object.keys(CLASS_DATA)}
                      placeholder="— Escolha —"
                    />
                  ) : (
                    <TF val={sheet.class} onChange={() => {}} readOnly />
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Raça</label>
                  {canEdit ? (
                    <Sel
                      val={sheet.race}
                      onChange={handleRaceChange}
                      options={Object.keys(RACE_DATA)}
                      placeholder="— Escolha —"
                    />
                  ) : (
                    <TF val={sheet.race} onChange={() => {}} readOnly />
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Antecedente</label>
                  {canEdit ? (
                    <Sel
                      val={sheet.background}
                      onChange={handleBackgroundChange}
                      options={Object.keys(BACKGROUND_DATA)}
                      placeholder="— Escolha —"
                    />
                  ) : (
                    <TF val={sheet.background} onChange={() => {}} readOnly />
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Alinhamento</label>
                  {canEdit ? (
                    <Sel val={sheet.alignment} onChange={v => set('alignment', v)} options={ALIGNMENTS} placeholder="— Escolha —" />
                  ) : (
                    <TF val={sheet.alignment} onChange={() => {}} readOnly />
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Nível</label>
                  <N val={sheet.level} onChange={v => set('level', Math.max(1, Math.min(20, v)))} min={1} max={20} className="w-full h-8" readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Experiência</label>
                  <N val={sheet.experience} onChange={v => set('experience', v)} className="w-full h-8" readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Jogador</label>
                  <TF val={sheet.playerName || targetPlayerName || player?.name || ''} onChange={v => set('playerName', v)} readOnly={!canEdit} />
                </div>
                <div className="flex items-end">
                  <Checkbox checked={sheet.inspiration} onChange={v => set('inspiration', v)} label="Inspiração" readOnly={!canEdit} />
                </div>
              </div>

              {/* Auto-fill note when class/race is empty */}
              {canEdit && (!sheet.class || !sheet.race) && (
                <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-xs text-gold/90 font-display">
                  Selecione Classe e Raça acima para preenchimento automático dos atributos, proficiências e habilidades.
                </div>
              )}

              {/* Attributes */}
              <div>
                <SectionTitle>Atributos</SectionTitle>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ATTRIBUTES.map(a => (
                    <div key={a} className="bg-secondary/50 border border-border rounded-lg p-2 text-center">
                      <div className="text-[10px] font-display text-gold/80">{ATTR_SHORT[a]}</div>
                      <div className="text-2xl font-display text-gold my-0.5">{modStr(sheet[a])}</div>
                      <N val={sheet[a]} onChange={v => set(a, Math.max(1, Math.min(30, v)))} min={1} max={30} className="w-full h-7 text-xs" readOnly={!canEdit} />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="font-display">Bônus de Proficiência: <span className="text-gold">+{pb}</span></span>
                  <span className="font-display">Percepção Passiva: <span className="text-gold">{passivePerc}</span></span>
                  <span className="font-display">Iniciativa: <span className="text-gold">{modStr(initiative)}</span></span>
                  <span className="font-display">Deslocamento: <span className="text-gold">{sheet.speedOverride}ft</span></span>
                </div>
              </div>

              {/* Saving throws & Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <SectionTitle>Testes de Resistência</SectionTitle>
                  <div className="space-y-1">
                    {ATTRIBUTES.map(a => (
                      <label key={a} className="flex items-center gap-2 cursor-pointer group">
                        <Checkbox
                          checked={!!sheet.savingThrowProfs[a]}
                          onChange={v => canEdit && set('savingThrowProfs', { ...sheet.savingThrowProfs, [a]: v })}
                          readOnly={!canEdit}
                        />
                        <span className={`text-xs font-display w-8 ${saveBonus(a) >= 0 ? 'text-green-400' : 'text-foreground'}`}>
                          {saveBonus(a) >= 0 ? '+' : ''}{saveBonus(a)}
                        </span>
                        <span className="text-xs text-muted-foreground">{ATTR_LABELS[a]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Perícias</SectionTitle>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                    {SKILLS.map(s => {
                      const prof = sheet.skillProfs[s.name] ?? 0;
                      const bonus = skillBonus(s);
                      return (
                        <label key={s.name} className="flex items-center gap-1.5 cursor-pointer group">
                          <button
                            onClick={() => {
                              if (!canEdit) return;
                              const next = (prof + 1) % 3 as 0 | 1 | 2;
                              set('skillProfs', { ...sheet.skillProfs, [s.name]: next });
                            }}
                            className={`w-4 h-4 rounded-sm border text-[9px] flex items-center justify-center transition-colors ${
                              prof === 2 ? 'bg-gold border-gold text-background' : prof === 1 ? 'bg-gold/40 border-gold/60' : 'border-border bg-secondary'
                            } ${!canEdit ? 'cursor-default opacity-70' : ''}`}
                            title={prof === 0 ? 'Sem proficiência' : prof === 1 ? 'Proficiente' : 'Expertise'}
                          >
                            {prof > 0 ? '◆' : ''}
                          </button>
                          <span className={`text-xs font-display w-7 ${bonus >= 0 ? 'text-green-400' : 'text-foreground'}`}>
                            {bonus >= 0 ? '+' : ''}{bonus}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                          <span className="text-[10px] text-muted-foreground/50 ml-auto">{ATTR_SHORT[s.attr]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Character description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <SectionTitle>Traços de Personalidade</SectionTitle>
                  <TA val={sheet.personalityTraits} onChange={v => set('personalityTraits', v)} rows={2} readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Ideais</SectionTitle>
                  <TA val={sheet.ideals} onChange={v => set('ideals', v)} rows={2} readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Vínculos</SectionTitle>
                  <TA val={sheet.bonds} onChange={v => set('bonds', v)} rows={2} readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Defeitos</SectionTitle>
                  <TA val={sheet.flaws} onChange={v => set('flaws', v)} rows={2} readOnly={!canEdit} />
                </div>
              </div>

              {/* Proficiencies & Languages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <SectionTitle>Idiomas</SectionTitle>
                  <TF val={sheet.languages} onChange={v => set('languages', v)} placeholder="Comum, Élfico..." readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Proficiências de Armadura</SectionTitle>
                  <TF val={sheet.armorProfs} onChange={v => set('armorProfs', v)} readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Proficiências de Arma</SectionTitle>
                  <TF val={sheet.weaponProfs} onChange={v => set('weaponProfs', v)} readOnly={!canEdit} />
                </div>
                <div>
                  <SectionTitle>Ferramentas</SectionTitle>
                  <TF val={sheet.toolProfs} onChange={v => set('toolProfs', v)} readOnly={!canEdit} />
                </div>
              </div>

              {/* Features */}
              <div>
                <SectionTitle>Características e Habilidades</SectionTitle>
                <TA val={sheet.features} onChange={v => set('features', v)} rows={6} placeholder="As características da sua classe, raça e antecedente aparecem aqui ao selecioná-las acima." readOnly={!canEdit} />
              </div>
            </div>
          )}

          {/* ══════════ TAB: COMBATE ══════════ */}
          {tab === 'combat' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                  <div className="text-[10px] font-display text-gold/80">CA</div>
                  <N val={sheet.ac} onChange={v => set('ac', v)} className="w-full h-10 text-xl" readOnly={!canEdit} />
                </div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                  <div className="text-[10px] font-display text-gold/80">Iniciativa</div>
                  <div className="text-2xl font-display text-gold">{modStr(initiative)}</div>
                </div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                  <div className="text-[10px] font-display text-gold/80">Deslocamento</div>
                  <div className="flex items-center justify-center gap-1">
                    <input
                      value={sheet.speedOverride}
                      onChange={e => canEdit && set('speedOverride', e.target.value)}
                      readOnly={!canEdit}
                      className="bg-secondary border border-border rounded w-16 h-10 text-xl font-display text-gold text-center focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground">ft</span>
                  </div>
                </div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                  <div className="text-[10px] font-display text-gold/80">Dados de Vida</div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-muted-foreground text-sm">{sheet.level}d</span>
                    <N val={sheet.hitDiceType} onChange={v => set('hitDiceType', v)} className="w-14 h-10 text-xl" readOnly={!canEdit} />
                  </div>
                </div>
              </div>

              {/* HP */}
              <div>
                <SectionTitle>Pontos de Vida</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <label className="text-[10px] text-muted-foreground font-display block mb-1">Máximo</label>
                    <N val={sheet.maxHp} onChange={v => set('maxHp', v)} className="w-full h-12 text-xl" readOnly={!canEdit} />
                  </div>
                  <div className="text-center">
                    <label className="text-[10px] text-muted-foreground font-display block mb-1">Atual</label>
                    <N val={sheet.currentHp} onChange={v => set('currentHp', Math.min(v, sheet.maxHp + sheet.tempHp))} className="w-full h-12 text-2xl" readOnly={!canEdit} />
                  </div>
                  <div className="text-center">
                    <label className="text-[10px] text-muted-foreground font-display block mb-1">Temporários</label>
                    <N val={sheet.tempHp} onChange={v => set('tempHp', v)} className="w-full h-12 text-xl" readOnly={!canEdit} />
                  </div>
                </div>
                <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, (sheet.currentHp / Math.max(1, sheet.maxHp)) * 100)}%`,
                      backgroundColor: sheet.currentHp / sheet.maxHp > 0.5 ? '#2ecc71' : sheet.currentHp / sheet.maxHp > 0.25 ? '#f1c40f' : '#e74c3c',
                    }}
                  />
                </div>
              </div>

              {/* Dados de vida + Death saves */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SectionTitle>Dados de Vida Restantes</SectionTitle>
                  <div className="flex items-center gap-2">
                    <N val={sheet.hitDiceCurrent} onChange={v => set('hitDiceCurrent', Math.max(0, Math.min(sheet.level, v)))} min={0} max={sheet.level} className="w-16 h-9" readOnly={!canEdit} />
                    <span className="text-xs text-muted-foreground">/ {sheet.level} × d{sheet.hitDiceType}</span>
                  </div>
                </div>
                <div>
                  <SectionTitle>Testes de Morte</SectionTitle>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 font-display w-12">Sucesso</span>
                      {[0, 1, 2].map(i => (
                        <Checkbox key={i} checked={sheet.deathSaveSucc > i}
                          onChange={() => canEdit && set('deathSaveSucc', sheet.deathSaveSucc === i + 1 ? i : i + 1)}
                          readOnly={!canEdit} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive font-display w-12">Falha</span>
                      {[0, 1, 2].map(i => (
                        <Checkbox key={i} checked={sheet.deathSaveFail > i}
                          onChange={() => canEdit && set('deathSaveFail', sheet.deathSaveFail === i + 1 ? i : i + 1)}
                          readOnly={!canEdit} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attacks */}
              <div>
                <SectionTitle>Ataques</SectionTitle>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-display px-1">
                    <span className="col-span-4">Nome</span>
                    <span className="col-span-2">Bônus</span>
                    <span className="col-span-3">Dano</span>
                    <span className="col-span-2">Tipo</span>
                    <span className="col-span-1" />
                  </div>
                  {sheet.attacks.map((atk, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1">
                      <input value={atk.name} readOnly={!canEdit}
                        onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], name: e.target.value }; set('attacks', a); }}
                        placeholder="Espada Longa" className="col-span-4 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      <input value={atk.bonus} readOnly={!canEdit}
                        onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], bonus: e.target.value }; set('attacks', a); }}
                        placeholder="+5" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground text-center focus:outline-none" />
                      <input value={atk.damage} readOnly={!canEdit}
                        onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], damage: e.target.value }; set('attacks', a); }}
                        placeholder="1d8+3" className="col-span-3 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground text-center focus:outline-none" />
                      <input value={atk.type} readOnly={!canEdit}
                        onChange={e => { const a = [...sheet.attacks]; a[i] = { ...a[i], type: e.target.value }; set('attacks', a); }}
                        placeholder="cortante" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      {canEdit && (
                        <button onClick={() => set('attacks', sheet.attacks.filter((_, j) => j !== i))}
                          className="col-span-1 text-destructive hover:bg-destructive/10 rounded text-xs">✕</button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 font-display"
                      onClick={() => set('attacks', [...sheet.attacks, { name: '', bonus: '', damage: '', type: '' }])}>
                      + Adicionar Ataque
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <SectionTitle>Notas de Combate</SectionTitle>
                <TA val={sheet.notes} onChange={v => set('notes', v)} rows={3} placeholder="Condições, habilidades especiais..." readOnly={!canEdit} />
              </div>
            </div>
          )}

          {/* ══════════ TAB: MAGIAS ══════════ */}
          {tab === 'spells' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Atributo de Conjuração</label>
                  {canEdit ? (
                    <Sel
                      val={sheet.spellcastingAbility}
                      onChange={v => set('spellcastingAbility', v as Attr | '')}
                      options={ATTRIBUTES as unknown as string[]}
                      placeholder="— Nenhum —"
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-foreground">
                      {sheet.spellcastingAbility ? ATTR_LABELS[sheet.spellcastingAbility] : '— Nenhum —'}
                    </div>
                  )}
                </div>
                {sheet.spellcastingAbility && (
                  <div className="flex gap-3 text-xs font-display">
                    <div className="text-center">
                      <div className="text-muted-foreground">CD</div>
                      <div className="text-gold text-lg">{8 + pb + attrMod(sheet.spellcastingAbility)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Bônus Ataque</div>
                      <div className="text-gold text-lg">{modStr(pb + attrMod(sheet.spellcastingAbility))}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Modificador</div>
                      <div className="text-gold text-lg">{modStr(attrMod(sheet.spellcastingAbility))}</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <SectionTitle>Espaços de Magia</SectionTitle>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {SPELL_LEVELS.map((label, i) => {
                    const total = defaultSlots[i];
                    const used = sheet.spellSlotsUsed[i] || 0;
                    if (i > 0 && total === 0) return null;
                    return (
                      <div key={i} className="text-center">
                        <div className="text-[10px] font-display text-gold/70 mb-1">{label}</div>
                        <div className="flex flex-col gap-0.5 items-center">
                          {Array.from({ length: total || (i === 0 ? 4 : 0) }).map((_, j) => (
                            <button key={j}
                              onClick={() => {
                                if (!canEdit) return;
                                const next = [...(sheet.spellSlotsUsed || Array(10).fill(0))];
                                next[i] = j < used ? j : j + 1;
                                set('spellSlotsUsed', next);
                              }}
                              className={`w-4 h-4 rounded-full border transition-colors ${j < used ? 'bg-muted border-border' : 'bg-gold border-gold'} ${!canEdit ? 'cursor-default' : ''}`}
                            />
                          ))}
                          {total === 0 && i === 0 && <span className="text-[10px] text-muted-foreground">∞</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <SectionTitle>Lista de Magias</SectionTitle>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-display px-1">
                    <span className="col-span-4">Nome</span>
                    <span className="col-span-1">Nv</span>
                    <span className="col-span-2">Escola</span>
                    <span className="col-span-2">Tempo</span>
                    <span className="col-span-2">Alcance</span>
                    <span className="col-span-1" />
                  </div>
                  {sheet.spells.map((sp, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1">
                      <input value={sp.name} readOnly={!canEdit}
                        onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], name: e.target.value }; set('spells', s); }}
                        placeholder="Míssil Mágico" className="col-span-4 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      <input value={sp.level} type="number" min={0} max={9} readOnly={!canEdit}
                        onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], level: parseInt(e.target.value)||0 }; set('spells', s); }}
                        className="col-span-1 bg-secondary border border-border rounded px-1 py-1 text-xs text-center text-foreground focus:outline-none" />
                      <input value={sp.school} readOnly={!canEdit}
                        onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], school: e.target.value }; set('spells', s); }}
                        placeholder="Evocação" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      <input value={sp.castTime} readOnly={!canEdit}
                        onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], castTime: e.target.value }; set('spells', s); }}
                        placeholder="1 ação" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      <input value={sp.range} readOnly={!canEdit}
                        onChange={e => { const s = [...sheet.spells]; s[i] = { ...s[i], range: e.target.value }; set('spells', s); }}
                        placeholder="120ft" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                      {canEdit && (
                        <button onClick={() => set('spells', sheet.spells.filter((_, j) => j !== i))}
                          className="col-span-1 text-destructive hover:bg-destructive/10 rounded text-xs">✕</button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 font-display"
                      onClick={() => set('spells', [...sheet.spells, { name: '', level: 0, school: '', castTime: '1 ação', range: '', notes: '' }])}>
                      + Adicionar Magia
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB: INVENTÁRIO ══════════ */}
          {tab === 'inventory' && (
            <div className="space-y-4">
              <div>
                <SectionTitle>Moedas</SectionTitle>
                <div className="grid grid-cols-4 gap-3">
                  {([['cp', 'PC'], ['sp', 'PP'], ['gp', 'PO'], ['pp', 'PL']] as [keyof SheetData, string][]).map(([key, label]) => (
                    <div key={key} className="text-center bg-secondary/50 border border-border rounded-lg p-2">
                      <div className="text-[10px] font-display text-gold/70">{label}</div>
                      <N val={sheet[key] as number} onChange={v => set(key, v)} className="w-full h-9 mt-1" readOnly={!canEdit} />
                    </div>
                  ))}
                </div>
              </div>

              {(['backpack', 'equipped', 'treasure'] as const).map(section => {
                const labels = { backpack: 'Mochila', equipped: 'Equipado', treasure: 'Tesouro' };
                const items: InventoryItem[] = (sheet[section] as InventoryItem[]) || [];
                return (
                  <div key={section}>
                    <SectionTitle>{labels[section]}</SectionTitle>
                    <div className="space-y-1">
                      <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-display px-1">
                        <span className="col-span-1">#</span>
                        <span className="col-span-5">Item</span>
                        <span className="col-span-2">Peso</span>
                        <span className="col-span-2">Custo</span>
                        <span className="col-span-2" />
                      </div>
                      {items.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-1">
                          <input type="number" value={item.qty} min={1} readOnly={!canEdit}
                            onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], qty: parseInt(e.target.value)||1 }; set(section, arr); }}
                            className="col-span-1 bg-secondary border border-border rounded px-1 py-1 text-xs text-center text-foreground focus:outline-none" />
                          <input value={item.name} readOnly={!canEdit}
                            onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], name: e.target.value }; set(section, arr); }}
                            placeholder="Espada..." className="col-span-5 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                          <input value={item.weight} type="number" readOnly={!canEdit}
                            onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], weight: parseFloat(e.target.value)||0 }; set(section, arr); }}
                            placeholder="0" className="col-span-2 bg-secondary border border-border rounded px-1 py-1 text-xs text-center text-foreground focus:outline-none" />
                          <input value={item.cost} readOnly={!canEdit}
                            onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], cost: e.target.value }; set(section, arr); }}
                            placeholder="0 PO" className="col-span-2 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none" />
                          {canEdit && (
                            <button onClick={() => set(section, items.filter((_, j) => j !== i))}
                              className="col-span-2 text-destructive hover:bg-destructive/10 rounded text-xs">✕</button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="text-xs h-7 font-display"
                          onClick={() => set(section, [...items, { name: '', qty: 1, weight: 0, cost: '', notes: '' }])}>
                          + Adicionar Item
                        </Button>
                      )}
                      <div className="text-[10px] text-muted-foreground text-right">
                        Peso total: {items.reduce((s, it) => s + (it.weight * it.qty), 0).toFixed(1)} lbs
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="p-3 border-t border-border flex justify-end shrink-0">
            <Button onClick={save} disabled={saving || !dirty} className="font-display text-sm">
              <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Ficha'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

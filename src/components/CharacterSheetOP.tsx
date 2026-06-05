import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { X, Save, BookOpen, Sword, Sparkles, Package, Skull, ScrollText, Plus, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import RitualCast from './RitualCast';
import TokenImagePicker from './TokenImagePicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import {
  OP_ATTRIBUTES,
  OP_ATTR_LABELS,
  OP_ATTR_SHORT,
  OP_AGE_BRACKETS,
  OP_AGE_DRAWBACKS,
  OP_CLASSES,
  OP_CLASS_ABILITIES,
  OP_GENERAL_ABILITIES,
  OP_ORIGENS,
  OP_PERICIAS,
  defaultOPSheet,
  getOPAgeAttrMax,
  getOPAgeBaseDeslocamento,
  getOPAgeDefesaBonus,
  getOPAgeDeslocamentoPenalty,
  getOPAgeNexBonus,
  getOPAgePEFlatBonus,
  getOPAgePEPenaltyPerLevel,
  getOPAgePVPenaltyPerLevel,
  getOPAgeRequiredDrawbacks,
  type OPClassAbility,
  type OPClasse,
  type OPAgeBracket,
  type OPGeneralAbility,
  type OPOrigemData,
  type OPProficiencia,
  type OPSheetData,
  type OPRitual,
  type InventoryItem,
  type OPAtaque,
  opSkillBonus,
  calcOPDefesa,
  calcOPMaxSAN,
  calcOPMaxPE,
  calcOPMaxPV,
} from '@/lib/systems';

interface OPBestiaryCreature {
  nome: string;
  nex: number;
  pv: number;
  defesa: number;
  dano: string;
  descricao: string;
}

interface OPSheetExtra extends OPSheetData {
  condicoes?: string[];
  bestiario?: OPBestiaryCreature[];
  // Avatar do personagem usado como token. Quando preenchido, sobrescreve
  // a foto de perfil do jogador na hora de criar/recriar o token no mapa.
  tokenImageUrl?: string | null;
  tokenImageOffsetX?: number;
  tokenImageOffsetY?: number;
}

export interface CharacterSheetOPProps {
  sessionId: string;
  onClose: () => void;
  targetPlayerId?: string;
  targetPlayerName?: string;
  readOnly?: boolean;
}

type Tab = 'principal' | 'combate' | 'habilidades' | 'rituais' | 'inventario' | 'bestiario';

const CLASS_FILTERS: OPClasse[] = ['Combatente', 'Ocultista', 'Especialista'];

const OP_CONDICOES = [
  'Agarrado',
  'Caido',
  'Inconsciente',
  'Paralisado',
  'Envenenado',
  'Cego',
  'Surdo',
  'Enfraquecido',
  'Apavorado',
  'Atordoado',
  'Exausto',
  'Sangrando',
] as const;

const PROF_LABEL: Record<OPProficiencia, string> = {
  0: 'Sem treinamento',
  1: 'Treinado',
  2: 'Experiente',
  3: 'Expert',
};

const PROF_BONUS: Record<OPProficiencia, number> = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
};

const ELEMENTOS_PADRAO = ['Morte', 'Sangue', 'Energia', 'Conhecimento'];

interface OPInventoryCatalogItem {
  catalog: OPCatalogType;
  name: string;
  group: string;
  category: number;
  damage: string;
  critical: string;
  range?: string;
  damageType: string;
  spaces: number;
  ammo?: string;
  description: string;
  cost?: string;
}

type OPCatalogType = 'armas' | 'municao' | 'protecao' | 'itens_gerais' | 'itens_amaldicoados';

const OP_CATALOG_TABS: Array<{ id: OPCatalogType; label: string }> = [
  { id: 'armas', label: 'Armas' },
  { id: 'municao', label: 'Municao' },
  { id: 'protecao', label: 'Protecoes' },
  { id: 'itens_gerais', label: 'Itens Gerais' },
  { id: 'itens_amaldicoados', label: 'Itens Amaldicoados' },
];

const OP_ITEM_CATALOG: OPInventoryCatalogItem[] = [
  {
    catalog: 'armas',
    name: 'Acha',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '1d12',
    critical: 'x3',
    damageType: 'Corte',
    spaces: 2,
    description: 'Um machado grande e pesado, usado no corte de arvores largas.',
  },
  {
    catalog: 'armas',
    name: 'Arco',
    group: 'Armas Simples - Arma de Disparo - Duas Maos',
    category: 0,
    damage: '1d6',
    critical: 'x3',
    range: 'Medio',
    damageType: 'Perfuracao',
    spaces: 2,
    ammo: 'Flechas',
    description: 'Um arco e flecha comum, proprio para tiro ao alvo.',
  },
  {
    catalog: 'armas',
    name: 'Arco Composto',
    group: 'Armas Taticas - Arma de Disparo - Duas Maos',
    category: 1,
    damage: '1d10',
    critical: 'x3',
    range: 'Medio',
    damageType: 'Perfuracao',
    spaces: 2,
    ammo: 'Flechas',
    description: 'Arco moderno com roldanas. Permite aplicar Forca no dano.',
  },
  {
    catalog: 'armas',
    name: 'Balestra',
    group: 'Armas Taticas - Arma de Disparo - Duas Maos',
    category: 1,
    damage: '1d12',
    critical: '19',
    range: 'Medio',
    damageType: 'Perfuracao',
    spaces: 2,
    ammo: 'Flechas',
    description: 'Besta pesada. Exige acao de movimento para recarregar a cada disparo.',
  },
  {
    catalog: 'armas',
    name: 'Bastao',
    group: 'Armas Simples - Corpo a Corpo - Uma Mao',
    category: 0,
    damage: '1d6/1d8',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 1,
    description: 'Pode ser empunhado com uma mao (1d6) ou duas maos (1d8).',
  },
  {
    catalog: 'armas',
    name: 'Bazuca',
    group: 'Armas Pesadas - Arma de Fogo - Duas Maos',
    category: 3,
    damage: '10d8',
    critical: 'x2',
    range: 'Medio',
    damageType: 'Impacto',
    spaces: 2,
    ammo: 'Foguete',
    description: 'Lanca-foguetes anti-tanque com dano em area (raio de 3m). Recarrega com acao de movimento.',
  },
  {
    catalog: 'armas',
    name: 'Besta',
    group: 'Armas Simples - Arma de Disparo - Duas Maos',
    category: 0,
    damage: '1d8',
    critical: '19',
    range: 'Medio',
    damageType: 'Perfuracao',
    spaces: 2,
    ammo: 'Flechas',
    description: 'Arma antiga que exige acao de movimento para recarregar a cada disparo.',
  },
  {
    catalog: 'armas',
    name: 'Cajado',
    group: 'Armas Simples - Corpo a Corpo - Duas Maos',
    category: 0,
    damage: '1d6/1d6',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 2,
    description: 'Arma agil que pode ser usada com Combater com Duas Armas para ataques adicionais.',
  },
  {
    catalog: 'armas',
    name: 'Coronhada',
    group: 'Armas Simples - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d4/1d6',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 0,
    description: 'Ataque corpo a corpo com arma de fogo. 1d4 para leves/uma mao e 1d6 para duas maos.',
  },
  {
    catalog: 'armas',
    name: 'Corrente',
    group: 'Armas Taticas - Corpo a Corpo - Uma Mao',
    category: 0,
    damage: '1d8',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 1,
    description: 'Fornece +2 em testes para desarmar e derrubar.',
  },
  {
    catalog: 'armas',
    name: 'Espada',
    group: 'Armas Taticas - Corpo a Corpo - Uma Mao',
    category: 1,
    damage: '1d8/1d10',
    critical: '19',
    damageType: 'Corte',
    spaces: 1,
    description: 'Pode ser empunhada com uma mao (1d8) ou duas maos (1d10).',
  },
  {
    catalog: 'armas',
    name: 'Espingarda',
    group: 'Armas Taticas - Arma de Fogo - Duas Maos',
    category: 1,
    damage: '4d6',
    critical: 'x3',
    range: 'Curto',
    damageType: 'Balistico',
    spaces: 2,
    ammo: 'Cartuchos',
    description: 'Causa metade do dano em alcance medio ou maior.',
  },
  {
    catalog: 'armas',
    name: 'Faca',
    group: 'Armas Simples - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d4',
    critical: '19',
    range: 'Curto',
    damageType: 'Corte',
    spaces: 1,
    description: 'Arma agil que pode ser arremessada.',
  },
  {
    catalog: 'armas',
    name: 'Florete',
    group: 'Armas Taticas - Corpo a Corpo - Uma Mao',
    category: 1,
    damage: '1d6',
    critical: '18',
    damageType: 'Corte',
    spaces: 1,
    description: 'Espada de esgrima. E uma arma agil.',
  },
  {
    catalog: 'armas',
    name: 'Fuzil de Assalto',
    group: 'Armas Taticas - Arma de Fogo - Duas Maos',
    category: 2,
    damage: '2d10',
    critical: '19/x3',
    range: 'Medio',
    damageType: 'Balistico',
    spaces: 2,
    ammo: 'Balas Longas',
    description: 'Arma automatica padrao de forcas militares.',
  },
  {
    catalog: 'armas',
    name: 'Fuzil de Caca',
    group: 'Armas Simples - Arma de Fogo - Duas Maos',
    category: 1,
    damage: '2d8',
    critical: '19/x3',
    range: 'Medio',
    damageType: 'Balistico',
    spaces: 2,
    ammo: 'Balas Longas',
    description: 'Arma comum entre cacadores e atiradores esportivos.',
  },
  {
    catalog: 'armas',
    name: 'Fuzil de Precisao',
    group: 'Armas Taticas - Arma de Fogo - Duas Maos',
    category: 3,
    damage: '2d10',
    critical: '19/x3',
    range: 'Longo',
    damageType: 'Balistico',
    spaces: 2,
    ammo: 'Balas Longas',
    description: 'Projetado para disparos longos e precisos.',
  },
  {
    catalog: 'armas',
    name: 'Gadanho',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '2d4',
    critical: 'x4',
    damageType: 'Corte',
    spaces: 2,
    description: 'Ferramenta agricola adaptada para combate.',
  },
  {
    catalog: 'armas',
    name: 'Katana',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '1d10',
    critical: '19',
    damageType: 'Corte',
    spaces: 2,
    description: 'Arma agil. Veterano em Luta pode usa-la com uma mao.',
  },
  {
    catalog: 'armas',
    name: 'Lanca',
    group: 'Armas Simples - Corpo a Corpo - Uma Mao',
    category: 0,
    damage: '1d6',
    critical: 'x2',
    range: 'Curto',
    damageType: 'Perfuracao',
    spaces: 1,
    description: 'Pode ser arremessada.',
  },
  {
    catalog: 'armas',
    name: 'Lanca-chamas',
    group: 'Armas Pesadas - Arma de Fogo - Duas Maos',
    category: 3,
    damage: '6d6',
    critical: 'x2',
    range: 'Curto',
    damageType: 'Fogo',
    spaces: 2,
    ammo: 'Combustivel',
    description: 'Atinge linha de 1,5m de largura no alcance curto e pode deixar alvos em chamas.',
  },
  {
    catalog: 'armas',
    name: 'Maca',
    group: 'Armas Taticas - Corpo a Corpo - Uma Mao',
    category: 1,
    damage: '2d4',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 1,
    description: 'Bastao com cabeca metalica cheia de protuberancias.',
  },
  {
    catalog: 'armas',
    name: 'Machadinha',
    group: 'Armas Taticas - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d6',
    critical: 'x3',
    range: 'Curto',
    damageType: 'Corte',
    spaces: 1,
    description: 'Arma agil para corte. Pode ser arremessada.',
  },
  {
    catalog: 'armas',
    name: 'Machado',
    group: 'Armas Taticas - Corpo a Corpo - Uma Mao',
    category: 1,
    damage: '1d8',
    critical: 'x3',
    damageType: 'Corte',
    spaces: 1,
    description: 'Ferramenta de lenhadores e bombeiros, capaz de ferimentos severos.',
  },
  {
    catalog: 'armas',
    name: 'Machete',
    group: 'Armas Simples - Corpo a Corpo - Uma Mao',
    category: 0,
    damage: '1d6',
    critical: '19',
    damageType: 'Corte',
    spaces: 1,
    description: 'Lamina longa muito usada para abrir trilhas.',
  },
  {
    catalog: 'armas',
    name: 'Marreta',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '3d4',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 2,
    description: 'Ferramenta de demolicao adaptada para combate.',
  },
  {
    catalog: 'armas',
    name: 'Martelo',
    group: 'Armas Simples - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d6',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 1,
    description: 'Ferramenta comum que pode ser usada como arma improvisada.',
  },
  {
    catalog: 'armas',
    name: 'Metralhadora',
    group: 'Armas Pesadas - Arma de Fogo - Duas Maos',
    category: 2,
    damage: '2d12',
    critical: '19/x3',
    range: 'Medio',
    damageType: 'Balistico',
    spaces: 2,
    ammo: 'Balas Longas',
    description: 'Arma automatica pesada. Exige Forca 4 ou apoio em tripe para evitar penalidade.',
  },
  {
    catalog: 'armas',
    name: 'Montante',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '2d6',
    critical: '19',
    damageType: 'Corte',
    spaces: 2,
    description: 'Espada enorme e pesada, historicamente muito poderosa.',
  },
  {
    catalog: 'armas',
    name: 'Motosserra',
    group: 'Armas Taticas - Corpo a Corpo - Duas Maos',
    category: 1,
    damage: '3d6',
    critical: 'x2',
    damageType: 'Corte',
    spaces: 2,
    description: 'Sempre que sair 6 no dano, role um dado extra. Impoe -1d20 nos ataques e ligar gasta movimento.',
  },
  {
    catalog: 'armas',
    name: 'Nunchaku',
    group: 'Armas Taticas - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d8',
    critical: 'x2',
    damageType: 'Impacto',
    spaces: 1,
    description: 'Dois bastoes curtos ligados por corrente. E arma agil.',
  },
  {
    catalog: 'armas',
    name: 'Pistola',
    group: 'Armas Simples - Arma de Fogo - Leve',
    category: 1,
    damage: '1d12',
    critical: '18',
    range: 'Curto',
    damageType: 'Balistico',
    spaces: 1,
    ammo: 'Balas Curtas',
    description: 'Arma de mao comum entre policiais e militares.',
  },
  {
    catalog: 'armas',
    name: 'Punhal',
    group: 'Armas Simples - Corpo a Corpo - Leve',
    category: 0,
    damage: '1d4',
    critical: 'x3',
    damageType: 'Perfuracao',
    spaces: 1,
    description: 'Lamina longa e pontiaguda. E uma arma agil.',
  },
  {
    catalog: 'armas',
    name: 'Revolver',
    group: 'Armas Simples - Arma de Fogo - Leve',
    category: 1,
    damage: '2d6',
    critical: '19/x3',
    range: 'Curto',
    damageType: 'Balistico',
    spaces: 1,
    ammo: 'Balas Curtas',
    description: 'Uma das armas de fogo mais comuns e confiaveis.',
  },
  {
    catalog: 'armas',
    name: 'Submetralhadora',
    group: 'Armas Taticas - Arma de Fogo - Uma Mao',
    category: 1,
    damage: '2d6',
    critical: '19/x3',
    range: 'Curto',
    damageType: 'Balistico',
    spaces: 1,
    ammo: 'Balas Curtas',
    description: 'Arma de fogo automatica que pode ser empunhada com uma mao.',
  },
  {
    catalog: 'municao',
    name: 'Cartuchos Calibre 12',
    group: 'Municao - Escopeta',
    category: 1,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 1,
    description: 'Caixa de cartuchos para escopetas calibre 12.',
  },
  {
    catalog: 'municao',
    name: 'Balas de Pistola',
    group: 'Municao - Arma Curta',
    category: 0,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 1,
    description: 'Pacote de municao para armas curtas de uso tatico.',
  },
  {
    catalog: 'protecao',
    name: 'Colete Leve',
    group: 'Protecoes - Tatico',
    category: 1,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 2,
    description: 'Colete de protecao balistica leve para operacoes de risco.',
  },
  {
    catalog: 'protecao',
    name: 'Escudo Tatico',
    group: 'Protecoes - Defesa',
    category: 2,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 2,
    description: 'Escudo de impacto para cobertura em avancos de equipe.',
  },
  {
    catalog: 'itens_gerais',
    name: 'Kit Medico',
    group: 'Itens Gerais - Suporte',
    category: 1,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 1,
    description: 'Conjunto de primeiros socorros para estabilizacao rapida.',
  },
  {
    catalog: 'itens_gerais',
    name: 'Lanterna Tatica',
    group: 'Itens Gerais - Utilidade',
    category: 0,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 1,
    description: 'Lanterna resistente com foco ajustavel para areas escuras.',
  },
  {
    catalog: 'itens_amaldicoados',
    name: 'Faca Sussurrante',
    group: 'Itens Amaldicoados - Lamina',
    category: 2,
    damage: '1d8',
    critical: '19/x3',
    damageType: 'Corte',
    spaces: 1,
    description: 'Lamina amaldiçoada que vibra com presencas paranormais.',
  },
  {
    catalog: 'itens_amaldicoados',
    name: 'Mascara do Vazio',
    group: 'Itens Amaldicoados - Artefato',
    category: 3,
    damage: '-',
    critical: '-',
    damageType: '-',
    spaces: 1,
    description: 'Artefato ritualistico que distorce percepcoes ao redor.',
  },
];

const OP_CATEGORY_ROMAN = ['0', 'I', 'II', 'III', 'IV'] as const;

const formatCategory = (category: number) => {
  const clamped = Math.max(0, Math.min(4, category));
  return OP_CATEGORY_ROMAN[clamped];
};

const N = ({ value, onChange, min, max, readOnly = false, className = '' }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  readOnly?: boolean;
  className?: string;
}) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(parseInt(e.target.value, 10) || 0)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:border-gold/50 ${readOnly ? 'opacity-70 cursor-default' : ''} ${className}`}
  />
);

const TF = ({ value, onChange, placeholder = '', readOnly = false, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}) => (
  <input
    type="text"
    value={value}
    placeholder={placeholder}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(e.target.value)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${readOnly ? 'opacity-70 cursor-default' : ''} ${className}`}
  />
);

const TA = ({ value, onChange, rows = 3, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  readOnly?: boolean;
}) => (
  <textarea
    value={value}
    rows={rows}
    readOnly={readOnly}
    onChange={e => !readOnly && onChange(e.target.value)}
    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full resize-none ${readOnly ? 'opacity-70 cursor-default' : ''}`}
  />
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-display text-gold/80 tracking-widest uppercase border-b border-gold/20 pb-0.5 mb-2">{children}</div>
);

export default function CharacterSheetOP({
  sessionId,
  onClose,
  targetPlayerId,
  targetPlayerName,
  readOnly = false,
}: CharacterSheetOPProps) {
  const { player, role } = useAuth();
  const [sheet, setSheet] = useState<OPSheetExtra>(defaultOPSheet());
  const [tab, setTab] = useState<Tab>('principal');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [origensExtras, setOrigensExtras] = useState<OPOrigemData[]>([]);
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const [classAbilityDialogOpen, setClassAbilityDialogOpen] = useState(false);
  const [generalAbilityDialogOpen, setGeneralAbilityDialogOpen] = useState(false);
  const [classAbilityClassFilter, setClassAbilityClassFilter] = useState<OPClasse | ''>('');
  const [castingRitual, setCastingRitual] = useState<OPRitual | null>(null);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [bonusDialogData, setBonusDialogData] = useState<{ label: string; baseModifier: number; attributeValue?: number; isInitiative?: boolean } | null>(null);
  const [bonusInput, setBonusInput] = useState('0');
  const [itemListDialogOpen, setItemListDialogOpen] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<OPCatalogType>('armas');
  const [createItemDialogOpen, setCreateItemDialogOpen] = useState(false);
  const [customItemForm, setCustomItemForm] = useState<InventoryItem>({
    name: '',
    qty: 1,
    weight: 0,
    category: 0,
    damage: '',
    critical: '',
    damageType: '',
    cost: '',
    notes: '',
  });
  const [originForm, setOriginForm] = useState({
    nome: '',
    pericia1: '',
    pericia2: '',
    poderNome: 'Poder personalizado',
    poderDescricao: '',
  });
  const diceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isDm = role === 'dm';
  const ownerId = targetPlayerId ?? player?.id;
  const canEdit = !readOnly && (isDm || ownerId === player?.id);
  const canRoll = !readOnly && !!player;
  const opPericiasIds = new Set(OP_PERICIAS.map(p => p.nome));
  const ageNexBonus = getOPAgeNexBonus(sheet.regraIdadeAtiva, sheet.faixaEtaria);
  const effectiveNex = Math.min(99, sheet.nex + ageNexBonus);
  const ageDefesaBonus = getOPAgeDefesaBonus(sheet.regraIdadeAtiva, sheet.faixaEtaria);
  const agePEFlatBonus = getOPAgePEFlatBonus(sheet.regraIdadeAtiva, sheet.faixaEtaria);
  const agePVLevelPenalty = getOPAgePVPenaltyPerLevel(sheet.desvantagensIdade);
  const agePELevelPenalty = getOPAgePEPenaltyPerLevel(sheet.desvantagensIdade);
  const ageLevels = Math.max(1, Math.floor(effectiveNex / 5));

  useEffect(() => {
    const load = async () => {
      if (!ownerId) return;
      const { data } = await supabase
        .from('character_sheets')
        .select('data')
        .eq('session_id', sessionId)
        .eq('player_id', ownerId)
        .maybeSingle();

      if (data?.data) {
        const raw = data.data as Partial<OPSheetExtra>;
        const next = { ...defaultOPSheet(), ...raw };
        if (!Object.prototype.hasOwnProperty.call(raw, 'defesaOutrosMod')) {
          next.defesaOutrosMod = 0;
        }
        const loadAgeNexBonus = getOPAgeNexBonus(next.regraIdadeAtiva, next.faixaEtaria);
        const loadEffectiveNex = Math.min(99, next.nex + loadAgeNexBonus);
        const loadAgeDefesaBonus = getOPAgeDefesaBonus(next.regraIdadeAtiva, next.faixaEtaria);
        const loadLevels = Math.max(1, Math.floor(loadEffectiveNex / 5));
        next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + loadAgeDefesaBonus);
        const requiredDrawbacks = getOPAgeRequiredDrawbacks(next.regraIdadeAtiva, next.faixaEtaria);
        next.desvantagensIdade = (next.desvantagensIdade ?? []).slice(0, requiredDrawbacks || undefined);
        next.deslocamento = Math.max(3, getOPAgeBaseDeslocamento(next.regraIdadeAtiva, next.faixaEtaria) - getOPAgeDeslocamentoPenalty(next.desvantagensIdade));
        if (next.classe) {
          next.maxPV = Math.max(1, calcOPMaxPV(next.classe, next.vig, loadEffectiveNex) - (getOPAgePVPenaltyPerLevel(next.desvantagensIdade) * loadLevels));
          next.maxPE = Math.max(0, calcOPMaxPE(next.classe, loadEffectiveNex, next.pre) + getOPAgePEFlatBonus(next.regraIdadeAtiva, next.faixaEtaria) - (getOPAgePEPenaltyPerLevel(next.desvantagensIdade) * loadLevels));
          next.maxPS = calcOPMaxSAN(next.classe, loadEffectiveNex);
          if (next.pvAtual === undefined || next.pvAtual === null) next.pvAtual = next.maxPV;
          else next.pvAtual = Math.max(0, Math.min(next.maxPV, next.pvAtual));
          if (next.peAtual === undefined || next.peAtual === null) next.peAtual = next.maxPE;
          else next.peAtual = Math.max(0, Math.min(next.maxPE, next.peAtual));
          if (next.psAtual === undefined || next.psAtual === null) next.psAtual = next.maxPS;
          else next.psAtual = Math.max(0, Math.min(next.maxPS, next.psAtual));
        }
        setSheet(next);
      } else {
        setSheet(defaultOPSheet());
      }
      setDirty(false);
    };
    load();
  }, [ownerId, sessionId]);

  useEffect(() => {
    if (!sheet.origem) return;
    const isPadrao = OP_ORIGENS.some(origem => origem.nome === sheet.origem);
    if (isPadrao) return;
    setOrigensExtras(prev => {
      if (prev.some(origem => origem.nome === sheet.origem)) return prev;
      return [...prev, {
        nome: sheet.origem,
        periciasTreinadas: [],
        poderNome: sheet.origemPoderNome || 'Poder personalizado',
        poderDescricao: sheet.origemPoderDescricao || '',
      }];
    });
  }, [sheet.origem, sheet.origemPoderDescricao, sheet.origemPoderNome]);

  useEffect(() => {
    if (sheet.classe) setClassAbilityClassFilter(sheet.classe);
  }, [sheet.classe, classAbilityDialogOpen]);

  useEffect(() => {
    const channel = supabase.channel(`dice-announce-${sessionId}`);
    channel.subscribe();
    diceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const setField = useCallback(<K extends keyof OPSheetExtra>(key: K, value: OPSheetExtra[K]) => {
    setSheet(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const save = async () => {
    if (!ownerId) return;
    setSaving(true);

    const { error } = await supabase
      .from('character_sheets')
      .upsert({
        session_id: sessionId,
        player_id: ownerId,
        data: sheet as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id,player_id' });

    setSaving(false);
    if (error) toast.error(`Erro ao salvar: ${error.message}`);
    else {
      toast.success('Ficha de Ordem Paranormal salva!');
      setDirty(false);
    }
  };

  const setClasse = (classe: OPClasse | '') => {
    const next = { ...sheet, classe };
    if (classe) {
      next.maxPV = Math.max(1, calcOPMaxPV(classe, sheet.vig, effectiveNex) - (agePVLevelPenalty * ageLevels));
      next.maxPE = Math.max(0, calcOPMaxPE(classe, effectiveNex, sheet.pre) + agePEFlatBonus - (agePELevelPenalty * ageLevels));
      next.pvAtual = sheet.pvAtual > 0 ? Math.min(next.maxPV, sheet.pvAtual) : next.maxPV;
      next.peAtual = sheet.peAtual > 0 ? Math.min(next.maxPE, sheet.peAtual) : next.maxPE;
      next.maxPS = calcOPMaxSAN(classe, effectiveNex);
      next.psAtual = sheet.psAtual > 0 ? Math.min(next.maxPS, sheet.psAtual) : next.maxPS;
    }
    next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + ageDefesaBonus);
    setSheet(next);
    setDirty(true);
  };

  const setNex = (nex: number) => {
    const clamped = Math.max(5, Math.min(99, nex));
    const effective = Math.min(99, clamped + ageNexBonus);
    const levels = Math.max(1, Math.floor(effective / 5));
    const next = { ...sheet, nex: clamped };
    if (sheet.classe) {
      next.maxPV = Math.max(1, calcOPMaxPV(sheet.classe, sheet.vig, effective) - (agePVLevelPenalty * levels));
      next.maxPE = Math.max(0, calcOPMaxPE(sheet.classe, effective, sheet.pre) + agePEFlatBonus - (agePELevelPenalty * levels));
      next.maxPS = calcOPMaxSAN(sheet.classe, effective);
      next.pvAtual = Math.min(next.maxPV, sheet.pvAtual);
      next.peAtual = Math.min(next.maxPE, sheet.peAtual);
      next.psAtual = Math.min(next.maxPS, sheet.psAtual);
    }
    next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + ageDefesaBonus);
    setSheet(next);
    setDirty(true);
  };

  const setAtributo = (attr: typeof OP_ATTRIBUTES[number], value: number) => {
    const maxAttr = getOPAgeAttrMax(sheet.regraIdadeAtiva, sheet.faixaEtaria, attr);
    const clamped = Math.max(-5, Math.min(maxAttr, value));
    const next = { ...sheet, [attr]: clamped } as OPSheetExtra;
    if (sheet.classe) {
      next.maxPV = Math.max(1, calcOPMaxPV(sheet.classe, attr === 'vig' ? clamped : sheet.vig, effectiveNex) - (agePVLevelPenalty * ageLevels));
      next.maxPE = Math.max(0, calcOPMaxPE(sheet.classe, effectiveNex, attr === 'pre' ? clamped : sheet.pre) + agePEFlatBonus - (agePELevelPenalty * ageLevels));
      const pvDelta = next.maxPV - sheet.maxPV;
      const peDelta = next.maxPE - sheet.maxPE;
      next.pvAtual = Math.max(0, Math.min(next.maxPV, sheet.pvAtual + pvDelta));
      next.peAtual = Math.max(0, Math.min(next.maxPE, sheet.peAtual + peDelta));
    }
    next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + ageDefesaBonus);
    setSheet(next);
    setDirty(true);
  };

  const setRegraIdadeAtiva = (enabled: boolean) => {
    setSheet(prev => {
      const next = { ...prev, regraIdadeAtiva: enabled };
      const required = getOPAgeRequiredDrawbacks(enabled, next.faixaEtaria);
      next.desvantagensIdade = next.desvantagensIdade.slice(0, required || undefined);

      if (enabled && next.faixaEtaria === 'Crianca') {
        next.for = 0;
        next.vig = 0;
      }
      if (enabled && next.faixaEtaria === 'Adolescente') {
        next.for = 0;
      }

      const effective = Math.min(99, next.nex + getOPAgeNexBonus(next.regraIdadeAtiva, next.faixaEtaria));
      const levels = Math.max(1, Math.floor(effective / 5));
      next.deslocamento = Math.max(3, getOPAgeBaseDeslocamento(next.regraIdadeAtiva, next.faixaEtaria) - getOPAgeDeslocamentoPenalty(next.desvantagensIdade));
      next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + getOPAgeDefesaBonus(next.regraIdadeAtiva, next.faixaEtaria));
      if (next.classe) {
        next.maxPV = Math.max(1, calcOPMaxPV(next.classe, next.vig, effective) - (getOPAgePVPenaltyPerLevel(next.desvantagensIdade) * levels));
        next.maxPE = Math.max(0, calcOPMaxPE(next.classe, effective, next.pre) + getOPAgePEFlatBonus(next.regraIdadeAtiva, next.faixaEtaria) - (getOPAgePEPenaltyPerLevel(next.desvantagensIdade) * levels));
        next.maxPS = calcOPMaxSAN(next.classe, effective);
        next.pvAtual = Math.min(next.maxPV, next.pvAtual);
        next.peAtual = Math.min(next.maxPE, next.peAtual);
        next.psAtual = Math.min(next.maxPS, next.psAtual);
      }
      return next;
    });
    setDirty(true);
  };

  const setFaixaEtaria = (faixa: OPAgeBracket) => {
    setSheet(prev => {
      const next = { ...prev, faixaEtaria: faixa };
      const required = getOPAgeRequiredDrawbacks(next.regraIdadeAtiva, faixa);
      next.desvantagensIdade = next.desvantagensIdade.slice(0, required || undefined);

      if (next.regraIdadeAtiva && faixa === 'Crianca') {
        next.for = 0;
        next.vig = 0;
      }
      if (next.regraIdadeAtiva && faixa === 'Adolescente') {
        next.for = 0;
      }

      const forMax = getOPAgeAttrMax(next.regraIdadeAtiva, faixa, 'for');
      const vigMax = getOPAgeAttrMax(next.regraIdadeAtiva, faixa, 'vig');
      next.for = Math.max(-5, Math.min(forMax, next.for));
      next.vig = Math.max(-5, Math.min(vigMax, next.vig));

      const effective = Math.min(99, next.nex + getOPAgeNexBonus(next.regraIdadeAtiva, faixa));
      const levels = Math.max(1, Math.floor(effective / 5));
      next.deslocamento = Math.max(3, getOPAgeBaseDeslocamento(next.regraIdadeAtiva, faixa) - getOPAgeDeslocamentoPenalty(next.desvantagensIdade));
      next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + getOPAgeDefesaBonus(next.regraIdadeAtiva, faixa));
      if (next.classe) {
        next.maxPV = Math.max(1, calcOPMaxPV(next.classe, next.vig, effective) - (getOPAgePVPenaltyPerLevel(next.desvantagensIdade) * levels));
        next.maxPE = Math.max(0, calcOPMaxPE(next.classe, effective, next.pre) + getOPAgePEFlatBonus(next.regraIdadeAtiva, faixa) - (getOPAgePEPenaltyPerLevel(next.desvantagensIdade) * levels));
        next.maxPS = calcOPMaxSAN(next.classe, effective);
        next.pvAtual = Math.min(next.maxPV, next.pvAtual);
        next.peAtual = Math.min(next.maxPE, next.peAtual);
        next.psAtual = Math.min(next.maxPS, next.psAtual);
      }
      return next;
    });
    setDirty(true);
  };

  const toggleDesvantagemIdade = (nome: string) => {
    const required = getOPAgeRequiredDrawbacks(sheet.regraIdadeAtiva, sheet.faixaEtaria);
    setSheet(prev => {
      const has = prev.desvantagensIdade.includes(nome);
      let updated = [...prev.desvantagensIdade];
      if (has) {
        updated = updated.filter(item => item !== nome);
      } else {
        if (required > 0 && updated.length >= required) return prev;
        updated.push(nome);
      }

      const next = { ...prev, desvantagensIdade: updated };
      const effective = Math.min(99, next.nex + getOPAgeNexBonus(next.regraIdadeAtiva, next.faixaEtaria));
      const levels = Math.max(1, Math.floor(effective / 5));
      next.deslocamento = Math.max(3, getOPAgeBaseDeslocamento(next.regraIdadeAtiva, next.faixaEtaria) - getOPAgeDeslocamentoPenalty(updated));
      next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod + getOPAgeDefesaBonus(next.regraIdadeAtiva, next.faixaEtaria));
      if (next.classe) {
        next.maxPV = Math.max(1, calcOPMaxPV(next.classe, next.vig, effective) - (getOPAgePVPenaltyPerLevel(updated) * levels));
        next.maxPE = Math.max(0, calcOPMaxPE(next.classe, effective, next.pre) + getOPAgePEFlatBonus(next.regraIdadeAtiva, next.faixaEtaria) - (getOPAgePEPenaltyPerLevel(updated) * levels));
        next.maxPS = calcOPMaxSAN(next.classe, effective);
        next.pvAtual = Math.min(next.maxPV, next.pvAtual);
        next.peAtual = Math.min(next.maxPE, next.peAtual);
        next.psAtual = Math.min(next.maxPS, next.psAtual);
      }
      return next;
    });
    setDirty(true);
  };

  const setPVAtual = (value: number) => setField('pvAtual', Math.max(0, Math.min(sheet.maxPV, value)));
  const setPEAtual = (value: number) => setField('peAtual', Math.max(0, Math.min(sheet.maxPE, value)));
  const setSANAtual = (value: number) => setField('psAtual', Math.max(0, Math.min(sheet.maxPS, value)));
  const setPVTemp = (value: number) => setField('pvTemp', Math.max(0, value));
  const setPETemp = (value: number) => setField('peTemp', Math.max(0, value));
  const setSANTemp = (value: number) => setField('psTemp', Math.max(0, value));
  const setProtecao = (value: number) => {
    const clamped = Math.max(0, value);
    setSheet(prev => {
      const next = { ...prev, protecao: clamped };
      next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod);
      return next;
    });
    setDirty(true);
  };
  const setDefesaOutrosMod = (value: number) => {
    setSheet(prev => {
      const next = { ...prev, defesaOutrosMod: value };
      next.defesa = calcOPDefesa(next.agi, next.protecao, next.defesaOutrosMod);
      return next;
    });
    setDirty(true);
  };

  const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const resolvePericia = (raw: string): string | null => {
    const normalized = normalize(raw);
    if (!normalized) return null;
    if (normalized.startsWith('profissao')) return 'profissao';

    const byNome = OP_PERICIAS.find(p => normalize(p.nome) === normalized);
    if (byNome) return byNome.nome;

    const byLabel = OP_PERICIAS.find(p => normalize(p.label) === normalized);
    if (byLabel) return byLabel.nome;

    const includes = OP_PERICIAS.find(p => normalized.includes(normalize(p.label)) || normalized.includes(normalize(p.nome)));
    return includes?.nome ?? null;
  };

  const origemCatalogo = [...OP_ORIGENS, ...origensExtras];

  const buildOriginUpdate = (prev: OPSheetExtra, origemNome: string, origem?: OPOrigemData): OPSheetExtra => {
    const pericias = { ...prev.pericias };

    (prev.origemPericiasTreinadas ?? []).forEach((nomePericia) => {
      if (!opPericiasIds.has(nomePericia)) return;
      const atual = (pericias[nomePericia] ?? 0) as OPProficiencia;
      if (atual === 1) pericias[nomePericia] = 0;
    });

    if (origem) {
      origem.periciasTreinadas.forEach((nomePericia) => {
        if (!opPericiasIds.has(nomePericia)) return;
        const atual = (pericias[nomePericia] ?? 0) as OPProficiencia;
        if (atual < 1) pericias[nomePericia] = 1;
      });
    }

    return {
      ...prev,
      origem: origemNome,
      pericias,
      origemPoderNome: origem?.poderNome ?? prev.origemPoderNome,
      origemPoderDescricao: origem?.poderDescricao ?? prev.origemPoderDescricao,
      origemPericiasTreinadas: origem?.periciasTreinadas ?? [],
    };
  };

  const applyOrigem = (origemNome: string) => {
    setSheet(prev => {
      const origem = origemCatalogo.find(o => o.nome === origemNome);
      return buildOriginUpdate(prev, origemNome, origem);
    });
    setDirty(true);
  };

  const addOrigemCustomizada = () => {
    if (!canEdit) return;
    setOriginForm({
      nome: '',
      pericia1: '',
      pericia2: '',
      poderNome: 'Poder personalizado',
      poderDescricao: '',
    });
    setOriginDialogOpen(true);
  };

  const saveNewOrigin = () => {
    const novaOrigem = originForm.nome.trim();
    if (!novaOrigem) {
      toast.error('Digite o nome da origem.');
      return;
    }

    const periciasTreinadas = [resolvePericia(originForm.pericia1), resolvePericia(originForm.pericia2)]
      .filter((nome): nome is string => !!nome)
      .filter((nome, idx, arr) => arr.indexOf(nome) === idx);

    const novaOrigemData: OPOrigemData = {
      nome: novaOrigem,
      periciasTreinadas,
      poderNome: originForm.poderNome.trim() || 'Poder personalizado',
      poderDescricao: originForm.poderDescricao.trim(),
    };

    const isPadrao = OP_ORIGENS.some(origem => origem.nome === novaOrigem);
    if (isPadrao) {
      applyOrigem(novaOrigem);
      setOriginDialogOpen(false);
      toast.success('Origem aplicada.');
      return;
    }

    setOrigensExtras(prev => {
      if (prev.some(origem => origem.nome === novaOrigem)) return prev;
      return [...prev, novaOrigemData];
    });

    if (originForm.pericia1.trim() && !resolvePericia(originForm.pericia1)) {
      toast.warning(`Pericia "${originForm.pericia1}" nao foi reconhecida.`);
    }
    if (originForm.pericia2.trim() && !resolvePericia(originForm.pericia2)) {
      toast.warning(`Pericia "${originForm.pericia2}" nao foi reconhecida.`);
    }

    setSheet(prev => buildOriginUpdate(prev, novaOrigem, novaOrigemData));
    setDirty(true);
    setOriginDialogOpen(false);
    toast.success('Origem adicionada com sucesso.');
  };

  const opcoesOrigem = origemCatalogo;

  const addHabilidadeExtra = () => {
    setField('habilidadesExtras', [...sheet.habilidadesExtras, '']);
  };

  const classAbilities = OP_CLASS_ABILITIES.filter(ability => ability.classe === classAbilityClassFilter);

  const isClassAbilitySelected = (abilityName: string) =>
    sheet.habilidadesClasseSelecionadas.includes(abilityName);

  const getClassAbilityRequirementError = (
    ability: OPClassAbility,
    selectedAbilityNames: string[] = sheet.habilidadesClasseSelecionadas,
  ): string | null => {
    if (!sheet.classe || ability.classe !== sheet.classe) {
      return `Requisito nao atendido: habilidade exclusiva de ${ability.classe}.`;
    }

    if (ability.requisitoAtributo) {
      const { atributo, minimo } = ability.requisitoAtributo;
      if (sheet[atributo] < minimo) {
        return `Requisito nao atendido: ${OP_ATTR_LABELS[atributo]} ${minimo}.`;
      }
    }

    if (ability.requisitoNex && effectiveNex < ability.requisitoNex) {
      return `Requisito nao atendido: NEX ${ability.requisitoNex}%.`;
    }

    if (ability.requisitosPericiasTreinadas && ability.requisitosPericiasTreinadas.length > 0) {
      const missing = ability.requisitosPericiasTreinadas.find(periciaNome => !isPericiaTreinada(periciaNome));
      if (missing) {
        const pericia = OP_PERICIAS.find(p => p.nome === missing);
        return `Requisito nao atendido: treinado em ${pericia?.label ?? missing}.`;
      }
    }

    if (ability.requisitosPericiasAlternativas && ability.requisitosPericiasAlternativas.length > 0) {
      const hasAny = ability.requisitosPericiasAlternativas.some(periciaNome => isPericiaTreinada(periciaNome));
      if (!hasAny) {
        const options = ability.requisitosPericiasAlternativas
          .map((periciaNome) => OP_PERICIAS.find(p => p.nome === periciaNome)?.label ?? periciaNome)
          .join(' ou ');
        return `Requisito nao atendido: treinado em ${options}.`;
      }
    }

    if (ability.requisitosHabilidadesClasse && ability.requisitosHabilidadesClasse.length > 0) {
      const missingAbility = ability.requisitosHabilidadesClasse.find(name => !selectedAbilityNames.includes(name));
      if (missingAbility) {
        return `Requisito nao atendido: habilidade ${missingAbility}.`;
      }
    }

    return null;
  };

  const toggleClassAbility = (abilityName: string) => {
    if (!canEdit) return;
    const ability = OP_CLASS_ABILITIES.find(item => item.nome === abilityName);
    if (!ability) return;
    if (!isDm && ability.classe !== sheet.classe) return;
    if (isClassAbilitySelected(abilityName)) {
      setField('habilidadesClasseSelecionadas', sheet.habilidadesClasseSelecionadas.filter(name => name !== abilityName));
      return;
    }

    const requirementError = getClassAbilityRequirementError(ability);
    if (requirementError) {
      toast.error(requirementError);
      return;
    }

    setField('habilidadesClasseSelecionadas', [...sheet.habilidadesClasseSelecionadas, abilityName]);
  };

  useEffect(() => {
    if (!canEdit || !sheet.habilidadesClasseSelecionadas.length) return;

    let stable = [...sheet.habilidadesClasseSelecionadas];
    let changed = false;

    while (true) {
      const next = stable.filter((abilityName) => {
        const ability = OP_CLASS_ABILITIES.find(item => item.nome === abilityName);
        if (!ability) return false;
        return !getClassAbilityRequirementError(ability, stable);
      });

      if (next.length === stable.length) break;
      stable = next;
      changed = true;
    }

    if (!changed) return;

    setField('habilidadesClasseSelecionadas', stable);
    toast.warning('Algumas habilidades de classe foram removidas por nao cumprir mais os pre-requisitos.');
  }, [
    canEdit,
    sheet.classe,
    sheet.nex,
    sheet.agi,
    sheet.for,
    sheet.int,
    sheet.pre,
    sheet.vig,
    sheet.pericias,
    sheet.habilidadesClasseSelecionadas,
    setField,
  ]);

  const selectedClassAbilities = sheet.habilidadesClasseSelecionadas
    .map((name) => OP_CLASS_ABILITIES.find((ability) => ability.nome === name))
    .filter((ability): ability is OPClassAbility => !!ability);

  const selectedGeneralAbilityNames = sheet.poderesGeraisSelecionados ?? [];

  const isPericiaTreinada = (periciaNome: string) => ((sheet.pericias[periciaNome] ?? 0) as OPProficiencia) >= 1;

  const getGeneralAbilityRequirementError = (ability: OPGeneralAbility): string | null => {
    if (ability.requisitoAtributo) {
      const { atributo, minimo } = ability.requisitoAtributo;
      if (sheet[atributo] < minimo) {
        return `Requisito nao atendido: ${OP_ATTR_LABELS[atributo]} ${minimo}.`;
      }
    }

    if (ability.requisitoNex && effectiveNex < ability.requisitoNex) {
      return `Requisito nao atendido: NEX ${ability.requisitoNex}%.`;
    }

    if (ability.requisitosPericiasTreinadas && ability.requisitosPericiasTreinadas.length > 0) {
      const missing = ability.requisitosPericiasTreinadas.find(periciaNome => !isPericiaTreinada(periciaNome));
      if (missing) {
        const pericia = OP_PERICIAS.find(p => p.nome === missing);
        return `Requisito nao atendido: treinado em ${pericia?.label ?? missing}.`;
      }
    }

    if (ability.requerPericiaEscolhidaTreinada) {
      const hasEligibleSkill = OP_PERICIAS.some(pericia => (
        pericia.nome !== 'luta' &&
        pericia.nome !== 'pontaria' &&
        isPericiaTreinada(pericia.nome)
      ));
      if (!hasEligibleSkill) {
        return 'Requisito nao atendido: treinamento em uma pericia escolhida (exceto Luta e Pontaria).';
      }
    }

    return null;
  };

  const isGeneralAbilitySelected = (abilityName: string) =>
    selectedGeneralAbilityNames.includes(abilityName);

  const toggleGeneralAbility = (abilityName: string) => {
    if (!canEdit) return;
    if (isGeneralAbilitySelected(abilityName)) {
      setField('poderesGeraisSelecionados', selectedGeneralAbilityNames.filter(name => name !== abilityName));
      return;
    }

    const ability = OP_GENERAL_ABILITIES.find(item => item.nome === abilityName);
    if (!ability) return;

    const requirementError = getGeneralAbilityRequirementError(ability);
    if (requirementError) {
      toast.error(requirementError);
      return;
    }

    setField('poderesGeraisSelecionados', [...selectedGeneralAbilityNames, abilityName]);
  };

  const selectedGeneralAbilities = selectedGeneralAbilityNames
    .map((name) => OP_GENERAL_ABILITIES.find((ability) => ability.nome === name))
    .filter((ability): ability is OPGeneralAbility => !!ability);

  const formatSigned = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

  const rollCheck = async (label: string, baseModifier: number, attributeValue?: number, isInitiative?: boolean) => {
    if (!canRoll || !player) {
      console.log('Rolagem bloqueada:', { canRoll, player: !!player, readOnly });
      if (!canRoll) toast.error('Você não pode rolar dados nesta ficha');
      if (!player) toast.error('Jogador não encontrado');
      return;
    }

    // Abre o dialog para pedir bônus extra
    setBonusDialogData({ label, baseModifier, attributeValue, isInitiative });
    setBonusInput('0');
    setShowBonusDialog(true);
  };

  const executeRoll = async () => {
    if (!bonusDialogData || !player) return;

    const { label, baseModifier, attributeValue, isInitiative } = bonusDialogData;
    const extraBonus = parseInt(bonusInput) || 0;

    console.log('Iniciando rolagem:', { label, baseModifier, attributeValue, extraBonus, isInitiative });

    // Em Ordem Paranormal, rola número de d20s igual ao atributo (mínimo 1)
    const numDice = attributeValue !== undefined ? Math.max(1, attributeValue) : 1;
    const rolls: number[] = [];
    
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * 20) + 1);
    }

    console.log('Dados rolados:', rolls);

    // Pega o maior resultado
    const bestRoll = Math.max(...rolls);
    const totalModifier = baseModifier + extraBonus;
    const total = bestRoll + totalModifier;
    
    const diceStr = numDice > 1 ? `${numDice}d20 (melhor: ${bestRoll})` : `1d20`;
    const formula = `${diceStr} ${formatSigned(totalModifier)} (${label}${extraBonus !== 0 ? `, bônus ${formatSigned(extraBonus)}` : ''})`;

    console.log('Resultado final:', { formula, total });

    // Se for iniciativa, adiciona na tabela de combate
    if (isInitiative) {
      const { data: combatState } = await supabase
        .from('combat_state')
        .select('is_active')
        .eq('session_id', sessionId)
        .single();

      if (combatState?.is_active) {
        // Verifica se já existe entrada de iniciativa para este jogador
        const { data: existing } = await supabase
          .from('combat_initiative')
          .select('id')
          .eq('session_id', sessionId)
          .eq('player_id', player.id)
          .maybeSingle();

        if (existing) {
          // Atualiza iniciativa existente
          const { data: updData, error: updErr } = await supabase
            .from('combat_initiative')
            .update({
              initiative_roll: bestRoll,
              initiative_bonus: totalModifier,
              initiative_total: total,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select();
          console.log('Atualizada iniciativa existente:', { updData, updErr });
        } else {
          // Cria nova entrada de iniciativa
          const { data: allInitiatives } = await supabase
            .from('combat_initiative')
            .select('turn_order')
            .eq('session_id', sessionId)
            .order('turn_order', { ascending: false })
            .limit(1);

          const nextOrder = (allInitiatives?.[0]?.turn_order ?? 0) + 1;

          const { data: insData, error: insErr } = await supabase.from('combat_initiative').insert({
            session_id: sessionId,
            combatant_type: 'player',
            player_id: player.id,
            character_name: sheet.nomePersonagem || player.name,
            avatar_url: sheet.tokenImageUrl || player.avatar_url,
            initiative_roll: bestRoll,
            initiative_bonus: totalModifier,
            initiative_total: total,
            turn_order: nextOrder,
            is_active: false,
            hp_current: sheet.pvAtual,
            hp_max: sheet.maxPV,
          }).select();
          console.log('Inserida nova iniciativa:', { insData, insErr });
        }

        // Reordena automaticamente por total de iniciativa
        const { data: allEntries } = await supabase
          .from('combat_initiative')
          .select('*')
          .eq('session_id', sessionId)
          .order('initiative_total', { ascending: false });

        if (allEntries) {
          for (let i = 0; i < allEntries.length; i++) {
            const { error: e } = await supabase
              .from('combat_initiative')
              .update({ turn_order: i + 1 })
              .eq('id', allEntries[i].id);
            if (e) console.error('Erro ao atualizar turn_order:', e);
          }
        }

        console.log('Reordenação de iniciativas concluída');

        toast.success(`Iniciativa ${total} adicionada ao combate!`);
      } else {
        toast.info(`${label}: ${total} (combate não iniciado)`);
      }
    }

    if (diceChannelRef.current) {
      diceChannelRef.current.send({
        type: 'broadcast',
        event: 'roll_announce',
        payload: {
          playerId: player.id,
          playerName: player.name,
          formula,
          total,
          critical: bestRoll === 20,
        },
      });
    }

    const { error } = await supabase.from('dice_rolls').insert({
      session_id: sessionId,
      player_id: player.id,
      player_name: player.name,
      player_avatar: player.avatar_url,
      dice_formula: formula,
      results: rolls,
      modifier: totalModifier,
      total,
      is_hidden: role === 'dm',
    });

    if (error) {
      console.error('Erro ao salvar rolagem:', error);
      toast.error(`Erro ao registrar rolagem: ${error.message}`);
      return;
    }

    if (numDice > 1) {
      toast.success(`${label}: ${total} (dados: ${rolls.join(', ')})`);
    } else {
      toast.success(`${label}: ${total}`);
    }

    setShowBonusDialog(false);
    setBonusDialogData(null);
  };

  const addAtaque = () => {
    const novos = [...sheet.ataques, { nome: '', bonus: '', dano: '', tipo: '', critico: '20/x2', alcance: '' } as OPAtaque];
    setField('ataques', novos);
  };

  const addRitual = () => {
    const novos = [...sheet.rituais, { nome: '', circulo: 1, elemento: 'Morte', execucao: '', alcance: '', custo: '1 PE', descricao: '' } as OPRitual];
    setField('rituais', novos);
  };

  const addCatalogItem = (catalogItem: OPInventoryCatalogItem) => {
    const composedNotes = `${catalogItem.group} | Dano ${catalogItem.damage} | Critico ${catalogItem.critical} | Tipo ${catalogItem.damageType}. ${catalogItem.description}`;
    const novos = [
      ...sheet.equipamentos,
      {
        name: catalogItem.name,
        qty: 1,
        weight: catalogItem.spaces,
        category: catalogItem.category,
        damage: catalogItem.damage,
        critical: catalogItem.critical,
        damageType: catalogItem.damageType,
        cost: catalogItem.cost ?? '',
        notes: composedNotes,
      } as InventoryItem,
    ];
    setField('equipamentos', novos);
    setItemListDialogOpen(false);
    toast.success(`${catalogItem.name} adicionado ao inventario`);
  };

  const createCustomItem = () => {
    const normalizedName = customItemForm.name.trim();
    if (!normalizedName) {
      toast.error('Informe o nome do item');
      return;
    }

    const newItem: InventoryItem = {
      name: normalizedName,
      qty: 1,
      weight: Math.max(0, customItemForm.weight || 0),
      category: Math.max(0, Math.min(4, customItemForm.category ?? 0)),
      damage: customItemForm.damage?.trim() || '',
      critical: customItemForm.critical?.trim() || '',
      damageType: customItemForm.damageType?.trim() || '',
      cost: customItemForm.cost.trim(),
      notes: customItemForm.notes.trim(),
    };

    setField('equipamentos', [...sheet.equipamentos, newItem]);
    setCustomItemForm({ name: '', qty: 1, weight: 0, category: 0, damage: '', critical: '', damageType: '', cost: '', notes: '' });
    setCreateItemDialogOpen(false);
    toast.success('Item customizado criado');
  };

  const addBestiario = () => {
    const bestiario = sheet.bestiario ?? [];
    setField('bestiario', [...bestiario, { nome: '', nex: 5, pv: 20, defesa: 10, dano: '', descricao: '' }]);
  };

  const toggleCondicao = (c: string) => {
    const atual = sheet.condicoes ?? [];
    const next = atual.includes(c) ? atual.filter(v => v !== c) : [...atual, c];
    setField('condicoes', next);
  };

  const tabs: { id: Tab; label: string; icon: any; visible?: boolean }[] = [
    { id: 'principal', label: 'Principal', icon: BookOpen },
    { id: 'combate', label: 'Combate', icon: Sword },
    { id: 'habilidades', label: 'Habilidades', icon: ScrollText },
    { id: 'rituais', label: 'Rituais', icon: Sparkles },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'bestiario', label: 'Bestiario', icon: Skull, visible: isDm },
  ];

  const headerLabel = targetPlayerName ? `Ficha OP de ${targetPlayerName}` : 'Ficha de Ordem Paranormal';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 backdrop-blur-sm p-2 sm:p-4 overflow-auto">
      <div className="bg-card-gradient border border-border rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh]">
        <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
          <TokenImagePicker
            sessionId={sessionId}
            imageUrl={sheet.tokenImageUrl ?? null}
            offsetX={sheet.tokenImageOffsetX ?? 0}
            offsetY={sheet.tokenImageOffsetY ?? 0}
            readOnly={!canEdit}
            onChange={({ imageUrl, offsetX, offsetY }) => {
              setSheet(prev => ({ ...prev, tokenImageUrl: imageUrl, tokenImageOffsetX: offsetX, tokenImageOffsetY: offsetY }));
              setDirty(true);
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground font-display mb-0.5">{headerLabel}{readOnly ? ' (somente leitura)' : ''}</div>
            <TF value={sheet.nomePersonagem} onChange={v => setField('nomePersonagem', v)} placeholder="Nome do Personagem" readOnly={!canEdit} className="bg-transparent border-none px-0 text-xl font-display" />
          </div>
          {dirty && canEdit && (
            <Button size="sm" onClick={save} disabled={saving} className="font-display text-xs h-7">
              <Save className="w-3 h-3 mr-1" />{saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {tabs.filter(t => t.visible !== false).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 px-2 text-xs font-display transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tab === t.id ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {tab === 'principal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Jogador</label>
                  <TF value={sheet.nomeJogador || targetPlayerName || player?.name || ''} onChange={v => setField('nomeJogador', v)} readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Classe</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={sheet.classe}
                      disabled={!canEdit}
                      onChange={e => setClasse((e.target.value as OPClasse) || '')}
                      className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                    >
                      <option value="">- Selecione -</option>
                      {Object.keys(OP_CLASSES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <HoverCard openDelay={180} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          className="h-8 w-8 rounded border border-border bg-secondary text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
                          aria-label="Ver regras da classe"
                        >
                          i
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-[360px] sm:w-[420px]">
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-display text-gold">{sheet.classe || 'Classe'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {sheet.classe ? OP_CLASSES[sheet.classe]?.descricao : 'Selecione uma classe para ver suas regras.'}
                            </div>
                          </div>

                          {sheet.classe && (
                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-1 gap-1.5 rounded-md border border-border bg-secondary/30 p-2">
                                <div><span className="text-muted-foreground">PV iniciais:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].pvInicial}</span></div>
                                <div><span className="text-muted-foreground">PV por NEX:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].pvPorNex} PV (+Vig)</span></div>
                                <div><span className="text-muted-foreground">PE iniciais:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].peInicial}</span></div>
                                <div><span className="text-muted-foreground">PE por NEX:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].pePorNex} PE (+Pre)</span></div>
                                <div><span className="text-muted-foreground">SAN inicial:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].sanInicial}</span></div>
                                <div><span className="text-muted-foreground">SAN por NEX:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].sanPorNex} SAN</span></div>
                              </div>

                              <div className="grid grid-cols-1 gap-1.5 rounded-md border border-border bg-secondary/30 p-2">
                                <div><span className="text-muted-foreground">Perícias treinadas:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].periciasTreinadas}</span></div>
                                <div><span className="text-muted-foreground">Proficiências:</span> <span className="text-foreground">{OP_CLASSES[sheet.classe].proficiencias}</span></div>
                              </div>

                              <div className="rounded-md border border-border bg-secondary/30 p-2">
                                <div className="text-[10px] uppercase tracking-widest text-gold/80 mb-2">Progressão NEX</div>
                                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                                  {OP_CLASSES[sheet.classe].progressaoNex.map(item => (
                                    <div key={`${sheet.classe}-${item.nex}`} className="flex items-start gap-2">
                                      <span className="w-10 shrink-0 text-muted-foreground">{item.nex}</span>
                                      <span className="text-foreground flex-1">{item.habilidades}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Origem</label>
                  <div className="flex gap-1">
                    <select
                      value={sheet.origem}
                      disabled={!canEdit}
                      onChange={e => applyOrigem(e.target.value)}
                      className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                    >
                      <option value="">- Selecione -</option>
                      {opcoesOrigem.map(origem => (
                        <option key={origem.nome} value={origem.nome}>{origem.nome}</option>
                      ))}
                    </select>
                    {canEdit && <Button type="button" variant="secondary" size="sm" className="h-8 px-3" onClick={addOrigemCustomizada}>Nova origem</Button>}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">NEX</label>
                  <N value={sheet.nex} onChange={setNex} min={5} max={99} readOnly={!canEdit} className="w-full" />
                  {sheet.regraIdadeAtiva && ageNexBonus > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">NEX efetivo: {effectiveNex}% (+{ageNexBonus}% por idade)</div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Trilha</label>
                  <TF value={sheet.trilha} onChange={v => setField('trilha', v as OPSheetData['trilha'])} readOnly={!canEdit} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                <SectionTitle>Regra Opcional: Idade</SectionTitle>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={sheet.regraIdadeAtiva} disabled={!canEdit} onChange={e => setRegraIdadeAtiva(e.target.checked)} />
                  Ativar personagens de idade variada
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-display">Faixa etaria</label>
                    <select
                      value={sheet.faixaEtaria}
                      disabled={!canEdit || !sheet.regraIdadeAtiva}
                      onChange={e => setFaixaEtaria(e.target.value as OPAgeBracket)}
                      className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground w-full ${(!canEdit || !sheet.regraIdadeAtiva) ? 'opacity-70 cursor-default' : ''}`}
                    >
                      {Object.entries(OP_AGE_BRACKETS).map(([key, item]) => (
                        <option key={key} value={key}>{item.label} ({item.faixa})</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    {OP_AGE_BRACKETS[sheet.faixaEtaria].descricao}
                    <div className="mt-1">Desvantagens obrigatorias: {getOPAgeRequiredDrawbacks(sheet.regraIdadeAtiva, sheet.faixaEtaria)}</div>
                  </div>
                </div>

                {sheet.regraIdadeAtiva && getOPAgeRequiredDrawbacks(sheet.regraIdadeAtiva, sheet.faixaEtaria) > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground font-display">Desvantagens de idade</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {OP_AGE_DRAWBACKS.map((drawback) => {
                        const checked = sheet.desvantagensIdade.includes(drawback.nome);
                        const required = getOPAgeRequiredDrawbacks(sheet.regraIdadeAtiva, sheet.faixaEtaria);
                        const atLimit = !checked && sheet.desvantagensIdade.length >= required;
                        return (
                          <label key={drawback.nome} className={`flex items-start gap-2 rounded border border-border px-2 py-1 text-xs ${atLimit ? 'opacity-60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canEdit || atLimit}
                              onChange={() => toggleDesvantagemIdade(drawback.nome)}
                            />
                            <span>
                              <span className="text-foreground">{drawback.nome}</span>
                              <span className="text-muted-foreground block">{drawback.descricao}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <SectionTitle>Atributos</SectionTitle>
                <div className="text-[10px] text-muted-foreground mb-1">Clique no atributo para rolar 1d20 + atributo. Você pode adicionar bônus extra na hora.</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {OP_ATTRIBUTES.map(attr => (
                    <div key={attr} className="bg-secondary/50 border border-border rounded-lg p-2 text-center">
                      <button
                        type="button"
                        disabled={!canRoll}
                        onClick={() => rollCheck(OP_ATTR_LABELS[attr], sheet[attr], sheet[attr])}
                        className={`text-[10px] font-display text-gold/80 ${canRoll ? 'hover:text-gold hover:underline cursor-pointer' : 'cursor-default opacity-70'}`}
                        title={canRoll ? `Clique para rolar ${Math.max(1, sheet[attr])}d20 (pega o melhor)` : 'Rolar indisponível nesta ficha'}
                      >
                        {OP_ATTR_SHORT[attr]}
                      </button>
                      <N value={sheet[attr]} onChange={v => setAtributo(attr, v)} min={-5} max={getOPAgeAttrMax(sheet.regraIdadeAtiva, sheet.faixaEtaria, attr)} readOnly={!canEdit} className="w-full" />
                      <div className="text-[10px] text-muted-foreground mt-1">{OP_ATTR_LABELS[attr]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionTitle>Pericias</SectionTitle>
                <div className="text-[10px] text-muted-foreground mb-1">Clique na perícia para rolar 1d20 + atributo + treino. Bônus extra opcional também pode ser somado.</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {OP_PERICIAS.map(per => {
                    const prof = (sheet.pericias[per.nome] ?? 0) as OPProficiencia;
                    const bonus = opSkillBonus(sheet, per);
                    const attrValue = sheet[per.atributo];
                    const tags = [
                      per.somenteTreinada ? 'Treinada' : null,
                      per.aplicaCarga ? 'Carga' : null,
                      per.requerKit ? 'Kit' : null,
                    ].filter(Boolean).join(' • ');
                    return (
                      <div key={per.nome} className="flex items-start gap-2 bg-secondary/30 border border-border rounded px-2 py-1.5">
                        <button
                          className={`px-1.5 py-0.5 rounded text-[10px] font-display border ${prof > 0 ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-muted-foreground'} ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                          onClick={() => {
                            if (!canEdit) return;
                            const next = ((prof + 1) % 4) as OPProficiencia;
                            setField('pericias', { ...sheet.pericias, [per.nome]: next });
                          }}
                          title={`${PROF_LABEL[prof]} (+${PROF_BONUS[prof]})`}
                        >
                          +{PROF_BONUS[prof]}
                        </button>
                        <button
                          type="button"
                          disabled={!canRoll}
                          onClick={() => rollCheck(per.label, bonus, attrValue, per.nome === 'iniciativa')}
                          className={`text-xs text-left text-foreground flex-1 ${canRoll ? 'hover:text-gold cursor-pointer' : 'cursor-default'}`}
                          title={canRoll ? `Rolar ${Math.max(1, attrValue)}d20 (melhor) + ${bonus}${per.nome === 'iniciativa' ? ' (adiciona ao combate se ativo)' : ''}` : per.descricao}
                        >
                          <div className="leading-tight">{per.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{per.descricao}</div>
                          {tags && <div className="text-[10px] text-gold/80 mt-0.5">{tags}</div>}
                        </button>
                        <span className="text-xs text-muted-foreground">{OP_ATTR_SHORT[per.atributo]}</span>
                        <span className={`text-xs font-display w-8 text-right ${bonus >= 0 ? 'text-green-400' : 'text-foreground'}`}>{bonus >= 0 ? '+' : ''}{bonus}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'combate' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-[10px] text-muted-foreground font-display">PV Atual</label><N value={sheet.pvAtual} onChange={setPVAtual} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PV Max</label><N value={sheet.maxPV} onChange={v => setField('maxPV', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PV Temp</label><N value={sheet.pvTemp} onChange={setPVTemp} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">SAN Atual</label><N value={sheet.psAtual} onChange={setSANAtual} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">SAN Max</label><N value={sheet.maxPS} onChange={v => setField('maxPS', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">SAN Temp</label><N value={sheet.psTemp} onChange={setSANTemp} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PE Atual</label><N value={sheet.peAtual} onChange={setPEAtual} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PE Max</label><N value={sheet.maxPE} onChange={v => setField('maxPE', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PE Temp</label><N value={sheet.peTemp} onChange={setPETemp} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Defesa</label><N value={sheet.defesa} onChange={() => {}} readOnly className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Deslocamento (m)</label><N value={sheet.deslocamento} onChange={v => setField('deslocamento', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Protecao</label><N value={sheet.protecao} onChange={setProtecao} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Mod. Defesa</label><N value={sheet.defesaOutrosMod} onChange={setDefesaOutrosMod} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Panico (0-5)</label><N value={sheet.panico} onChange={v => setField('panico', Math.max(0, Math.min(5, v)))} readOnly={!canEdit} className="w-full" /></div>
              </div>
              <div className="text-xs text-muted-foreground">Regra aplicada: Defesa = 10 + AGI + Protecao + Mod. Defesa. PV/PE/SAN atuais nao ultrapassam o maximo. Pontos temporarios podem exceder o maximo.</div>

              <div className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sheet.morteIminente} disabled={!canEdit} onChange={e => setField('morteIminente', e.target.checked)} />
                <span className="text-foreground">Morte Iminente</span>
              </div>

              <div>
                <SectionTitle>Ataques</SectionTitle>
                <div className="space-y-2">
                  {sheet.ataques.map((atk, i) => (
                    <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-secondary/30 border border-border rounded p-2">
                      <TF value={atk.nome} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, nome: v } : a))} placeholder="Nome" readOnly={!canEdit} />
                      <TF value={atk.bonus} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, bonus: v } : a))} placeholder="Bonus" readOnly={!canEdit} />
                      <TF value={atk.dano} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, dano: v } : a))} placeholder="Dano" readOnly={!canEdit} />
                      <TF value={atk.tipo} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, tipo: v } : a))} placeholder="Tipo" readOnly={!canEdit} />
                      <TF value={atk.critico} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, critico: v } : a))} placeholder="Critico" readOnly={!canEdit} />
                      <div className="flex gap-1">
                        <TF value={atk.alcance} onChange={v => setField('ataques', sheet.ataques.map((a, idx) => idx === i ? { ...a, alcance: v } : a))} placeholder="Alcance" readOnly={!canEdit} />
                        {canEdit && (
                          <button className="px-2 rounded bg-destructive/20 text-destructive" onClick={() => setField('ataques', sheet.ataques.filter((_, idx) => idx !== i))}>x</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {canEdit && <Button size="sm" variant="secondary" className="mt-2" onClick={addAtaque}>Adicionar Ataque</Button>}
              </div>

              <div>
                <SectionTitle>Condicoes</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OP_CONDICOES.map(c => (
                    <label key={c} className="flex items-center gap-2 text-xs text-foreground">
                      <input type="checkbox" checked={(sheet.condicoes ?? []).includes(c)} disabled={!canEdit} onChange={() => toggleCondicao(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'rituais' && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Rituais com circulo, elemento e criacao customizada. Clique em "Lançar" para usar o ritual.</div>
              {sheet.rituais.map((ritual, i) => (
                <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <TF value={ritual.nome} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, nome: v } : r))} placeholder="Nome" readOnly={!canEdit} />
                    <N value={ritual.circulo} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, circulo: Math.max(1, Math.min(5, v)) } : r))} min={1} max={5} readOnly={!canEdit} className="w-full" />
                    <select
                      value={ritual.elemento}
                      disabled={!canEdit}
                      onChange={e => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, elemento: e.target.value } : r))}
                      className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground w-full ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                    >
                      {ELEMENTOS_PADRAO.map(el => <option key={el} value={el}>{el}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <TF value={ritual.execucao} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, execucao: v } : r))} placeholder="Execucao" readOnly={!canEdit} />
                    <TF value={ritual.alcance} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, alcance: v } : r))} placeholder="Alcance" readOnly={!canEdit} />
                    <div className="flex gap-1">
                      <TF value={ritual.custo} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, custo: v } : r))} placeholder="Custo" readOnly={!canEdit} />
                      {canEdit && <button className="px-2 rounded bg-destructive/20 text-destructive" onClick={() => setField('rituais', sheet.rituais.filter((_, idx) => idx !== i))}>x</button>}
                    </div>
                  </div>
                  <TA value={ritual.descricao} onChange={v => setField('rituais', sheet.rituais.map((r, idx) => idx === i ? { ...r, descricao: v } : r))} rows={2} readOnly={!canEdit} />
                  {canRoll && ritual.nome && ritual.custo && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const custoMatch = ritual.custo.match(/\d+/);
                        const custoPE = custoMatch ? parseInt(custoMatch[0]) : 1;
                        setCastingRitual({
                          id: `ritual-${i}`,
                          nome: ritual.nome,
                          circulo: ritual.circulo,
                          elemento: ritual.elemento,
                          execucao: ritual.execucao || 'Padrão',
                          alcance: ritual.alcance || 'Pessoal',
                          alvo: 'Você',
                          duracao: 'Instantânea',
                          resistencia: '',
                          descricao: ritual.descricao,
                          custo_pe: custoPE,
                        });
                      }}
                      className="w-full"
                    >
                      <Sparkles className="w-3 h-3 mr-1" /> Lançar Ritual
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && <Button size="sm" variant="secondary" onClick={addRitual}>Adicionar Ritual</Button>}
            </div>
          )}

          {tab === 'habilidades' && (
            <div className="space-y-4">
              <div>
                <SectionTitle>Lista de Habilidades da Classe</SectionTitle>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-muted-foreground">
                    {sheet.classe ? `Classe atual: ${sheet.classe}` : 'Selecione uma classe para ver habilidades disponiveis.'}
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setClassAbilityDialogOpen(true)}
                      disabled={!sheet.classe}
                    >
                      Lista de habilidades
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {CLASS_FILTERS.map(classe => {
                    const active = classAbilityClassFilter === classe;
                    const blocked = !isDm && sheet.classe !== classe;
                    return (
                      <button
                        key={classe}
                        type="button"
                        disabled={blocked || !sheet.classe}
                        onClick={() => {
                          if (blocked || !sheet.classe) return;
                          setClassAbilityClassFilter(classe);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-display border transition-colors ${
                          active ? 'bg-gold/15 border-gold text-gold' : 'bg-secondary border-border text-muted-foreground'
                        } ${blocked || !sheet.classe ? 'opacity-50 cursor-not-allowed' : 'hover:text-foreground hover:border-gold/40'}`}
                        title={blocked ? 'Voce so pode escolher a lista da sua classe' : `Ver lista de ${classe}`}
                      >
                        {classe}
                      </button>
                    );
                  })}
                </div>

                {selectedClassAbilities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedClassAbilities.map((ability) => (
                      <div key={ability.nome} className="rounded-md border border-border bg-secondary/30 p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-sm font-display text-foreground">{ability.nome}</div>
                          {canEdit && (
                            <button
                              className="px-2 rounded bg-destructive/20 text-destructive"
                              onClick={() => toggleClassAbility(ability.nome)}
                            >
                              x
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{ability.descricao}</div>
                        {ability.prerequisitos && (
                          <div className="text-xs text-gold/90 mt-1">Pre-requisitos: {ability.prerequisitos}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Nenhuma habilidade de classe adicionada ainda.</div>
                )}
              </div>

              <div>
                <SectionTitle>Poder da Origem</SectionTitle>
                <div className="grid grid-cols-1 gap-2">
                  <TF value={sheet.origemPoderNome} onChange={v => setField('origemPoderNome', v)} placeholder="Nome do poder" readOnly={!canEdit} />
                  <TA value={sheet.origemPoderDescricao} onChange={v => setField('origemPoderDescricao', v)} rows={3} readOnly={!canEdit} />
                </div>
              </div>

              <div>
                <SectionTitle>Poderes Gerais</SectionTitle>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-muted-foreground">Qualquer classe pode escolher, desde que cumpra os pre-requisitos.</div>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setGeneralAbilityDialogOpen(true)}
                    >
                      Lista de poderes gerais
                    </Button>
                  )}
                </div>

                {selectedGeneralAbilities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedGeneralAbilities.map((ability) => (
                      <div key={ability.nome} className="rounded-md border border-border bg-secondary/30 p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-sm font-display text-foreground">{ability.nome}</div>
                          {canEdit && (
                            <button
                              className="px-2 rounded bg-destructive/20 text-destructive"
                              onClick={() => toggleGeneralAbility(ability.nome)}
                            >
                              x
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{ability.descricao}</div>
                        <div className="text-xs text-gold/90 mt-1">Pre-requisitos: {ability.prerequisitos}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Nenhum poder geral adicionado ainda.</div>
                )}
              </div>

              <div>
                <SectionTitle>Habilidades Extras</SectionTitle>
                <div className="space-y-2">
                  {sheet.habilidadesExtras.map((habilidade, i) => (
                    <div key={i} className="flex gap-2">
                      <TF
                        value={habilidade}
                        onChange={v => setField('habilidadesExtras', sheet.habilidadesExtras.map((h, idx) => idx === i ? v : h))}
                        placeholder="Ex: Contato na imprensa, treinamento de escalada..."
                        readOnly={!canEdit}
                      />
                      {canEdit && (
                        <button
                          className="px-2 rounded bg-destructive/20 text-destructive"
                          onClick={() => setField('habilidadesExtras', sheet.habilidadesExtras.filter((_, idx) => idx !== i))}
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && <Button size="sm" variant="secondary" className="mt-2" onClick={addHabilidadeExtra}>Adicionar Habilidade Extra</Button>}
              </div>
            </div>
          )}

          {tab === 'inventario' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Dinheiro (R$)</label>
                  <N value={sheet.dinheiro} onChange={v => setField('dinheiro', Math.max(0, v))} readOnly={!canEdit} className="w-full" />
                </div>
              </div>

              <SectionTitle>Equipamentos</SectionTitle>
              <div className="text-[10px] text-muted-foreground">Use categorias de 0 a 4 conforme regras da Ordem. Campos com titulo acima para evitar confusao.</div>
              <div className="space-y-2">
                {sheet.equipamentos.map((item, i) => (
                  <div key={i} className="space-y-2 bg-secondary/30 border border-border rounded p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Item</label>
                        <TF value={item.name} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, name: v } : it))} placeholder="" readOnly={!canEdit} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Peso</label>
                        <N value={item.weight} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, weight: Math.max(0, v) } : it))} min={0} readOnly={!canEdit} className="w-full" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Categoria (0-4)</label>
                        <N value={item.category ?? 0} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, category: Math.max(0, Math.min(4, v)) } : it))} min={0} max={4} readOnly={!canEdit} className="w-full" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Dano</label>
                        <TF value={item.damage ?? ''} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, damage: v } : it))} placeholder="Ex: 1d12" readOnly={!canEdit} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Critico</label>
                        <TF value={item.critical ?? ''} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, critical: v } : it))} placeholder="Ex: x3" readOnly={!canEdit} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Tipo</label>
                        <TF value={item.damageType ?? ''} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, damageType: v } : it))} placeholder="Ex: Corte" readOnly={!canEdit} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Valor</label>
                        <TF value={item.cost} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, cost: v } : it))} placeholder="" readOnly={!canEdit} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-display">Descricao</label>
                        <div className="flex gap-1">
                          <TF value={item.notes} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, notes: v } : it))} placeholder="" readOnly={!canEdit} />
                          {canEdit && <button className="px-2 rounded bg-destructive/20 text-destructive" onClick={() => setField('equipamentos', sheet.equipamentos.filter((_, idx) => idx !== i))}>x</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setActiveCatalog('armas'); setItemListDialogOpen(true); }}>
                    <Package className="w-3.5 h-3.5 mr-1" /> Lista de Itens
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setCreateItemDialogOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Criar Item
                  </Button>
                </div>
              )}

              <SectionTitle>Anotacoes</SectionTitle>
              <TA value={sheet.anotacoes} onChange={v => setField('anotacoes', v)} rows={5} readOnly={!canEdit} />
            </div>
          )}

          {tab === 'bestiario' && isDm && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Somente mestre: gerencie criaturas paranormais da sessao.</div>
              {(sheet.bestiario ?? []).map((criatura, i) => (
                <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <TF value={criatura.nome} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, nome: v } : c))} placeholder="Nome" readOnly={!canEdit} />
                    <N value={criatura.nex} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, nex: Math.max(0, Math.min(99, v)) } : c))} min={0} max={99} readOnly={!canEdit} className="w-full" />
                    <N value={criatura.pv} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, pv: Math.max(1, v) } : c))} min={1} readOnly={!canEdit} className="w-full" />
                    <N value={criatura.defesa} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, defesa: Math.max(0, v) } : c))} min={0} readOnly={!canEdit} className="w-full" />
                  </div>
                  <div className="flex gap-2">
                    <TF value={criatura.dano} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, dano: v } : c))} placeholder="Dano" readOnly={!canEdit} />
                    {canEdit && <button className="px-2 rounded bg-destructive/20 text-destructive" onClick={() => setField('bestiario', (sheet.bestiario ?? []).filter((_, idx) => idx !== i))}>x</button>}
                  </div>
                  <TA value={criatura.descricao} onChange={v => setField('bestiario', (sheet.bestiario ?? []).map((c, idx) => idx === i ? { ...c, descricao: v } : c))} rows={2} readOnly={!canEdit} />
                </div>
              ))}
              {canEdit && <Button size="sm" variant="secondary" onClick={addBestiario}>Adicionar Criatura</Button>}
            </div>
          )}
        </div>
      </div>

      <Dialog open={originDialogOpen} onOpenChange={setOriginDialogOpen}>
        <DialogContent className="sm:max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Nova origem</DialogTitle>
            <DialogDescription>
              Crie uma origem personalizada com até duas pericias treinadas e um poder próprio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <label className="text-xs font-display text-muted-foreground">Nome da origem</label>
              <Input value={originForm.nome} onChange={e => setOriginForm(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: Caçador Urbano" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-display text-muted-foreground">Pericia 1</label>
                <Input value={originForm.pericia1} onChange={e => setOriginForm(prev => ({ ...prev, pericia1: e.target.value }))} placeholder="Ex: Investigação" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-display text-muted-foreground">Pericia 2</label>
                <Input value={originForm.pericia2} onChange={e => setOriginForm(prev => ({ ...prev, pericia2: e.target.value }))} placeholder="Ex: Percepção" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-display text-muted-foreground">Nome do poder</label>
              <Input value={originForm.poderNome} onChange={e => setOriginForm(prev => ({ ...prev, poderNome: e.target.value }))} placeholder="Ex: Faro Apurado" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-display text-muted-foreground">Descricao do poder</label>
              <textarea
                value={originForm.poderDescricao}
                onChange={e => setOriginForm(prev => ({ ...prev, poderDescricao: e.target.value }))}
                placeholder="Descreva o beneficio da origem"
                rows={4}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOriginDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewOrigin}>Salvar origem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={classAbilityDialogOpen} onOpenChange={setClassAbilityDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Lista de habilidades</DialogTitle>
            <DialogDescription>
              Escolha as habilidades da classe {sheet.classe || 'selecionada'} para adicionar na ficha.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
            {classAbilities.length === 0 && (
              <div className="text-xs text-muted-foreground">Nao ha habilidades cadastradas para esta classe.</div>
            )}
            {classAbilities.map((ability) => {
              const selected = isClassAbilitySelected(ability.nome);
              const requirementError = getClassAbilityRequirementError(ability);
              return (
                <div key={ability.nome} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="text-sm font-display text-foreground">{ability.nome}</div>
                      <div className="text-xs text-muted-foreground">Classe: {ability.classe}</div>
                    </div>
                    {canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'outline' : 'secondary'}
                        onClick={() => toggleClassAbility(ability.nome)}
                        disabled={!selected && !!requirementError}
                        title={!selected ? (requirementError ?? undefined) : undefined}
                      >
                        {selected ? 'Remover' : 'Adicionar'}
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{ability.descricao}</div>
                  {ability.prerequisitos && (
                    <div className="text-xs text-gold/90 mt-1">Pre-requisitos: {ability.prerequisitos}</div>
                  )}
                  {!selected && requirementError && (
                    <div className="text-xs text-destructive mt-1">{requirementError}</div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setClassAbilityDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generalAbilityDialogOpen} onOpenChange={setGeneralAbilityDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Poderes gerais</DialogTitle>
            <DialogDescription>
              Todos podem escolher poderes gerais, desde que os requisitos minimos sejam atendidos.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
            {OP_GENERAL_ABILITIES.map((ability) => {
              const selected = isGeneralAbilitySelected(ability.nome);
              const requirementError = getGeneralAbilityRequirementError(ability);
              return (
                <div key={ability.nome} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="text-sm font-display text-foreground">{ability.nome}</div>
                      <div className="text-xs text-gold/90">Pre-requisitos: {ability.prerequisitos}</div>
                    </div>
                    {canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'outline' : 'secondary'}
                        onClick={() => toggleGeneralAbility(ability.nome)}
                        disabled={!selected && !!requirementError}
                        title={!selected ? (requirementError ?? undefined) : undefined}
                      >
                        {selected ? 'Remover' : 'Adicionar'}
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{ability.descricao}</div>
                  {!selected && requirementError && (
                    <div className="text-xs text-destructive mt-1">{requirementError}</div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setGeneralAbilityDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {castingRitual && player && (
        <RitualCast
          playerId={player.id}
          sessionId={sessionId}
          ritual={castingRitual}
          currentPE={sheet.peAtual}
          maxPE={sheet.maxPE}
          nex={effectiveNex}
          onClose={() => setCastingRitual(null)}
          onCast={(ritual, peCost) => {
            setPEAtual(sheet.peAtual - peCost);
            setCastingRitual(null);
          }}
        />
      )}

      <Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Bônus Extra</DialogTitle>
            <DialogDescription>
              {bonusDialogData && `Rolando ${bonusDialogData.label}. Adicione um bônus ou penalidade extra (opcional).`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-display text-muted-foreground">Bônus/Penalidade (use - para penalidade)</label>
              <Input
                type="number"
                value={bonusInput}
                onChange={(e) => setBonusInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeRoll();
                  if (e.key === 'Escape') setShowBonusDialog(false);
                }}
                placeholder="0"
                autoFocus
                className="text-center text-lg"
              />
              <div className="text-xs text-muted-foreground text-center">
                Exemplos: +2 (vantagem), -3 (penalidade), 0 (sem modificador)
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowBonusDialog(false)}>Cancelar</Button>
            <Button onClick={executeRoll}>Rolar Dados</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemListDialogOpen} onOpenChange={setItemListDialogOpen}>
        <DialogContent className="sm:max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Lista de Itens</DialogTitle>
            <DialogDescription>
              Clique no botao de adicionar para enviar o item direto para sua ficha.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {OP_CATALOG_TABS.map((tabItem) => (
              <Button
                key={tabItem.id}
                size="sm"
                variant={activeCatalog === tabItem.id ? 'default' : 'secondary'}
                className={activeCatalog === tabItem.id ? 'bg-gold text-background hover:bg-gold/90' : ''}
                onClick={() => setActiveCatalog(tabItem.id)}
              >
                {tabItem.label}
              </Button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3">
            {OP_ITEM_CATALOG.filter((catalogItem) => catalogItem.catalog === activeCatalog).map((catalogItem) => (
              <div key={catalogItem.name} className="bg-[#17171d] border border-gold/25 overflow-hidden">
                <div className="px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ChevronUp className="w-3.5 h-3.5 text-gold shrink-0" />
                        <span className="text-xl leading-none font-display text-white">{catalogItem.name}</span>
                        <span className="text-sm italic text-white/90 truncate">{catalogItem.group}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-gold">Categoria: <span className="text-white">{formatCategory(catalogItem.category)}</span></span>
                        <span className="text-gold">Dano: <span className="text-white">{catalogItem.damage}</span></span>
                        <span className="text-gold">Critico: <span className="text-white">{catalogItem.critical}</span></span>
                        {catalogItem.range && <span className="text-gold">Alcance: <span className="text-white">{catalogItem.range}</span></span>}
                        <span className="text-gold">Tipo: <span className="text-white">{catalogItem.damageType}</span></span>
                        <span className="text-gold">Espacos: <span className="text-white">{catalogItem.spaces}</span></span>
                        {catalogItem.ammo && <span className="text-gold">Munição: <span className="text-white">{catalogItem.ammo}</span></span>}
                      </div>
                    </div>

                    <button
                      className="h-8 w-8 flex items-center justify-center bg-gold hover:bg-gold/90 text-background transition-colors shrink-0"
                      onClick={() => addCatalogItem(catalogItem)}
                      title="Adicionar item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-gold/80" />

                <div className="px-3 py-2 text-base text-white">
                  {catalogItem.description}
                </div>
              </div>
            ))}

            {OP_ITEM_CATALOG.filter((catalogItem) => catalogItem.catalog === activeCatalog).length === 0 && (
              <div className="rounded-md border border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
                Nenhum item cadastrado nesta categoria ainda.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setItemListDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createItemDialogOpen} onOpenChange={setCreateItemDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Criar Item</DialogTitle>
            <DialogDescription>
              Use para itens que nao estao na lista pronta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-display">Item</label>
              <Input value={customItemForm.name} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome do item" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Peso</label>
                <Input type="number" min={0} value={customItemForm.weight} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, weight: parseInt(e.target.value, 10) || 0 }))} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Categoria (0-4)</label>
                <Input type="number" min={0} max={4} value={customItemForm.category ?? 0} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, category: Math.max(0, Math.min(4, parseInt(e.target.value, 10) || 0)) }))} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Valor</label>
                <Input value={customItemForm.cost} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, cost: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Dano</label>
                <Input value={customItemForm.damage ?? ''} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, damage: e.target.value }))} placeholder="Ex: 1d12" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Critico</label>
                <Input value={customItemForm.critical ?? ''} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, critical: e.target.value }))} placeholder="Ex: x3" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-display">Tipo</label>
                <Input value={customItemForm.damageType ?? ''} onChange={(e) => setCustomItemForm((prev) => ({ ...prev, damageType: e.target.value }))} placeholder="Ex: Corte" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-display">Descricao</label>
              <TA value={customItemForm.notes} onChange={(v) => setCustomItemForm((prev) => ({ ...prev, notes: v }))} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createCustomItem}>Criar e Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

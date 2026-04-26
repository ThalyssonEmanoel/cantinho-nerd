import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { X, Save, BookOpen, Sword, Sparkles, Package, Skull, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
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
          next.pvAtual = next.pvAtual > 0 ? Math.min(next.maxPV, next.pvAtual) : next.maxPV;
          next.peAtual = next.peAtual > 0 ? Math.min(next.maxPE, next.peAtual) : next.maxPE;
          next.psAtual = next.psAtual > 0 ? Math.min(next.maxPS, next.psAtual) : next.maxPS;
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

  const requestExtraBonus = (label: string) => {
    const raw = window.prompt(`Bônus extra para ${label}?`, '0');
    if (raw === null) return null;
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    if (!/^[+-]?\d+$/.test(trimmed)) {
      toast.error('Bônus inválido. Use um número inteiro.');
      return null;
    }
    return parseInt(trimmed, 10);
  };

  const rollCheck = async (label: string, baseModifier: number) => {
    if (!canRoll || !player) return;

    const extraBonus = requestExtraBonus(label);
    if (extraBonus === null) return;

    const d20 = Math.floor(Math.random() * 20) + 1;
    const totalModifier = baseModifier + extraBonus;
    const total = d20 + totalModifier;
    const formula = `1d20 ${formatSigned(totalModifier)} (${label}${extraBonus !== 0 ? `, bônus ${formatSigned(extraBonus)}` : ''})`;

    if (diceChannelRef.current) {
      diceChannelRef.current.send({
        type: 'broadcast',
        event: 'roll_announce',
        payload: {
          playerId: player.id,
          playerName: player.name,
          formula,
          total,
          critical: d20 === 20,
        },
      });
    }

    const { error } = await supabase.from('dice_rolls').insert({
      session_id: sessionId,
      player_id: player.id,
      player_name: player.name,
      player_avatar: player.avatar_url,
      dice_formula: formula,
      results: [d20],
      modifier: totalModifier,
      total,
      is_hidden: role === 'dm',
    });

    if (error) {
      toast.error(`Erro ao registrar rolagem: ${error.message}`);
      return;
    }

    toast.success(`${label}: ${total}`);
  };

  const addAtaque = () => {
    const novos = [...sheet.ataques, { nome: '', bonus: '', dano: '', tipo: '', critico: '20/x2', alcance: '' } as OPAtaque];
    setField('ataques', novos);
  };

  const addRitual = () => {
    const novos = [...sheet.rituais, { nome: '', circulo: 1, elemento: 'Morte', execucao: '', alcance: '', custo: '1 PE', descricao: '' } as OPRitual];
    setField('rituais', novos);
  };

  const addItem = () => {
    const novos = [...sheet.equipamentos, { name: '', qty: 1, weight: 0, cost: '', notes: '' } as InventoryItem];
    setField('equipamentos', novos);
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
          <div className="flex-1">
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
                        onClick={() => rollCheck(OP_ATTR_LABELS[attr], sheet[attr])}
                        className={`text-[10px] font-display text-gold/80 ${canRoll ? 'hover:text-gold hover:underline cursor-pointer' : 'cursor-default opacity-70'}`}
                        title={canRoll ? 'Clique para rolar este atributo' : 'Rolar indisponível nesta ficha'}
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
                          onClick={() => rollCheck(per.label, bonus)}
                          className={`text-xs text-left text-foreground flex-1 ${canRoll ? 'hover:text-gold cursor-pointer' : 'cursor-default'}`}
                          title={per.descricao}
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
              <div className="text-xs text-muted-foreground">Rituais com circulo, elemento e criacao customizada.</div>
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
              <div className="space-y-2">
                {sheet.equipamentos.map((item, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-secondary/30 border border-border rounded p-2">
                    <TF value={item.name} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, name: v } : it))} placeholder="Item" readOnly={!canEdit} />
                    <N value={item.qty} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, v) } : it))} min={1} readOnly={!canEdit} className="w-full" />
                    <N value={item.weight} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, weight: Math.max(0, v) } : it))} min={0} readOnly={!canEdit} className="w-full" />
                    <TF value={item.cost} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, cost: v } : it))} placeholder="Valor" readOnly={!canEdit} />
                    <div className="flex gap-1">
                      <TF value={item.notes} onChange={v => setField('equipamentos', sheet.equipamentos.map((it, idx) => idx === i ? { ...it, notes: v } : it))} placeholder="Descricao" readOnly={!canEdit} />
                      {canEdit && <button className="px-2 rounded bg-destructive/20 text-destructive" onClick={() => setField('equipamentos', sheet.equipamentos.filter((_, idx) => idx !== i))}>x</button>}
                    </div>
                  </div>
                ))}
              </div>
              {canEdit && <Button size="sm" variant="secondary" onClick={addItem}>Adicionar Item</Button>}

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
    </div>
  );
}

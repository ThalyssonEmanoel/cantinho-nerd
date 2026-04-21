import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { X, Save, BookOpen, Sword, Sparkles, Package, Skull } from 'lucide-react';
import { toast } from 'sonner';
import {
  OP_ATTRIBUTES,
  OP_ATTR_LABELS,
  OP_ATTR_SHORT,
  OP_CLASSES,
  OP_PERICIAS,
  defaultOPSheet,
  type OPClasse,
  type OPProficiencia,
  type OPSheetData,
  type OPRitual,
  type InventoryItem,
  type OPAtaque,
  opSkillBonus,
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

type Tab = 'principal' | 'combate' | 'rituais' | 'inventario' | 'bestiario';

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
  0: 'Sem treino',
  1: 'Treinado',
  2: 'Veterano',
  3: 'Expert',
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

  const isDm = role === 'dm';
  const ownerId = targetPlayerId ?? player?.id;
  const canEdit = !readOnly && (isDm || ownerId === player?.id);

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
        setSheet({ ...defaultOPSheet(), ...(data.data as Partial<OPSheetExtra>) });
      } else {
        setSheet(defaultOPSheet());
      }
      setDirty(false);
    };
    load();
  }, [ownerId, sessionId]);

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
      next.maxPV = calcOPMaxPV(classe, sheet.vig, sheet.nex);
      next.maxPE = calcOPMaxPE(classe, sheet.nex);
      next.pvAtual = Math.min(next.maxPV, sheet.pvAtual);
      next.peAtual = Math.min(next.maxPE, sheet.peAtual);
      if (!sheet.habilidades.trim()) next.habilidades = OP_CLASSES[classe].habilidades;
    }
    setSheet(next);
    setDirty(true);
  };

  const setNex = (nex: number) => {
    const clamped = Math.max(5, Math.min(99, nex));
    const next = { ...sheet, nex: clamped };
    if (sheet.classe) {
      next.maxPV = calcOPMaxPV(sheet.classe, sheet.vig, clamped);
      next.maxPE = calcOPMaxPE(sheet.classe, clamped);
      next.pvAtual = Math.min(next.maxPV, sheet.pvAtual);
      next.peAtual = Math.min(next.maxPE, sheet.peAtual);
    }
    setSheet(next);
    setDirty(true);
  };

  const setAtributo = (attr: typeof OP_ATTRIBUTES[number], value: number) => {
    const clamped = Math.max(0, Math.min(10, value));
    const next = { ...sheet, [attr]: clamped } as OPSheetExtra;
    if (sheet.classe) {
      next.maxPV = calcOPMaxPV(sheet.classe, attr === 'vig' ? clamped : sheet.vig, sheet.nex);
      next.pvAtual = Math.min(next.maxPV, sheet.pvAtual);
    }
    setSheet(next);
    setDirty(true);
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
                  <select
                    value={sheet.classe}
                    disabled={!canEdit}
                    onChange={e => setClasse((e.target.value as OPClasse) || '')}
                    className={`bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold/50 w-full ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                  >
                    <option value="">- Selecione -</option>
                    {Object.keys(OP_CLASSES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Origem</label>
                  <TF value={sheet.origem} onChange={v => setField('origem', v)} readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">NEX</label>
                  <N value={sheet.nex} onChange={setNex} min={5} max={99} readOnly={!canEdit} className="w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-display">Trilha</label>
                  <TF value={sheet.trilha} onChange={v => setField('trilha', v as OPSheetData['trilha'])} readOnly={!canEdit} />
                </div>
              </div>

              <div>
                <SectionTitle>Atributos</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {OP_ATTRIBUTES.map(attr => (
                    <div key={attr} className="bg-secondary/50 border border-border rounded-lg p-2 text-center">
                      <div className="text-[10px] font-display text-gold/80">{OP_ATTR_SHORT[attr]}</div>
                      <N value={sheet[attr]} onChange={v => setAtributo(attr, v)} min={0} max={10} readOnly={!canEdit} className="w-full" />
                      <div className="text-[10px] text-muted-foreground mt-1">{OP_ATTR_LABELS[attr]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionTitle>Pericias</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {OP_PERICIAS.map(per => {
                    const prof = (sheet.pericias[per.nome] ?? 0) as OPProficiencia;
                    const bonus = opSkillBonus(sheet, per);
                    return (
                      <div key={per.nome} className="flex items-center gap-2 bg-secondary/30 border border-border rounded px-2 py-1">
                        <button
                          className={`px-1.5 py-0.5 rounded text-[10px] font-display border ${prof > 0 ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-muted-foreground'} ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                          onClick={() => {
                            if (!canEdit) return;
                            const next = ((prof + 1) % 4) as OPProficiencia;
                            setField('pericias', { ...sheet.pericias, [per.nome]: next });
                          }}
                          title={PROF_LABEL[prof]}
                        >
                          {prof}
                        </button>
                        <span className="text-xs text-foreground flex-1 truncate">{per.label}</span>
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
                <div><label className="text-[10px] text-muted-foreground font-display">PV Atual</label><N value={sheet.pvAtual} onChange={v => setField('pvAtual', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PV Max</label><N value={sheet.maxPV} onChange={v => setField('maxPV', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PS Atual</label><N value={sheet.psAtual} onChange={v => setField('psAtual', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PS Max</label><N value={sheet.maxPS} onChange={v => setField('maxPS', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PE Atual</label><N value={sheet.peAtual} onChange={v => setField('peAtual', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">PE Max</label><N value={sheet.maxPE} onChange={v => setField('maxPE', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Defesa</label><N value={sheet.defesa} onChange={v => setField('defesa', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Deslocamento (m)</label><N value={sheet.deslocamento} onChange={v => setField('deslocamento', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Protecao</label><N value={sheet.protecao} onChange={v => setField('protecao', v)} readOnly={!canEdit} className="w-full" /></div>
                <div><label className="text-[10px] text-muted-foreground font-display">Panico (0-5)</label><N value={sheet.panico} onChange={v => setField('panico', Math.max(0, Math.min(5, v)))} readOnly={!canEdit} className="w-full" /></div>
              </div>

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
    </div>
  );
}

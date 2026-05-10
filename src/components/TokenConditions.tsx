import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Condition {
  id: string;
  token_id: string;
  condition_name: string;
  duration: number | null;
  description: string;
  icon: string;
  created_at: string;
}

interface TokenConditionsProps {
  tokenId: string;
  sessionId: string;
  canEdit: boolean;
  showPanel: boolean;
  onClose: () => void;
}

const CONDITIONS = [
  { name: 'Agarrado', icon: '🤝', description: 'Velocidade 0, não pode se mover' },
  { name: 'Caído', icon: '🔻', description: 'Desvantagem em ataques, ataques corpo a corpo têm vantagem' },
  { name: 'Envenenado', icon: '☠️', description: 'Desvantagem em testes de atributo e ataques' },
  { name: 'Cego', icon: '👁️', description: 'Falha automaticamente em testes visuais, ataques têm desvantagem' },
  { name: 'Surdo', icon: '👂', description: 'Falha automaticamente em testes auditivos' },
  { name: 'Enfraquecido', icon: '💪', description: 'Desvantagem em testes de Força' },
  { name: 'Apavorado', icon: '😱', description: 'Desvantagem em testes enquanto a fonte do medo estiver visível' },
  { name: 'Atordoado', icon: '😵', description: 'Incapacitado, não pode se mover, fala de forma confusa' },
  { name: 'Exausto', icon: '😓', description: 'Penalidades crescentes por nível de exaustão' },
  { name: 'Inconsciente', icon: '😴', description: 'Incapacitado, não pode se mover ou falar, cai objetos' },
  { name: 'Paralisado', icon: '🧊', description: 'Incapacitado, não pode se mover ou falar, falha em testes de FOR/DES' },
  { name: 'Sangrando', icon: '🩸', description: 'Perde HP no início de cada turno' },
];

export default function TokenConditions({ tokenId, sessionId, canEdit, showPanel, onClose }: TokenConditionsProps) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    loadConditions();
  }, [tokenId]);

  useEffect(() => {
    const channel = supabase
      .channel(`conditions-${tokenId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_conditions', filter: `token_id=eq.${tokenId}` },
        () => loadConditions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tokenId]);

  const loadConditions = async () => {
    const { data } = await supabase
      .from('token_conditions')
      .select('*')
      .eq('token_id', tokenId)
      .order('created_at', { ascending: false });
    if (data) setConditions(data as Condition[]);
  };

  const addCondition = async () => {
    if (!canEdit || !selectedCondition) return;
    
    const conditionData = CONDITIONS.find(c => c.name === selectedCondition);
    if (!conditionData) return;

    await supabase.from('token_conditions').insert({
      token_id: tokenId,
      session_id: sessionId,
      condition_name: conditionData.name,
      duration: duration ? parseInt(duration) : null,
      description: conditionData.description,
      icon: conditionData.icon,
    });

    setSelectedCondition('');
    setDuration('');
    setShowAddPanel(false);
  };

  const removeCondition = async (id: string) => {
    if (!canEdit) return;
    await supabase.from('token_conditions').delete().eq('id', id);
  };

  const decrementDuration = async (condition: Condition) => {
    if (!canEdit || !condition.duration) return;
    
    const newDuration = condition.duration - 1;
    if (newDuration <= 0) {
      await removeCondition(condition.id);
    } else {
      await supabase.from('token_conditions').update({ duration: newDuration }).eq('id', condition.id);
    }
  };

  if (!showPanel) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute -top-20 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-2xl p-3 z-50 min-w-[200px] max-w-[280px]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display text-xs text-gold">Condições</h4>
        <button onClick={onClose}><X className="w-3 h-3 text-muted-foreground" /></button>
      </div>

      {/* Lista de condições ativas */}
      <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
        <AnimatePresence>
          {conditions.map(condition => (
            <motion.div
              key={condition.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2 py-1"
            >
              <span className="text-lg">{condition.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-display truncate">{condition.condition_name}</div>
                {condition.duration && (
                  <div className="text-[10px] text-muted-foreground">
                    {condition.duration} {condition.duration === 1 ? 'turno' : 'turnos'}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-0.5">
                  {condition.duration && (
                    <button
                      onClick={() => decrementDuration(condition)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-[10px]"
                      title="Decrementar turno"
                    >
                      -1
                    </button>
                  )}
                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/20"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma condição</p>
        )}
      </div>

      {/* Adicionar condição */}
      {canEdit && (
        <>
          {!showAddPanel ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={() => setShowAddPanel(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Adicionar Condição
            </Button>
          ) : (
            <div className="space-y-1">
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full h-7 text-xs bg-secondary border border-border rounded px-2"
              >
                <option value="">Selecione...</option>
                {CONDITIONS.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Duração (turnos)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 text-xs flex-1"
                  onClick={addCondition}
                  disabled={!selectedCondition}
                >
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => { setShowAddPanel(false); setSelectedCondition(''); setDuration(''); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

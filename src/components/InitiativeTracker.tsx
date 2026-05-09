import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface InitiativeEntry {
  id: string;
  session_id: string;
  token_id: string | null;
  name: string;
  initiative: number;
  is_active: boolean;
  hp_current?: number;
  hp_max?: number;
}

interface InitiativeTrackerProps {
  sessionId: string;
  isDm: boolean;
  tokens: Array<{ id: string; label: string }>;
  onClose: () => void;
}

export default function InitiativeTracker({ sessionId, isDm, tokens, onClose }: InitiativeTrackerProps) {
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);
  const [round, setRound] = useState(1);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');

  useEffect(() => {
    loadInitiative();
    loadRound();
  }, [sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`initiative-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'initiative_tracker', filter: `session_id=eq.${sessionId}` },
        () => loadInitiative())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if ('combat_round' in payload.new) setRound((payload.new as any).combat_round || 1);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const loadInitiative = async () => {
    const { data } = await supabase
      .from('initiative_tracker')
      .select('*')
      .eq('session_id', sessionId)
      .order('initiative', { ascending: false });
    if (data) setEntries(data as InitiativeEntry[]);
  };

  const loadRound = async () => {
    const { data } = await supabase.from('sessions').select('combat_round').eq('id', sessionId).single();
    if (data) setRound(data.combat_round || 1);
  };

  const addEntry = async () => {
    if (!isDm || !newName.trim() || !newInit.trim()) return;
    const init = parseInt(newInit);
    if (isNaN(init)) return;

    await supabase.from('initiative_tracker').insert({
      session_id: sessionId,
      name: newName.trim(),
      initiative: init,
      is_active: false,
    });
    setNewName('');
    setNewInit('');
  };

  const removeEntry = async (id: string) => {
    if (!isDm) return;
    await supabase.from('initiative_tracker').delete().eq('id', id);
  };

  const setActive = async (id: string) => {
    if (!isDm) return;
    await supabase.from('initiative_tracker').update({ is_active: false }).eq('session_id', sessionId);
    await supabase.from('initiative_tracker').update({ is_active: true }).eq('id', id);
  };

  const nextTurn = async () => {
    if (!isDm || entries.length === 0) return;
    const activeIdx = entries.findIndex(e => e.is_active);
    const nextIdx = (activeIdx + 1) % entries.length;
    
    if (nextIdx === 0) {
      await supabase.from('sessions').update({ combat_round: round + 1 }).eq('id', sessionId);
      // Decrementar durações das condições
      await supabase.rpc('decrement_condition_durations', { p_session_id: sessionId });
    }
    
    await setActive(entries[nextIdx].id);
  };

  const resetCombat = async () => {
    if (!isDm) return;
    await supabase.from('initiative_tracker').delete().eq('session_id', sessionId);
    await supabase.from('sessions').update({ combat_round: 1 }).eq('id', sessionId);
    toast.success('Combate resetado');
  };

  const updateHp = async (id: string, current: number) => {
    if (!isDm) return;
    await supabase.from('initiative_tracker').update({ hp_current: current }).eq('id', id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border rounded-xl shadow-2xl w-80 max-h-[80vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-gold text-sm">Iniciativa</h3>
          <span className="text-xs text-muted-foreground">Rodada {round}</span>
        </div>
        <div className="flex items-center gap-1">
          {isDm && (
            <Button variant="ghost" size="sm" onClick={resetCombat} className="h-7 w-7 p-0" title="Resetar">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence>
          {entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`p-2 rounded-lg border transition-all ${
                entry.is_active
                  ? 'bg-gold/10 border-gold shadow-lg'
                  : 'bg-secondary/30 border-border'
              }`}
              onClick={() => isDm && setActive(entry.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  entry.is_active ? 'bg-gold text-background' : 'bg-muted text-muted-foreground'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">+{entry.initiative}</span>
                  </div>
                  {entry.hp_max && (
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        type="number"
                        value={entry.hp_current ?? entry.hp_max}
                        onChange={(e) => updateHp(entry.id, parseInt(e.target.value) || 0)}
                        disabled={!isDm}
                        className="h-5 w-12 text-xs px-1"
                      />
                      <span className="text-xs text-muted-foreground">/ {entry.hp_max}</span>
                    </div>
                  )}
                </div>
                {entry.is_active && (
                  <ChevronRight className="w-4 h-4 text-gold animate-pulse" />
                )}
                {isDm && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {isDm ? 'Adicione combatentes abaixo' : 'Aguardando iniciativa...'}
          </p>
        )}
      </div>

      {isDm && (
        <>
          <div className="p-2 border-t border-border">
            <div className="flex gap-1 mb-2">
              <Input
                placeholder="Nome"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                className="h-8 text-xs flex-1"
              />
              <Input
                placeholder="Init"
                type="number"
                value={newInit}
                onChange={(e) => setNewInit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                className="h-8 text-xs w-16"
              />
              <Button onClick={addEntry} size="sm" className="h-8 w-8 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {entries.length > 0 && (
              <Button onClick={nextTurn} className="w-full h-8 text-xs" variant="default">
                Próximo Turno
              </Button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

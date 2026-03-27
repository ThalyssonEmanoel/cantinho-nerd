import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { X, ScrollText, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceRoll {
  id: string;
  player_name: string;
  player_avatar: string | null;
  dice_formula: string;
  results: number[];
  modifier: number;
  total: number;
  is_hidden: boolean;
  created_at: string;
  player_id: string;
}

interface DiceLogProps {
  sessionId: string;
  onClose: () => void;
}

export default function DiceLog({ sessionId, onClose }: DiceLogProps) {
  const { player, role } = useAuth();
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const isDm = role === 'dm';

  useEffect(() => {
    const loadRolls = async () => {
      const { data } = await supabase
        .from('dice_rolls')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setRolls(data as DiceRoll[]);
    };
    loadRolls();

    const channel = supabase
      .channel('dice-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setRolls(prev => [payload.new as DiceRoll, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Filter: players see all non-hidden + their own hidden, DM sees all
  const visibleRolls = rolls.filter(r => {
    if (isDm) return true;
    if (!r.is_hidden) return true;
    if (r.player_id === player?.id) return true;
    return false;
  });

  return (
    <div className="h-full bg-card/95 backdrop-blur-sm border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="font-display text-gold text-sm flex items-center gap-2">
          <ScrollText className="w-4 h-4" /> Histórico de Dados
        </h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {visibleRolls.map(roll => (
            <motion.div
              key={roll.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border ${roll.is_hidden ? 'bg-blood/10 border-blood/30' : 'bg-secondary border-border'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {roll.player_avatar && (
                  <img src={roll.player_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="text-xs font-display text-foreground">{roll.player_name}</span>
                {roll.is_hidden && (
                  <span className="text-xs text-blood flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> Oculto
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(roll.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground font-display">{roll.dice_formula}</span>
                <span className="text-xs text-muted-foreground">[{roll.results.join(', ')}]</span>
                <span className="text-lg font-display text-gold font-bold ml-auto">{roll.total}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleRolls.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            Nenhuma rolagem ainda...
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConditionSummary {
  token_id: string;
  token_label: string;
  conditions: Array<{
    id: string;
    condition_name: string;
    icon: string;
    duration: number | null;
  }>;
}

interface ConditionsSummaryPanelProps {
  sessionId: string;
  onClose: () => void;
}

export default function ConditionsSummaryPanel({ sessionId, onClose }: ConditionsSummaryPanelProps) {
  const [summary, setSummary] = useState<ConditionSummary[]>([]);

  useEffect(() => {
    loadSummary();
  }, [sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`conditions-summary-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_conditions', filter: `session_id=eq.${sessionId}` },
        () => loadSummary())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const loadSummary = async () => {
    // Buscar todas as condições da sessão
    const { data: conditions } = await supabase
      .from('token_conditions')
      .select('*')
      .eq('session_id', sessionId);

    // Buscar labels dos tokens
    const { data: tokens } = await supabase
      .from('board_tokens')
      .select('id, label')
      .eq('session_id', sessionId);

    if (conditions && tokens) {
      const tokenMap = new Map(tokens.map((t: any) => [t.id, t.label]));
      const grouped: Record<string, ConditionSummary> = {};

      conditions.forEach((c: any) => {
        if (!grouped[c.token_id]) {
          grouped[c.token_id] = {
            token_id: c.token_id,
            token_label: tokenMap.get(c.token_id) || 'Token',
            conditions: []
          };
        }
        grouped[c.token_id].conditions.push({
          id: c.id,
          condition_name: c.condition_name,
          icon: c.icon,
          duration: c.duration
        });
      });

      setSummary(Object.values(grouped));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-card border border-border rounded-xl shadow-2xl w-72 max-h-[60vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-display text-gold text-sm">Condições Ativas</h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence>
          {summary.map((item) => (
            <motion.div
              key={item.token_id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-secondary/30 rounded-lg p-2"
            >
              <div className="font-display text-sm font-bold mb-1">{item.token_label}</div>
              <div className="flex flex-wrap gap-1">
                {item.conditions.map((condition) => (
                  <div
                    key={condition.id}
                    className="relative bg-card border border-border rounded-full px-2 py-0.5 text-xs flex items-center gap-1"
                    title={condition.condition_name}
                  >
                    <span>{condition.icon}</span>
                    <span className="text-[10px]">{condition.condition_name}</span>
                    {condition.duration && (
                      <span className="bg-gold text-background rounded-full px-1 text-[9px] font-bold">
                        {condition.duration}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {summary.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma condição ativa
          </p>
        )}
      </div>
    </motion.div>
  );
}

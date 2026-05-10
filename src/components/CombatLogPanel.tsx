import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Heart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CombatLog {
  id: string;
  player_name: string;
  action_type: string;
  amount: number;
  hp_before: number;
  hp_after: number;
  created_at: string;
  token_id: string;
}

interface CombatLogPanelProps {
  sessionId: string;
  onClose: () => void;
}

export default function CombatLogPanel({ sessionId, onClose }: CombatLogPanelProps) {
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [tokenNames, setTokenNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadLogs();
    loadTokenNames();
  }, [sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`combat-logs-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'token_health_logs', filter: `session_id=eq.${sessionId}` },
        () => loadLogs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('token_health_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setLogs(data as CombatLog[]);
  };

  const loadTokenNames = async () => {
    const { data } = await supabase
      .from('board_tokens')
      .select('id, label')
      .eq('session_id', sessionId);
    if (data) {
      const names: Record<string, string> = {};
      data.forEach((t: any) => { names[t.id] = t.label; });
      setTokenNames(names);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border rounded-xl shadow-2xl w-80 max-h-[70vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-display text-gold text-sm">Log de Combate</h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-2 rounded-lg border text-xs ${
                log.action_type === 'damage'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {log.action_type === 'damage' ? (
                  <Heart className="w-3 h-3 text-red-500" />
                ) : (
                  <Sparkles className="w-3 h-3 text-green-500" />
                )}
                <span className="font-display font-bold">
                  {tokenNames[log.token_id] || 'Token'}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-muted-foreground">
                <span className="font-bold text-foreground">{log.player_name}</span>
                {' '}
                {log.action_type === 'damage' ? 'causou' : 'curou'}
                {' '}
                <span className={`font-bold ${log.action_type === 'damage' ? 'text-red-500' : 'text-green-500'}`}>
                  {log.amount}
                </span>
                {' '}
                de dano
                {' '}
                <span className="text-[10px]">
                  ({log.hp_before} → {log.hp_after})
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {logs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma ação de combate ainda
          </p>
        )}
      </div>
    </motion.div>
  );
}

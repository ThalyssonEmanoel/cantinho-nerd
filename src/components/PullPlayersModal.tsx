import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface PullPlayersModalProps {
  sessionId: string;
  dmId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PullPlayersModal({ sessionId, dmId, onClose, onSuccess }: PullPlayersModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncStats, setSyncStats] = useState(true);

  const pullPlayers = async () => {
    setLoading(true);

    try {
      if (syncStats) {
        // Versão avançada com sincronização de HP
        const { data, error } = await supabase.rpc('pull_players_to_map_with_stats', {
          p_session_id: sessionId,
          p_dm_id: dmId
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const result = data[0];
          if (result.success) {
            toast.success(result.message);
            onSuccess();
            onClose();
          } else {
            toast.error(result.message);
          }
        }
      } else {
        // Versão simples sem sincronização
        const { data, error } = await supabase.rpc('pull_players_to_map', {
          p_session_id: sessionId,
          p_dm_id: dmId
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const result = data[0];
          if (result.success) {
            toast.success(result.message);
            onSuccess();
            onClose();
          } else {
            toast.error(result.message);
          }
        }
      }
    } catch (err: any) {
      toast.error('Erro ao puxar jogadores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-gold" />
            </div>
            <h3 className="font-display text-lg text-foreground">Puxar Jogadores</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg border border-border">
            <Users className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display text-foreground mb-1">
                Adicionar jogadores ao mapa
              </p>
              <p className="text-xs text-muted-foreground">
                Cria tokens para todos os jogadores da sessão que ainda não estão no mapa.
                Tokens existentes não serão movidos.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:border-gold/40"
              style={{ borderColor: syncStats ? 'hsl(var(--gold))' : 'hsl(var(--border))' }}>
              <input
                type="checkbox"
                checked={syncStats}
                onChange={(e) => setSyncStats(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display text-foreground">
                  Sincronizar HP das fichas
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importa HP, PE e PS das fichas de personagem para os tokens.
                  Recomendado para iniciar combate.
                </p>
              </div>
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={pullPlayers}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Puxando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Puxar Jogadores
                </span>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

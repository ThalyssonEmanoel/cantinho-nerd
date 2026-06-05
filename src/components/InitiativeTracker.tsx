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
        </div>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center space-y-3">
          <div className="text-4xl">🚧</div>
          <div className="text-sm font-display text-gold">Sistema em Manutenção</div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            Estamos reconstruindo o sistema de iniciativa com as seguintes melhorias:
          </div>
          <div className="text-left space-y-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Jogadores rolam iniciativa automaticamente</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Lista aparece para todos em tempo real</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Botões de avançar/voltar turno</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Contador de rodadas automático</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Mestre pode reordenar livremente</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gold">•</span>
              <span>Botão de limpar combate</span>
            </div>
          </div>
          <div className="text-xs text-gold/80">
            Em breve! ✨
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Heart, Zap, Brain, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenHealthBarProps {
  tokenId: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  hp_current: number;
  hp_max: number;
  pe_current?: number;
  pe_max?: number;
  ps_current?: number;
  ps_max?: number;
  system: string;
  onUpdate: (hp: number, pe?: number, ps?: number) => void;
  canEdit: boolean;
  showControls: boolean;
  uiScale?: number;
}

export default function TokenHealthBar({
  tokenId, sessionId, playerId, playerName,
  hp_current, hp_max, pe_current, pe_max, ps_current, ps_max,
  system, onUpdate, canEdit, showControls, uiScale = 1,
}: TokenHealthBarProps) {
  const [damageInput, setDamageInput] = useState('');
  const [showDamagePanel, setShowDamagePanel] = useState(false);

  const applyDamage = async (amount: number) => {
    const newHp = Math.max(0, Math.min(hp_max, hp_current - amount));
    onUpdate(newHp, pe_current, ps_current);
    
    // Log damage
    await supabase.from('token_health_logs').insert({
      session_id: sessionId,
      token_id: tokenId,
      player_id: playerId,
      player_name: playerName,
      action_type: 'damage',
      amount,
      hp_before: hp_current,
      hp_after: newHp
    });
    
    setDamageInput('');
  };

  const applyHealing = async (amount: number) => {
    const newHp = Math.max(0, Math.min(hp_max, hp_current + amount));
    onUpdate(newHp, pe_current, ps_current);
    
    // Log healing
    await supabase.from('token_health_logs').insert({
      session_id: sessionId,
      token_id: tokenId,
      player_id: playerId,
      player_name: playerName,
      action_type: 'healing',
      amount,
      hp_before: hp_current,
      hp_after: newHp
    });
    
    setDamageInput('');
  };

  const hpPercent = (hp_current / hp_max) * 100;
  const pePercent = pe_max ? ((pe_current || 0) / pe_max) * 100 : 0;
  const psPercent = ps_max ? ((ps_current || 0) / ps_max) * 100 : 0;

  const getHpColor = () => {
    if (hpPercent > 66) return 'bg-green-500';
    if (hpPercent > 33) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none" onClick={e => e.stopPropagation()}>
      <div
        style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}
        className="pointer-events-auto"
      >
      {/* Health bars */}
      <div className="bg-card/95 border border-border rounded-lg px-2 py-1 shadow-lg min-w-[120px]">
        {/* HP Bar */}
        <div className="flex items-center gap-1 mb-0.5">
          <Heart className="w-4 h-4 text-red-500" />
          <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${getHpColor()} transition-all`} style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="text-xs font-bold text-foreground min-w-[38px] text-right">
            {hp_current}/{hp_max}
          </span>
        </div>

        {/* PE Bar (Ordem Paranormal) */}
        {system === 'ordem_paranormal' && pe_max && (
          <div className="flex items-center gap-1 mb-0.5">
            <Zap className="w-4 h-4 text-blue-500" />
            <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${pePercent}%` }} />
            </div>
            <span className="text-xs font-bold text-foreground min-w-[38px] text-right">
              {pe_current}/{pe_max}
            </span>
          </div>
        )}

        {/* PS Bar (Ordem Paranormal) */}
        {system === 'ordem_paranormal' && ps_max && (
          <div className="flex items-center gap-1">
            <Brain className="w-4 h-4 text-purple-500" />
            <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${psPercent}%` }} />
            </div>
            <span className="text-xs font-bold text-foreground min-w-[38px] text-right">
              {ps_current}/{ps_max}
            </span>
          </div>
        )}
      </div>

      {/* Damage/Heal controls */}
      <AnimatePresence>
        {canEdit && showControls && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-2 shadow-xl z-50 min-w-[160px]"
          >
            {!showDamagePanel ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 px-2 text-sm flex-1"
                  onClick={() => setShowDamagePanel(true)}
                >
                  <Minus className="w-4 h-4 mr-1" /> Dano
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 px-2 text-sm flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => setShowDamagePanel(true)}
                >
                  <Plus className="w-4 h-4 mr-1" /> Cura
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Valor"
                  value={damageInput}
                  onChange={(e) => setDamageInput(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-sm flex-1"
                    onClick={() => {
                      const val = parseInt(damageInput);
                      if (!isNaN(val) && val > 0) applyDamage(val);
                    }}
                  >
                    Dano
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-sm flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const val = parseInt(damageInput);
                      if (!isNaN(val) && val > 0) applyHealing(val);
                    }}
                  >
                    Cura
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-sm"
                    onClick={() => { setShowDamagePanel(false); setDamageInput(''); }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

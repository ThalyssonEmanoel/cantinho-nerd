import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Dices } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;

interface DiceRollerProps {
  sessionId: string;
  onClose: () => void;
}

export default function DiceRoller({ sessionId, onClose }: DiceRollerProps) {
  const { player, role } = useAuth();
  const [selectedDice, setSelectedDice] = useState<number>(20);
  const [quantity, setQuantity] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ results: number[]; total: number } | null>(null);

  const rollDice = async () => {
    if (!player) return;
    setRolling(true);
    setLastResult(null);

    // Animate delay
    await new Promise(r => setTimeout(r, 600));

    const results: number[] = [];
    for (let i = 0; i < quantity; i++) {
      results.push(Math.floor(Math.random() * selectedDice) + 1);
    }
    const total = results.reduce((a, b) => a + b, 0) + modifier;
    const formula = `${quantity}d${selectedDice}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;

    setLastResult({ results, total });

    await supabase.from('dice_rolls').insert({
      session_id: sessionId,
      player_id: player.id,
      player_name: player.name,
      player_avatar: player.avatar_url,
      dice_formula: formula,
      results,
      modifier,
      total,
      is_hidden: role === 'dm',
    });

    setRolling(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 w-72 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-gold text-sm flex items-center gap-2">
          <Dices className="w-4 h-4" /> Dados
          {role === 'dm' && <span className="text-xs text-blood">(Oculto)</span>}
        </h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Dice selection */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {DICE_TYPES.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDice(d)}
            className={`py-2 rounded-lg text-xs font-display transition-all ${
              selectedDice === d
                ? 'bg-primary text-primary-foreground glow-gold'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            d{d}
          </button>
        ))}
      </div>

      {/* Quantity and modifier */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-display">Qtd</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="bg-secondary h-8 text-center text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-display">Mod</label>
          <Input
            type="number"
            value={modifier}
            onChange={e => setModifier(parseInt(e.target.value) || 0)}
            className="bg-secondary h-8 text-center text-sm"
          />
        </div>
      </div>

      {/* Formula preview */}
      <div className="text-center text-sm text-muted-foreground mb-3 font-display">
        {quantity}d{selectedDice}{modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''}
      </div>

      {/* Roll button */}
      <Button className="w-full font-display" onClick={rollDice} disabled={rolling}>
        {rolling ? '🎲 Rolando...' : '🎲 Rolar Dados!'}
      </Button>

      {/* Result */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center"
          >
            <div className="text-xs text-muted-foreground">
              [{lastResult.results.join(', ')}]{modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}
            </div>
            <div className="text-3xl font-display text-gold text-glow-gold font-bold">
              {lastResult.total}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

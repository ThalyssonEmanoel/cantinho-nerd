import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Dices } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

interface DiceRollerProps {
  sessionId: string;
  onClose: () => void;
}

interface RollAnnouncement {
  playerName: string;
  formula: string;
  total: number;
  critical: boolean;
  id: string;
}

export default function DiceRoller({ sessionId, onClose }: DiceRollerProps) {
  const { player, role } = useAuth();
  const [selectedDice, setSelectedDice] = useState<number>(20);
  const [quantity, setQuantity] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [customFormula, setCustomFormula] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ results: number[]; total: number; formula: string } | null>(null);
  const [announcements, setAnnouncements] = useState<RollAnnouncement[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`dice-announce-${sessionId}`)
      .on('broadcast', { event: 'roll_announce' }, ({ payload }) => {
        if (payload.playerId === player?.id) return; // don't show own announce
        const ann: RollAnnouncement = {
          id: crypto.randomUUID(),
          playerName: payload.playerName,
          formula: payload.formula,
          total: payload.total,
          critical: payload.critical,
        };
        setAnnouncements(prev => [ann, ...prev].slice(0, 5));
        setTimeout(() => {
          setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
        }, 5000);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, player?.id]);

  const parseCustomFormula = (formula: string): { results: number[]; total: number } => {
    // Parse "XdY+Z" or "XdY-Z" or "N"
    const match = formula.trim().match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
    if (match) {
      const qty = parseInt(match[1] || '1');
      const faces = parseInt(match[2]);
      const mod = parseInt(match[3] || '0');
      const results: number[] = [];
      for (let i = 0; i < Math.min(qty, 100); i++) {
        results.push(Math.floor(Math.random() * faces) + 1);
      }
      return { results, total: results.reduce((a, b) => a + b, 0) + mod };
    }
    // Plain number
    if (/^\d+$/.test(formula.trim())) {
      const n = parseInt(formula.trim());
      return { results: [n], total: n };
    }
    throw new Error('Fórmula inválida. Use: XdY+Z (ex: 2d6+3)');
  };

  const rollDice = async () => {
    if (!player) return;
    setRolling(true);
    setLastResult(null);

    await new Promise(r => setTimeout(r, 500));

    let results: number[];
    let total: number;
    let formula: string;

    try {
      if (useCustom && customFormula) {
        const parsed = parseCustomFormula(customFormula);
        results = parsed.results;
        total = parsed.total;
        formula = customFormula.trim();
      } else {
        results = [];
        for (let i = 0; i < quantity; i++) {
          results.push(Math.floor(Math.random() * selectedDice) + 1);
        }
        total = results.reduce((a, b) => a + b, 0) + modifier;
        formula = `${quantity}d${selectedDice}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;
      }
    } catch (err: any) {
      toast.error(err.message);
      setRolling(false);
      return;
    }

    setLastResult({ results, total, formula });

    const isCritical = selectedDice === 20 && results.includes(20) && !useCustom;

    // Broadcast to other players
    channelRef.current?.send({
      type: 'broadcast',
      event: 'roll_announce',
      payload: {
        playerId: player.id,
        playerName: player.name,
        formula,
        total,
        critical: isCritical,
      },
    });

    await supabase.from('dice_rolls').insert({
      session_id: sessionId,
      player_id: player.id,
      player_name: player.name,
      player_avatar: player.avatar_url,
      dice_formula: formula,
      results,
      modifier: useCustom ? 0 : modifier,
      total,
      is_hidden: role === 'dm',
    });

    setRolling(false);
  };

  const formulaPreview = useCustom
    ? customFormula || '—'
    : `${quantity}d${selectedDice}${modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 w-72 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-gold text-sm flex items-center gap-2">
          <Dices className="w-4 h-4" /> Dados
          {role === 'dm' && <span className="text-xs text-blood">(Oculto)</span>}
        </h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setUseCustom(false)}
          className={`flex-1 py-1 rounded text-xs font-display transition-colors ${!useCustom ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          Predefinido
        </button>
        <button
          onClick={() => setUseCustom(true)}
          className={`flex-1 py-1 rounded text-xs font-display transition-colors ${useCustom ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          Fórmula Livre
        </button>
      </div>

      {useCustom ? (
        <div className="mb-3">
          <label className="text-xs text-muted-foreground font-display">Fórmula (ex: 3d6+2, 1d100, 2d8-1)</label>
          <Input
            value={customFormula}
            onChange={e => setCustomFormula(e.target.value)}
            placeholder="2d6+3"
            className="bg-secondary h-8 text-sm mt-1"
            onKeyDown={e => e.key === 'Enter' && rollDice()}
          />
        </div>
      ) : (
        <>
          {/* Dice selection */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {DICE_TYPES.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDice(d)}
                className={`py-1.5 rounded text-[10px] font-display transition-all ${
                  selectedDice === d ? 'bg-primary text-primary-foreground glow-gold' : 'bg-secondary text-secondary-foreground hover:bg-muted'
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
                type="number" min={1} max={100} value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="bg-secondary h-8 text-center text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground font-display">Mod</label>
              <Input
                type="number" value={modifier}
                onChange={e => setModifier(parseInt(e.target.value) || 0)}
                className="bg-secondary h-8 text-center text-sm"
              />
            </div>
          </div>
        </>
      )}

      {/* Formula preview */}
      <div className="text-center text-sm text-muted-foreground mb-3 font-display bg-secondary rounded px-2 py-1">
        {formulaPreview}
      </div>

      <Button className="w-full font-display" onClick={rollDice} disabled={rolling}>
        {rolling ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            Rolando...
          </span>
        ) : '🎲 Rolar Dados!'}
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
              [{lastResult.results.slice(0, 20).join(', ')}{lastResult.results.length > 20 ? '...' : ''}]
              {!useCustom && modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}
            </div>
            <div className={`text-4xl font-display font-bold ${
              lastResult.results.includes(20) && selectedDice === 20 && !useCustom
                ? 'text-gold text-glow-gold'
                : 'text-gold'
            }`}>
              {lastResult.total}
            </div>
            {lastResult.results.includes(20) && selectedDice === 20 && !useCustom && (
              <div className="text-xs text-gold font-display animate-pulse">🎯 CRÍTICO!</div>
            )}
            {lastResult.results.includes(1) && selectedDice === 20 && !useCustom && lastResult.results.length === 1 && (
              <div className="text-xs text-destructive font-display">💀 Falha Crítica!</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Announcements from other players */}
      <AnimatePresence>
        {announcements.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {announcements.map(ann => (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`p-2 rounded-lg border text-xs ${ann.critical ? 'bg-gold/10 border-gold/30' : 'bg-secondary border-border'}`}
              >
                <span className="font-display text-muted-foreground">{ann.playerName}</span>
                <span className="text-muted-foreground"> rolou {ann.formula} → </span>
                <span className={`font-display font-bold ${ann.critical ? 'text-gold' : 'text-foreground'}`}>
                  {ann.total}{ann.critical ? ' 🎯' : ''}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

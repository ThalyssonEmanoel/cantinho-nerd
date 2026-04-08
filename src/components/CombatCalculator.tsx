import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Calculator, Swords, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CombatCalculatorProps {
  onClose: () => void;
}

type DamageType = 'físico' | 'mágico' | 'fogo' | 'gelo' | 'trovão' | 'sagrado' | 'necrótico';

interface Result {
  raw: number;
  reduced: number;
  type: DamageType;
  hit: boolean;
  critical: boolean;
}

const DAMAGE_TYPES: DamageType[] = ['físico', 'mágico', 'fogo', 'gelo', 'trovão', 'sagrado', 'necrótico'];

const TYPE_COLORS: Record<DamageType, string> = {
  físico: 'text-foreground',
  mágico: 'text-arcane',
  fogo: 'text-orange-400',
  gelo: 'text-blue-300',
  trovão: 'text-yellow-300',
  sagrado: 'text-yellow-500',
  necrótico: 'text-green-500',
};

function rollDice(expr: string): number {
  // Parse expressions like "2d6+4" or "1d8-1" or "10"
  const match = expr.trim().match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match && /^\d+$/.test(expr.trim())) return parseInt(expr.trim());
  if (!match) return 0;
  const qty = parseInt(match[1] || '1');
  const faces = parseInt(match[2]);
  const mod = parseInt(match[3] || '0');
  let total = mod;
  for (let i = 0; i < qty; i++) total += Math.floor(Math.random() * faces) + 1;
  return total;
}

export default function CombatCalculator({ onClose }: CombatCalculatorProps) {
  const [attackRoll, setAttackRoll] = useState('');
  const [targetAC, setTargetAC] = useState('');
  const [damageExpr, setDamageExpr] = useState('');
  const [damageType, setDamageType] = useState<DamageType>('físico');
  const [resistance, setResistance] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const calculate = () => {
    const atk = parseInt(attackRoll);
    const ac = parseInt(targetAC);
    const res = parseInt(resistance) || 0;

    const hit = isNaN(atk) || isNaN(ac) ? true : atk >= ac;
    const critical = !isNaN(atk) && atk === 20;

    let raw = damageExpr ? rollDice(damageExpr) : 0;
    if (critical) raw *= 2;
    const reduced = Math.max(0, raw - res);

    setResult({ raw, reduced, type: damageType, hit, critical });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 w-72 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-gold text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Calculadora de Combate
        </h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="space-y-3">
        {/* Attack vs AC */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground font-display flex items-center gap-1">
              <Swords className="w-3 h-3" /> Ataque (d20)
            </label>
            <Input
              type="number"
              value={attackRoll}
              onChange={e => setAttackRoll(e.target.value)}
              placeholder="Ex: 14"
              className="h-8 bg-secondary text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-display flex items-center gap-1">
              <Shield className="w-3 h-3" /> CA do Alvo
            </label>
            <Input
              type="number"
              value={targetAC}
              onChange={e => setTargetAC(e.target.value)}
              placeholder="Ex: 15"
              className="h-8 bg-secondary text-sm mt-1"
            />
          </div>
        </div>

        {/* Damage */}
        <div>
          <label className="text-xs text-muted-foreground font-display">Dano (fórmula)</label>
          <Input
            value={damageExpr}
            onChange={e => setDamageExpr(e.target.value)}
            placeholder="Ex: 2d6+3"
            className="h-8 bg-secondary text-sm mt-1"
          />
        </div>

        {/* Damage type */}
        <div>
          <label className="text-xs text-muted-foreground font-display">Tipo de Dano</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {DAMAGE_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setDamageType(t)}
                className={`px-2 py-0.5 rounded text-xs font-display capitalize border transition-all ${
                  damageType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Resistance */}
        <div>
          <label className="text-xs text-muted-foreground font-display">Redução de Dano / Resistência</label>
          <Input
            type="number"
            value={resistance}
            onChange={e => setResistance(e.target.value)}
            placeholder="Ex: 5"
            className="h-8 bg-secondary text-sm mt-1"
          />
        </div>

        <Button className="w-full font-display text-sm" onClick={calculate}>
          ⚔️ Calcular
        </Button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 p-3 rounded-lg border ${
              result.hit ? 'bg-secondary border-border' : 'bg-muted border-muted'
            }`}
          >
            {!result.hit ? (
              <p className="text-center text-muted-foreground font-display text-sm">Errou o ataque!</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-display capitalize ${TYPE_COLORS[result.type]}`}>
                    {result.type}{result.critical ? ' 🎯 CRÍTICO!' : ''}
                  </span>
                  {parseInt(resistance) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {result.raw} − {resistance} resistência
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <span className={`text-4xl font-display font-bold ${result.critical ? 'text-gold text-glow-gold' : TYPE_COLORS[result.type]}`}>
                    {result.reduced}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">de dano</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Zap, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Ritual {
  id: string;
  nome: string;
  circulo: number;
  elemento: string;
  execucao: string;
  alcance: string;
  alvo: string;
  duracao: string;
  resistencia: string;
  descricao: string;
  custo_pe: number;
  componentes?: string[];
  pre_requisitos?: string[];
}

interface RitualCastProps {
  playerId: string;
  sessionId: string;
  ritual: Ritual;
  currentPE: number;
  maxPE: number;
  nex: number;
  onClose: () => void;
  onCast: (ritual: Ritual, peCost: number) => void;
}

const ELEMENTOS = {
  'Conhecimento': { color: '#3b82f6', icon: '📚' },
  'Energia': { color: '#eab308', icon: '⚡' },
  'Morte': { color: '#8b5cf6', icon: '💀' },
  'Sangue': { color: '#ef4444', icon: '🩸' },
  'Medo': { color: '#6b7280', icon: '😱' },
  'Varia': { color: '#10b981', icon: '✨' }
};

export default function RitualCast({
  playerId,
  sessionId,
  ritual,
  currentPE,
  maxPE,
  nex,
  onClose,
  onCast
}: RitualCastProps) {
  const [amplifying, setAmplifying] = useState(false);
  const [amplificationCost, setAmplificationCost] = useState(0);
  const [totalCost, setTotalCost] = useState(ritual.custo_pe);
  const [canCast, setCanCast] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [casting, setCasting] = useState(false);

  useEffect(() => {
    checkRequirements();
  }, [ritual, currentPE, nex, amplificationCost]);

  const checkRequirements = () => {
    const newWarnings: string[] = [];
    let canCastRitual = true;

    // Verificar PE suficiente
    const cost = ritual.custo_pe + amplificationCost;
    if (cost > currentPE) {
      newWarnings.push(`PE insuficiente (necessário: ${cost}, atual: ${currentPE})`);
      canCastRitual = false;
    }

    // Verificar círculo vs NEX
    const requiredNEX = ritual.circulo * 5;
    if (nex < requiredNEX) {
      newWarnings.push(`NEX insuficiente (necessário: ${requiredNEX}%, atual: ${nex}%)`);
      canCastRitual = false;
    }

    // Verificar pré-requisitos
    if (ritual.pre_requisitos && ritual.pre_requisitos.length > 0) {
      ritual.pre_requisitos.forEach(req => {
        newWarnings.push(`Pré-requisito: ${req}`);
      });
    }

    setWarnings(newWarnings);
    setCanCast(canCastRitual);
    setTotalCost(cost);
  };

  const handleAmplification = (increase: boolean) => {
    if (increase) {
      setAmplificationCost(prev => prev + 1);
    } else {
      setAmplificationCost(prev => Math.max(0, prev - 1));
    }
  };

  const handleCast = async () => {
    if (!canCast) {
      toast.error('Não é possível lançar este ritual');
      return;
    }

    setCasting(true);

    try {
      // Registrar lançamento no log
      await supabase.from('ritual_casts').insert({
        session_id: sessionId,
        player_id: playerId,
        ritual_name: ritual.nome,
        ritual_circle: ritual.circulo,
        ritual_element: ritual.elemento,
        pe_cost: totalCost,
        amplified: amplificationCost > 0,
        amplification_cost: amplificationCost,
      });

      // Callback para atualizar PE na ficha
      onCast(ritual, totalCost);

      toast.success(`${ritual.nome} lançado com sucesso!`);
      onClose();
    } catch (error: any) {
      toast.error('Erro ao lançar ritual: ' + error.message);
    } finally {
      setCasting(false);
    }
  };

  const elemento = ELEMENTOS[ritual.elemento as keyof typeof ELEMENTOS] || ELEMENTOS['Varia'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border" style={{ backgroundColor: `${elemento.color}15` }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{elemento.icon}</span>
                <h2 className="font-display text-xl text-foreground">{ritual.nome}</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: `${elemento.color}30`, color: elemento.color }}>
                  {ritual.elemento}
                </span>
                <span>Círculo {ritual.circulo}</span>
                <span>•</span>
                <span>{ritual.execucao}</span>
                <span>•</span>
                <span>{ritual.alcance}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Descrição */}
          <div>
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <p className="text-sm mt-1">{ritual.descricao}</p>
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Alvo</Label>
              <p className="mt-0.5">{ritual.alvo}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Duração</Label>
              <p className="mt-0.5">{ritual.duracao}</p>
            </div>
            {ritual.resistencia && (
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Resistência</Label>
                <p className="mt-0.5">{ritual.resistencia}</p>
              </div>
            )}
          </div>

          {/* Componentes */}
          {ritual.componentes && ritual.componentes.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Componentes</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ritual.componentes.map((comp, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-secondary rounded text-xs">
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custo de PE */}
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Custo de PE</Label>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-lg">{totalCost} PE</span>
              </div>
            </div>

            {/* Amplificação */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Amplificar (+1 PE por nível)</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAmplification(false)}
                  disabled={amplificationCost === 0}
                  className="h-7 w-7 p-0"
                >
                  -
                </Button>
                <span className="text-sm w-8 text-center">{amplificationCost}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAmplification(true)}
                  disabled={totalCost + 1 > currentPE}
                  className="h-7 w-7 p-0"
                >
                  +
                </Button>
              </div>
            </div>

            {amplificationCost > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Ritual amplificado em +{amplificationCost} nível(is)
              </p>
            )}
          </div>

          {/* PE Disponível */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">PE Disponível</span>
            <span className={currentPE >= totalCost ? 'text-green-500' : 'text-red-500'}>
              {currentPE} / {maxPE}
            </span>
          </div>

          {/* Avisos e Pré-requisitos */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                    warning.includes('insuficiente')
                      ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                      : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Confirmação */}
          {canCast && warnings.length === 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/30 text-xs">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Todos os requisitos atendidos</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleCast}
            disabled={!canCast || casting}
            className="flex-1"
            style={{ backgroundColor: canCast ? elemento.color : undefined }}
          >
            {casting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                Lançando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Lançar Ritual
              </span>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

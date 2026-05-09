import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface RitualEffect {
  id: string;
  ritual_name: string;
  ritual_element: string;
  effect_type: string;
  center_x: number;
  center_y: number;
  radius?: number;
  width?: number;
  height?: number;
  angle?: number;
  color: string;
  opacity: number;
  description?: string;
  duration_type: string;
  expires_at?: string;
}

interface RitualEffectsLayerProps {
  sessionId: string;
  virtualWidth: number;
  virtualHeight: number;
}

const ELEMENTO_COLORS: Record<string, string> = {
  'Conhecimento': '#3b82f6',
  'Energia': '#eab308',
  'Morte': '#8b5cf6',
  'Sangue': '#ef4444',
  'Medo': '#6b7280',
  'Varia': '#10b981'
};

export default function RitualEffectsLayer({ sessionId, virtualWidth, virtualHeight }: RitualEffectsLayerProps) {
  const [effects, setEffects] = useState<RitualEffect[]>([]);

  useEffect(() => {
    loadEffects();
  }, [sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`ritual-effects-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_effects', filter: `session_id=eq.${sessionId}` },
        () => loadEffects())
      .subscribe();

    // Limpar efeitos expirados a cada minuto
    const interval = setInterval(() => {
      cleanupExpiredEffects();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionId]);

  const loadEffects = async () => {
    const { data } = await supabase
      .from('ritual_effects')
      .select('*')
      .eq('session_id', sessionId)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    if (data) setEffects(data as RitualEffect[]);
  };

  const cleanupExpiredEffects = async () => {
    await supabase.rpc('cleanup_expired_ritual_effects');
    loadEffects();
  };

  const renderEffect = (effect: RitualEffect) => {
    const color = ELEMENTO_COLORS[effect.ritual_element] || effect.color;

    switch (effect.effect_type) {
      case 'circle':
        return (
          <motion.circle
            key={effect.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: effect.opacity }}
            exit={{ scale: 0, opacity: 0 }}
            cx={effect.center_x}
            cy={effect.center_y}
            r={effect.radius || 50}
            fill={color}
            stroke={color}
            strokeWidth="2"
            style={{ filter: 'blur(2px)' }}
          />
        );

      case 'square':
        return (
          <motion.rect
            key={effect.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: effect.opacity }}
            exit={{ scale: 0, opacity: 0 }}
            x={effect.center_x - (effect.width || 100) / 2}
            y={effect.center_y - (effect.height || 100) / 2}
            width={effect.width || 100}
            height={effect.height || 100}
            fill={color}
            stroke={color}
            strokeWidth="2"
            style={{ filter: 'blur(2px)' }}
          />
        );

      case 'cone':
        const angle = effect.angle || 90;
        const radius = effect.radius || 100;
        const startAngle = -angle / 2;
        const endAngle = angle / 2;
        
        const startX = effect.center_x + Math.cos((startAngle * Math.PI) / 180) * radius;
        const startY = effect.center_y + Math.sin((startAngle * Math.PI) / 180) * radius;
        const endX = effect.center_x + Math.cos((endAngle * Math.PI) / 180) * radius;
        const endY = effect.center_y + Math.sin((endAngle * Math.PI) / 180) * radius;

        const pathData = `M ${effect.center_x} ${effect.center_y} L ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY} Z`;

        return (
          <motion.path
            key={effect.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: effect.opacity }}
            exit={{ scale: 0, opacity: 0 }}
            d={pathData}
            fill={color}
            stroke={color}
            strokeWidth="2"
            style={{ filter: 'blur(2px)', transformOrigin: `${effect.center_x}px ${effect.center_y}px` }}
          />
        );

      case 'line':
        return (
          <motion.rect
            key={effect.id}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: effect.opacity }}
            exit={{ scaleX: 0, opacity: 0 }}
            x={effect.center_x}
            y={effect.center_y - (effect.height || 20) / 2}
            width={effect.width || 200}
            height={effect.height || 20}
            fill={color}
            stroke={color}
            strokeWidth="2"
            style={{ filter: 'blur(2px)', transformOrigin: `${effect.center_x}px ${effect.center_y}px` }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={virtualWidth}
      height={virtualHeight}
      style={{ zIndex: 50 }}
    >
      <AnimatePresence>
        {effects.map(effect => renderEffect(effect))}
      </AnimatePresence>
    </svg>
  );
}

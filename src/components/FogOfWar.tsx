import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FogOfWarProps {
  sessionId: string;
  playerId: string;
  isDm: boolean;
  tokens: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    owner_id: string | null;
    token_type: string;
    is_hidden: boolean;
  }>;
  virtualWidth: number;
  virtualHeight: number;
  enabled: boolean;
}

interface FogArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  revealed: boolean;
}

export default function FogOfWar({
  sessionId,
  playerId,
  isDm,
  tokens,
  virtualWidth,
  virtualHeight,
  enabled
}: FogOfWarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fogAreas, setFogAreas] = useState<FogArea[]>([]);
  const [visionRadius, setVisionRadius] = useState(150); // Raio de visão padrão

  useEffect(() => {
    if (!enabled) return;
    loadFogAreas();
  }, [sessionId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`fog-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fog_of_war', filter: `session_id=eq.${sessionId}` },
        () => loadFogAreas())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    drawFog();
  }, [fogAreas, tokens, visionRadius, enabled, isDm]);

  const loadFogAreas = async () => {
    const { data } = await supabase
      .from('fog_of_war')
      .select('*')
      .eq('session_id', sessionId);
    if (data) setFogAreas(data as FogArea[]);
  };

  const drawFog = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, virtualWidth, virtualHeight);

    // Se DM, não aplicar fog
    if (isDm) return;

    // Desenhar fog completo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, virtualWidth, virtualHeight);

    // Revelar áreas ao redor dos tokens do jogador
    ctx.globalCompositeOperation = 'destination-out';

    const playerTokens = tokens.filter(t => t.owner_id === playerId && t.token_type === 'player');

    playerTokens.forEach(token => {
      const centerX = token.x + token.width / 2;
      const centerY = token.y + token.height / 2;

      // Criar gradiente radial para visão suave
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, visionRadius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, visionRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Revelar áreas permanentemente reveladas
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    fogAreas.filter(area => area.revealed).forEach(area => {
      ctx.fillRect(area.x, area.y, area.width, area.height);
    });

    ctx.globalCompositeOperation = 'source-over';
  };

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      width={virtualWidth}
      height={virtualHeight}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    />
  );
}

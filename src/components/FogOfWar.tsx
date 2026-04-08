import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Trash2, X, Circle, Square } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface FogArea {
  id: string;
  type: 'circle' | 'rect';
  // All coords normalized [0,1]
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
}

interface FogOfWarProps {
  boardRef: React.RefObject<HTMLDivElement>;
  sessionId: string;
  isDm: boolean;
  onClose: () => void;
}

type RevealTool = 'circle' | 'rect';

export default function FogOfWar({ boardRef, sessionId, isDm, onClose }: FogOfWarProps) {
  const [areas, setAreas] = useState<FogArea[]>([]);
  const [revealTool, setRevealTool] = useState<RevealTool>('circle');
  const [brushRadius, setBrushRadius] = useState(80);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<FogArea | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getBoardSize = () => {
    const rect = boardRef.current?.getBoundingClientRect();
    return { w: rect?.width || 1, h: rect?.height || 1 };
  };

  const normalize = (p: { x: number; y: number }) => {
    const { w, h } = getBoardSize();
    return { x: p.x / w, y: p.y / h };
  };

  const denorm = (v: number, axis: 'x' | 'y') => {
    const { w, h } = getBoardSize();
    return v * (axis === 'x' ? w : h);
  };

  // Load fog state from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('fog_revealed_areas')
        .eq('id', sessionId)
        .single();
      if (data?.fog_revealed_areas) {
        setAreas((data.fog_revealed_areas as unknown as FogArea[]) || []);
      }
    };
    load();
  }, [sessionId]);

  // Subscribe to session updates for fog
  useEffect(() => {
    const channel = supabase
      .channel(`fog-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const newAreas = (payload.new as any)?.fog_revealed_areas;
        if (newAreas) setAreas(newAreas as FogArea[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const saveFog = useCallback((newAreas: FogArea[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await supabase.from('sessions').update({ fog_revealed_areas: newAreas as any }).eq('id', sessionId);
    }, 800);
  }, [sessionId]);

  const getPos = (e: React.PointerEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDm) return;
    const pos = getPos(e);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (revealTool === 'circle') {
      const norm = normalize(pos);
      const { w } = getBoardSize();
      const area: FogArea = {
        id: crypto.randomUUID(),
        type: 'circle',
        x: norm.x,
        y: norm.y,
        r: brushRadius / w,
      };
      const next = [...areas, area];
      setAreas(next);
      saveFog(next);
    } else {
      setDragStart(pos);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDm || !isDrawing || revealTool !== 'rect' || !dragStart) return;
    const pos = getPos(e);
    const { w, h } = getBoardSize();
    setPreview({
      id: 'preview',
      type: 'rect',
      x: Math.min(dragStart.x, pos.x) / w,
      y: Math.min(dragStart.y, pos.y) / h,
      w: Math.abs(pos.x - dragStart.x) / w,
      h: Math.abs(pos.y - dragStart.y) / h,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDm || !isDrawing) return;
    setIsDrawing(false);

    if (revealTool === 'rect' && dragStart) {
      const pos = getPos(e);
      const { w, h } = getBoardSize();
      const area: FogArea = {
        id: crypto.randomUUID(),
        type: 'rect',
        x: Math.min(dragStart.x, pos.x) / w,
        y: Math.min(dragStart.y, pos.y) / h,
        w: Math.abs(pos.x - dragStart.x) / w,
        h: Math.abs(pos.y - dragStart.y) / h,
      };
      if ((area.w ?? 0) > 0.01 && (area.h ?? 0) > 0.01) {
        const next = [...areas, area];
        setAreas(next);
        saveFog(next);
      }
      setDragStart(null);
      setPreview(null);
    }
  };

  const clearAllFog = async () => {
    setAreas([]);
    await supabase.from('sessions').update({ fog_revealed_areas: [] as any }).eq('id', sessionId);
  };

  const removeArea = async (id: string) => {
    const next = areas.filter(a => a.id !== id);
    setAreas(next);
    saveFog(next);
  };

  const { w, h } = getBoardSize();
  const fogOpacity = isDm ? 0.55 : 0.92;

  const allAreas = preview ? [...areas, preview] : areas;

  return (
    <>
      {/* Invisible interaction layer for DM */}
      {isDm && (
        <div
          className="absolute inset-0 z-15"
          style={{ cursor: revealTool === 'circle' ? 'crosshair' : 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}

      {/* SVG fog layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-14"
        width={w}
        height={h}
      >
        <defs>
          <mask id={`fog-mask-${sessionId}`}>
            {/* White = fog visible, black = revealed (see-through) */}
            <rect x="0" y="0" width={w} height={h} fill="white" />
            {allAreas.map(area => {
              if (area.type === 'circle' && area.r !== undefined) {
                return (
                  <circle
                    key={area.id}
                    cx={area.x * w}
                    cy={area.y * h}
                    r={area.r * w}
                    fill="black"
                  />
                );
              }
              if (area.type === 'rect' && area.w !== undefined && area.h !== undefined) {
                return (
                  <rect
                    key={area.id}
                    x={area.x * w}
                    y={area.y * h}
                    width={area.w * w}
                    height={area.h * h}
                    fill="black"
                  />
                );
              }
              return null;
            })}
          </mask>
        </defs>

        {/* Fog rectangle - masked by revealed areas */}
        <rect
          x="0" y="0"
          width={w} height={h}
          fill="hsl(220, 25%, 5%)"
          opacity={fogOpacity}
          mask={`url(#fog-mask-${sessionId})`}
        />

        {/* DM overlay: show reveal area outlines */}
        {isDm && allAreas.map(area => {
          if (area.type === 'circle' && area.r !== undefined) {
            return (
              <circle
                key={`outline-${area.id}`}
                cx={area.x * w}
                cy={area.y * h}
                r={area.r * w}
                fill="none"
                stroke="hsl(var(--gold))"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.5}
              />
            );
          }
          if (area.type === 'rect' && area.w !== undefined && area.h !== undefined) {
            return (
              <rect
                key={`outline-${area.id}`}
                x={area.x * w}
                y={area.y * h}
                width={area.w * w}
                height={area.h * h}
                fill="none"
                stroke="hsl(var(--gold))"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.5}
              />
            );
          }
          return null;
        })}
      </svg>

      {/* DM Toolbar */}
      {isDm && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur border border-border rounded-xl p-2 flex items-center gap-2 shadow-2xl">
          <span className="text-xs text-muted-foreground font-display px-1">Névoa:</span>

          <Button
            variant={revealTool === 'circle' ? 'default' : 'ghost'}
            size="sm" className="h-8 w-8 p-0"
            onClick={() => setRevealTool('circle')} title="Revelar círculo"
          >
            <Circle className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={revealTool === 'rect' ? 'default' : 'ghost'}
            size="sm" className="h-8 w-8 p-0"
            onClick={() => setRevealTool('rect')} title="Revelar retângulo"
          >
            <Square className="w-3.5 h-3.5" />
          </Button>

          {revealTool === 'circle' && (
            <div className="flex items-center gap-2 w-20">
              <Slider
                value={[brushRadius]}
                onValueChange={v => setBrushRadius(v[0])}
                min={20} max={300} step={10}
              />
              <span className="text-xs text-muted-foreground w-6">{brushRadius}</span>
            </div>
          )}

          <div className="w-px h-6 bg-border" />

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearAllFog} title="Cobrir tudo">
            <EyeOff className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} title="Fechar névoa">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Top hint */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-card/90 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground font-display pointer-events-none">
        {isDm ? 'Clique para revelar áreas' : 'Névoa de Guerra ativa'}
        {!isDm && (
          <> · <button className="text-gold hover:underline pointer-events-auto" onClick={onClose}>Fechar</button></>
        )}
      </div>
    </>
  );
}

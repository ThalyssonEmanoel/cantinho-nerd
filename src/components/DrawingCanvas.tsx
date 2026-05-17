import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, X, Circle, Square, Minus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface DrawingCanvasProps {
  // Virtual coordinate space — all stored ops live in this space.
  virtualWidth: number;
  virtualHeight: number;
  // active=true enables drawing input + shows the toolbar; otherwise the
  // component still renders existing strokes so other clients can see them.
  active: boolean;
  onClose: () => void;
  sessionId: string;
  playerId: string;
  // Counter-scale for the toolbar so it stays readable when the virtual
  // board is shrunk to fit a small viewport.
  uiScale?: number;
}

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db',
  '#9b59b6', '#ecf0f1', '#1a1a2e', '#ff6b9d', '#00d2ff',
];

type Tool = 'pencil' | 'line' | 'circle' | 'rectangle';

type DrawOp =
  | { type: 'path'; points: { x: number; y: number }[]; color: string; size: number }
  | { type: 'shape'; shapeType: 'line' | 'circle' | 'rectangle'; start: { x: number; y: number }; end: { x: number; y: number }; color: string; size: number };

interface DrawingRow {
  id: string;
  player_id: string;
  data: DrawOp;
}

export default function DrawingCanvas({
  virtualWidth,
  virtualHeight,
  active,
  onClose,
  sessionId,
  playerId,
  uiScale = 1,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(3);
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [pendingPath, setPendingPath] = useState<{ x: number; y: number }[] | null>(null);
  const [pendingShape, setPendingShape] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const isDrawingRef = useRef(false);

  // Load existing drawings on mount.
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('board_drawings')
        .select('id, player_id, data')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (data) setDrawings(data as unknown as DrawingRow[]);
    };
    load();
  }, [sessionId]);

  // Realtime: every insert/delete propagates to all clients, including the
  // very first stroke from the first user (the previous canvas implementation
  // missed first strokes because the snapshot was debounced and the broadcast
  // channel only delivered to clients that had opened the drawing tool).
  useEffect(() => {
    const channel = supabase
      .channel(`board-drawings-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'board_drawings', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as unknown as DrawingRow;
          setDrawings(prev => (prev.some(d => d.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'board_drawings', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setDrawings(prev => prev.filter(d => d.id !== oldRow.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Convert pointer position to virtual coordinates using the SVG viewBox.
  const getPos = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = virtualWidth / rect.width;
    const sy = virtualHeight / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }, [virtualWidth, virtualHeight]);

  const insertOp = useCallback(async (op: DrawOp) => {
    // Optimistic insert with a temporary id so the local user sees it
    // immediately. The realtime INSERT will replace it once the server confirms.
    const tempId = `local-${crypto.randomUUID()}`;
    setDrawings(prev => [...prev, { id: tempId, player_id: playerId, data: op }]);
    const { data, error } = await supabase
      .from('board_drawings')
      .insert({ session_id: sessionId, player_id: playerId, data: op as unknown as Json })
      .select('id, player_id, data')
      .single();
    if (error || !data) {
      // Roll back optimistic insert on failure.
      setDrawings(prev => prev.filter(d => d.id !== tempId));
      return;
    }
    const canonical = data as unknown as DrawingRow;
    setDrawings(prev => {
      // Drop the temp op and add the canonical one (unless realtime already added it).
      const withoutTemp = prev.filter(d => d.id !== tempId);
      if (withoutTemp.some(d => d.id === canonical.id)) return withoutTemp;
      return [...withoutTemp, canonical];
    });
  }, [sessionId, playerId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    const pos = getPos(e);
    isDrawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === 'pencil') {
      setPendingPath([pos]);
    } else {
      setPendingShape({ start: pos, end: pos });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!active || !isDrawingRef.current) return;
    const pos = getPos(e);
    if (tool === 'pencil') {
      setPendingPath(prev => (prev ? [...prev, pos] : [pos]));
    } else {
      setPendingShape(prev => (prev ? { start: prev.start, end: pos } : null));
    }
  };

  const handlePointerUp = () => {
    if (!active || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (tool === 'pencil' && pendingPath && pendingPath.length > 0) {
      insertOp({ type: 'path', points: pendingPath, color, size: brushSize });
      setPendingPath(null);
    } else if (tool !== 'pencil' && pendingShape) {
      insertOp({
        type: 'shape',
        shapeType: tool,
        start: pendingShape.start,
        end: pendingShape.end,
        color,
        size: brushSize,
      });
      setPendingShape(null);
    }
  };

  // Trash button: ONLY removes drawings owned by the current player. The
  // previous implementation cleared the entire canvas for everyone.
  const clearMine = async () => {
    if (!confirm('Apagar todos os SEUS desenhos?')) return;
    const mineIds = drawings.filter(d => d.player_id === playerId).map(d => d.id);
    setDrawings(prev => prev.filter(d => d.player_id !== playerId));
    if (mineIds.length === 0) return;
    await supabase
      .from('board_drawings')
      .delete()
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
  };

  const renderOp = (id: string, op: DrawOp) => {
    if (op.type === 'path') {
      if (op.points.length === 0) return null;
      const d = op.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
        .join(' ');
      return (
        <path
          key={id}
          d={d}
          fill="none"
          stroke={op.color}
          strokeWidth={op.size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    if (op.type === 'shape') {
      const { start, end, color: c, size, shapeType } = op;
      if (shapeType === 'line') {
        return (
          <line key={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={c} strokeWidth={size} strokeLinecap="round" />
        );
      }
      if (shapeType === 'circle') {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        return (
          <ellipse key={id} cx={cx} cy={cy} rx={rx} ry={ry}
            fill="none" stroke={c} strokeWidth={size} />
        );
      }
      if (shapeType === 'rectangle') {
        return (
          <rect
            key={id}
            x={Math.min(start.x, end.x)}
            y={Math.min(start.y, end.y)}
            width={Math.abs(end.x - start.x)}
            height={Math.abs(end.y - start.y)}
            fill="none"
            stroke={c}
            strokeWidth={size}
          />
        );
      }
    }
    return null;
  };

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Lápis' },
    { id: 'line', icon: Minus, label: 'Linha' },
    { id: 'circle', icon: Circle, label: 'Círculo' },
    { id: 'rectangle', icon: Square, label: 'Retângulo' },
  ];

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${virtualWidth} ${virtualHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        // Only intercept pointer events when the drawing tool is active —
        // otherwise tokens, ruler, etc. must remain interactive underneath.
        style={{
          pointerEvents: active ? 'auto' : 'none',
          cursor: active ? 'crosshair' : undefined,
          zIndex: 20,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {drawings.map(d => renderOp(d.id, d.data))}
        {pendingPath && pendingPath.length > 0 && renderOp('pending-path', {
          type: 'path', points: pendingPath, color, size: brushSize,
        })}
        {pendingShape && tool !== 'pencil' && renderOp('pending-shape', {
          type: 'shape',
          shapeType: tool,
          start: pendingShape.start,
          end: pendingShape.end,
          color,
          size: brushSize,
        })}
      </svg>

      {active && (
        <>
          {/* Sync indicator — counter-scaled to remain visible on small viewports */}
          <div className="absolute top-16 sm:top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div
              style={{ transform: `scale(${uiScale})`, transformOrigin: 'center top' }}
              className="bg-card/80 border border-gold/20 rounded-full px-3 py-1 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground font-display">Sincronizado</span>
            </div>
          </div>

          {/* Drawing toolbar — counter-scaled to remain usable on phones */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div
            style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}
            className="bg-card/95 backdrop-blur border border-border rounded-xl p-2 flex items-center gap-1.5 shadow-2xl flex-wrap justify-center max-w-[95vw]"
          >
            {tools.map(t => (
              <Button
                key={t.id}
                variant={tool === t.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`h-10 w-10 sm:h-9 sm:w-9 p-0 ${tool === t.id ? 'bg-primary text-primary-foreground' : ''}`}
              >
                <t.icon className="w-5 h-5 sm:w-4 sm:h-4" />
              </Button>
            ))}

            <div className="w-px h-7 bg-border" />

            <div className="flex gap-1.5 flex-wrap justify-center">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 transition-all ${color === c ? 'border-gold scale-125' : 'border-border'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="w-px h-7 bg-border" />

            <div className="flex items-center gap-2 w-28 sm:w-24">
              <Slider value={[brushSize]} onValueChange={v => setBrushSize(v[0])} min={1} max={20} step={1} />
              <span className="text-sm text-muted-foreground w-5">{brushSize}</span>
            </div>

            <div className="w-px h-7 bg-border" />

            <Button variant="ghost" size="sm" onClick={clearMine} title="Apagar meus desenhos" className="h-10 w-10 sm:h-9 sm:w-9 p-0">
              <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} title="Fechar" className="h-10 w-10 sm:h-9 sm:w-9 p-0">
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>
          </div>
          </div>
        </>
      )}
    </>
  );
}

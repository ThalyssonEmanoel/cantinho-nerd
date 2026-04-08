import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MeasureRulerProps {
  // Inner virtual board element. Pointer events are converted into the virtual
  // coordinate space using its on-screen rect.
  boardRef: React.RefObject<HTMLDivElement>;
  virtualWidth: number;
  virtualHeight: number;
  // Current grid cell size (virtual px) — used to convert px → squares → feet.
  gridCellSize: number;
  onClose: () => void;
  sessionId: string;
  playerId: string;
}

interface RulerState {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
}

interface RemoteRuler extends RulerState {
  playerId: string;
}

// Distinct colors for remote rulers
const REMOTE_COLORS = ['#9b59b6', '#3498db', '#2ecc71', '#e67e22', '#e74c3c'];

export default function MeasureRuler({
  boardRef,
  virtualWidth,
  virtualHeight,
  gridCellSize,
  onClose,
  sessionId,
  playerId,
}: MeasureRulerProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [remoteRulers, setRemoteRulers] = useState<RemoteRuler[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to remote ruler updates. Coordinates are sent in virtual space,
  // so they're identical for every client regardless of screen size.
  useEffect(() => {
    const channel = supabase
      .channel(`ruler-${sessionId}`)
      .on('broadcast', { event: 'ruler_update' }, ({ payload }) => {
        if (payload.senderId === playerId) return;
        const norm = payload as { senderId: string; start: { x: number; y: number } | null; end: { x: number; y: number } | null };
        setRemoteRulers(prev => {
          const filtered = prev.filter(r => r.playerId !== norm.senderId);
          if (!norm.start) return filtered;
          return [...filtered, { playerId: norm.senderId, start: norm.start, end: norm.end }];
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Broadcast ruler cleared when unmounting.
      channel.send({
        type: 'broadcast',
        event: 'ruler_update',
        payload: { senderId: playerId, start: null, end: null },
      });
      supabase.removeChannel(channel);
    };
  }, [sessionId, playerId]);

  const broadcastRuler = useCallback((s: { x: number; y: number } | null, e: { x: number; y: number } | null) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ruler_update',
      payload: { senderId: playerId, start: s, end: e },
    });
  }, [playerId]);

  // Convert pointer event into virtual coordinates.
  const getPos = useCallback((e: React.PointerEvent) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    const sx = virtualWidth / rect.width;
    const sy = virtualHeight / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }, [boardRef, virtualWidth, virtualHeight]);

  const distance = start && end
    ? Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
    : 0;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = getPos(e);
    setStart(pos);
    setEnd(pos);
    setMeasuring(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    broadcastRuler(pos, pos);
  }, [broadcastRuler, getPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!measuring) return;
    const pos = getPos(e);
    setEnd(pos);
    setStart(prev => {
      broadcastRuler(prev, pos);
      return prev;
    });
  }, [measuring, broadcastRuler, getPos]);

  const handlePointerUp = useCallback(() => {
    setMeasuring(false);
  }, []);

  const renderRulerLine = (
    s: { x: number; y: number },
    e: { x: number; y: number },
    color: string,
    dist: number,
    key: string | number
  ) => {
    const sq = gridCellSize > 0 ? Math.round(dist / gridCellSize) : 0;
    const feetVal = sq * 5;
    return (
      <g key={key}>
        <line
          x1={s.x} y1={s.y}
          x2={e.x} y2={e.y}
          stroke={color}
          strokeWidth={3}
          strokeDasharray="12 6"
          opacity={0.85}
        />
        <circle cx={s.x} cy={s.y} r={6} fill={color} />
        <circle cx={e.x} cy={e.y} r={6} fill={color} />
        {dist > 5 && (
          <g transform={`translate(${(s.x + e.x) / 2}, ${(s.y + e.y) / 2})`}>
            <rect x={-70} y={-40} width={140} height={48} rx={8} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={2} opacity={0.95} />
            <text textAnchor="middle" y={-12} fill={color} fontSize={20} fontFamily="var(--font-display)">
              {Math.round(dist)}px · {feetVal}ft
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <>
      {/* Invisible interaction layer (sits inside the virtual board) */}
      <div
        className="absolute inset-0"
        style={{ cursor: 'crosshair', zIndex: 25 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* SVG ruler lines (local + remote), drawn in virtual space */}
      <svg
        viewBox={`0 0 ${virtualWidth} ${virtualHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 26 }}
      >
        {start && end && distance > 5 && renderRulerLine(start, end, 'hsl(var(--gold))', distance, 'local')}
        {remoteRulers.map((ruler) => {
          if (!ruler.start || !ruler.end) return null;
          const rd = Math.sqrt((ruler.end.x - ruler.start.x) ** 2 + (ruler.end.y - ruler.start.y) ** 2);
          const colorIdx = Math.abs(ruler.playerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % REMOTE_COLORS.length;
          return renderRulerLine(ruler.start, ruler.end, REMOTE_COLORS[colorIdx], rd, ruler.playerId);
        })}
      </svg>

      {/* Close hint */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-card/90 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground font-display whitespace-nowrap">
        Clique e arraste para medir ·{' '}
        <button onClick={onClose} className="text-gold hover:underline">
          Fechar régua
        </button>
      </div>
    </>
  );
}

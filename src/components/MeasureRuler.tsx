import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MeasureRulerProps {
  boardRef: React.RefObject<HTMLDivElement>;
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

export default function MeasureRuler({ boardRef, onClose, sessionId, playerId }: MeasureRulerProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [remoteRulers, setRemoteRulers] = useState<RemoteRuler[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getBoardSize = useCallback(() => {
    const rect = boardRef.current?.getBoundingClientRect();
    return { w: rect?.width || 1, h: rect?.height || 1 };
  }, [boardRef]);

  const normalize = useCallback((p: { x: number; y: number }) => {
    const { w, h } = getBoardSize();
    return { x: p.x / w, y: p.y / h };
  }, [getBoardSize]);

  const denormalize = useCallback((p: { x: number; y: number }) => {
    const { w, h } = getBoardSize();
    return { x: p.x * w, y: p.y * h };
  }, [getBoardSize]);

  useEffect(() => {
    const channel = supabase
      .channel(`ruler-${sessionId}`)
      .on('broadcast', { event: 'ruler_update' }, ({ payload }) => {
        if (payload.senderId === playerId) return;

        const norm = payload as { senderId: string; start: { x: number; y: number } | null; end: { x: number; y: number } | null };

        setRemoteRulers(prev => {
          const filtered = prev.filter(r => r.playerId !== norm.senderId);
          if (!norm.start) return filtered;
          return [
            ...filtered,
            {
              playerId: norm.senderId,
              start: norm.start ? denormalize(norm.start) : null,
              end: norm.end ? denormalize(norm.end) : null,
            },
          ];
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Broadcast ruler cleared when unmounting
      channel.send({
        type: 'broadcast',
        event: 'ruler_update',
        payload: { senderId: playerId, start: null, end: null },
      });
      supabase.removeChannel(channel);
    };
  }, [sessionId, playerId, denormalize]);

  const broadcastRuler = useCallback((s: { x: number; y: number } | null, e: { x: number; y: number } | null) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ruler_update',
      payload: {
        senderId: playerId,
        start: s ? normalize(s) : null,
        end: e ? normalize(e) : null,
      },
    });
  }, [playerId, normalize]);

  const getPos = (e: React.PointerEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const distance = start && end
    ? Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
    : 0;

  const squares = Math.round(distance / 50);
  const feet = squares * 5;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = getPos(e);
    setStart(pos);
    setEnd(pos);
    setMeasuring(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    broadcastRuler(pos, pos);
  }, [broadcastRuler]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!measuring) return;
    const pos = getPos(e);
    setEnd(pos);
    setStart(prev => {
      broadcastRuler(prev, pos);
      return prev;
    });
  }, [measuring, broadcastRuler]);

  const handlePointerUp = useCallback(() => {
    setMeasuring(false);
  }, []);

  const renderRulerLine = (
    s: { x: number; y: number },
    e: { x: number; y: number },
    color: string,
    dist: number,
    ft: number,
    key: string | number
  ) => {
    const sq = Math.round(dist / 50);
    const feetVal = sq * 5;
    return (
      <g key={key}>
        <line
          x1={s.x} y1={s.y}
          x2={e.x} y2={e.y}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.8}
        />
        <circle cx={s.x} cy={s.y} r={4} fill={color} />
        <circle cx={e.x} cy={e.y} r={4} fill={color} />
        {dist > 5 && (
          <g transform={`translate(${(s.x + e.x) / 2}, ${(s.y + e.y) / 2})`}>
            <rect x={-42} y={-26} width={84} height={30} rx={6} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} opacity={0.95} />
            <text textAnchor="middle" y={-8} fill={color} fontSize={12} fontFamily="var(--font-display)">
              {Math.round(dist)}px · {feetVal}ft
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <>
      {/* Invisible interaction layer */}
      <div
        className="absolute inset-0 z-25"
        style={{ cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* SVG ruler lines (local + remote) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-26">
        {/* Local ruler */}
        {start && end && distance > 5 && renderRulerLine(start, end, 'hsl(var(--gold))', distance, feet, 'local')}

        {/* Remote rulers */}
        {remoteRulers.map((ruler, i) => {
          if (!ruler.start || !ruler.end) return null;
          const rd = Math.sqrt((ruler.end.x - ruler.start.x) ** 2 + (ruler.end.y - ruler.start.y) ** 2);
          const color = REMOTE_COLORS[i % REMOTE_COLORS.length];
          return renderRulerLine(ruler.start, ruler.end, color, rd, Math.round(rd / 50) * 5, ruler.playerId);
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

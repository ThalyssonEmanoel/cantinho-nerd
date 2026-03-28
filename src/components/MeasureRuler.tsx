import { useState, useCallback } from 'react';

interface MeasureRulerProps {
  boardRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
}

export default function MeasureRuler({ boardRef, onClose }: MeasureRulerProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);

  const getPos = (e: React.PointerEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const distance = start && end
    ? Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
    : 0;

  // Convert px to approximate "squares" (5ft each, assuming ~50px per square)
  const squares = Math.round(distance / 50);
  const feet = squares * 5;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = getPos(e);
    setStart(pos);
    setEnd(pos);
    setMeasuring(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!measuring) return;
    setEnd(getPos(e));
  }, [measuring]);

  const handlePointerUp = useCallback(() => {
    setMeasuring(false);
  }, []);

  const angle = start && end ? Math.atan2(end.y - start.y, end.x - start.x) : 0;

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

      {/* SVG ruler line */}
      {start && end && distance > 5 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-26">
          {/* Line */}
          <line
            x1={start.x} y1={start.y}
            x2={end.x} y2={end.y}
            stroke="hsl(var(--gold))"
            strokeWidth={2}
            strokeDasharray="8 4"
          />
          {/* Start dot */}
          <circle cx={start.x} cy={start.y} r={4} fill="hsl(var(--gold))" />
          {/* End dot */}
          <circle cx={end.x} cy={end.y} r={4} fill="hsl(var(--gold))" />
          {/* Distance label */}
          <g transform={`translate(${(start.x + end.x) / 2}, ${(start.y + end.y) / 2})`}>
            <rect
              x={-40} y={-24}
              width={80} height={28}
              rx={6}
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              textAnchor="middle"
              y={-6}
              fill="hsl(var(--gold))"
              fontSize={13}
              fontFamily="var(--font-display)"
            >
              {Math.round(distance)}px · {feet}ft
            </text>
          </g>
        </svg>
      )}

      {/* Close hint */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-card/90 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground font-display">
        Clique e arraste para medir · <button onClick={onClose} className="text-gold hover:underline">Fechar régua</button>
      </div>
    </>
  );
}

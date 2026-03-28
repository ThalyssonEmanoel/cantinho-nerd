import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Trash2, X, Circle, Square, Minus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface DrawingCanvasProps {
  width: number;
  height: number;
  onClose: () => void;
}

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db',
  '#9b59b6', '#ecf0f1', '#1a1a2e', '#ff6b9d', '#00d2ff',
];

type Tool = 'pencil' | 'eraser' | 'line' | 'circle' | 'rectangle';

export default function DrawingCanvas({ width, height, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    } else {
      setShapeStart(pos);
      snapshotRef.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (shapeStart && snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'source-over';

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - shapeStart.x) / 2;
        const ry = Math.abs(pos.y - shapeStart.y) / 2;
        const cx = (shapeStart.x + pos.x) / 2;
        const cy = (shapeStart.y + pos.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        ctx.beginPath();
        ctx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    setShapeStart(null);
    snapshotRef.current = null;
    const ctx = getCtx();
    if (ctx) ctx.globalCompositeOperation = 'source-over';
  };

  const clearCanvas = () => {
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Lápis' },
    { id: 'eraser', icon: Eraser, label: 'Borracha' },
    { id: 'line', icon: Minus, label: 'Linha' },
    { id: 'circle', icon: Circle, label: 'Círculo' },
    { id: 'rectangle', icon: Square, label: 'Retângulo' },
  ];

  return (
    <>
      {/* Drawing canvas overlay */}
      <canvas
        ref={canvasRef}
        width={width || 1920}
        height={height || 1080}
        className="absolute inset-0 w-full h-full z-20"
        style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Drawing toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur border border-border rounded-xl p-3 flex items-center gap-3 shadow-2xl">
        {tools.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool(t.id)}
            title={t.label}
            className={tool === t.id ? 'bg-primary text-primary-foreground' : ''}
          >
            <t.icon className="w-4 h-4" />
          </Button>
        ))}

        <div className="w-px h-6 bg-border" />

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-gold scale-125' : 'border-border'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Brush size */}
        <div className="flex items-center gap-2 w-24">
          <Slider
            value={[brushSize]}
            onValueChange={v => setBrushSize(v[0])}
            min={1}
            max={20}
            step={1}
          />
          <span className="text-xs text-muted-foreground w-5">{brushSize}</span>
        </div>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="sm" onClick={clearCanvas} title="Limpar tudo">
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} title="Fechar">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}

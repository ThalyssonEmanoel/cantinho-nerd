import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Trash2, X, Circle, Square, Minus, Undo2, Redo2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface DrawingCanvasProps {
  width: number;
  height: number;
  onClose: () => void;
  sessionId: string;
  playerId: string;
}

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db',
  '#9b59b6', '#ecf0f1', '#1a1a2e', '#ff6b9d', '#00d2ff',
];

type Tool = 'pencil' | 'eraser' | 'line' | 'circle' | 'rectangle';

type DrawOp =
  | { type: 'path'; points: { x: number; y: number }[]; color: string; size: number }
  | { type: 'erase'; points: { x: number; y: number }[]; size: number }
  | { type: 'shape'; shapeType: 'line' | 'circle' | 'rectangle'; start: { x: number; y: number }; end: { x: number; y: number }; color: string; size: number }
  | { type: 'clear' };

export default function DrawingCanvas({ width, height, onClose, sessionId, playerId }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [currentEndPos, setCurrentEndPos] = useState<{ x: number; y: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const snapshotRef = useRef<ImageData | null>(null);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);

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

  const normalize = useCallback((p: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    return { x: p.x / (canvas?.width || 1), y: p.y / (canvas?.height || 1) };
  }, []);

  const saveToUndoStack = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Persist canvas to Supabase Storage (debounced 3s)
  const persistCanvas = useCallback(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const path = `canvas/${sessionId}.png`;
        const { error } = await supabase.storage.from('vtt-assets').upload(path, blob, { upsert: true });
        if (error) return;
        const { data } = supabase.storage.from('vtt-assets').getPublicUrl(path);
        await supabase.from('sessions').update({ canvas_snapshot_url: data.publicUrl } as any).eq('id', sessionId);
      }, 'image/png');
    }, 3000);
  }, [sessionId]);

  // Replay a drawing operation
  const replayOp = useCallback((op: DrawOp) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (op.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    if (op.type === 'path') {
      const pts = op.points.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
      if (!pts.length) return;
      ctx.beginPath();
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (op.type === 'erase') {
      const pts = op.points.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
      if (!pts.length) return;
      ctx.beginPath();
      ctx.lineWidth = op.size * 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (op.type === 'shape') {
      const s = { x: op.start.x * canvas.width, y: op.start.y * canvas.height };
      const e = { x: op.end.x * canvas.width, y: op.end.y * canvas.height };
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.size;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      if (op.shapeType === 'line') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      } else if (op.shapeType === 'circle') {
        const rx = Math.abs(e.x - s.x) / 2, ry = Math.abs(e.y - s.y) / 2;
        ctx.ellipse((s.x + e.x) / 2, (s.y + e.y) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (op.shapeType === 'rectangle') {
        ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
      }
    }
  }, []);

  // Load snapshot on mount
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('sessions').select('canvas_snapshot_url').eq('id', sessionId).single();
      const url = (data as any)?.canvas_snapshot_url;
      if (!url) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = url + '?t=' + Date.now();
    };
    load();
  }, [sessionId]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase
      .channel(`canvas-${sessionId}`)
      .on('broadcast', { event: 'draw_op' }, ({ payload }) => {
        if (payload.senderId === playerId) return;
        replayOp(payload.op as DrawOp);
        persistCanvas();
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, playerId, replayOp, persistCanvas]);

  // Keyboard undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || undoStackRef.current.length === 0) return;
    redoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(undoStackRef.current.pop()!, 0, 0);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || redoStackRef.current.length === 0) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(redoStackRef.current.pop()!, 0, 0);
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const broadcastOp = useCallback((op: DrawOp) => {
    channelRef.current?.send({ type: 'broadcast', event: 'draw_op', payload: { senderId: playerId, op } });
  }, [playerId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    saveToUndoStack();

    if (tool === 'pencil' || tool === 'eraser') {
      currentPathRef.current = [normalize(pos)];
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    } else {
      setShapeStart(pos);
      setCurrentEndPos(pos);
      snapshotRef.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === 'pencil' || tool === 'eraser') {
      currentPathRef.current.push(normalize(pos));
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (shapeStart && snapshotRef.current) {
      setCurrentEndPos(pos);
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(shapeStart.x, shapeStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2;
        ctx.ellipse((shapeStart.x + pos.x) / 2, (shapeStart.y + pos.y) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        ctx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);

    if ((tool === 'pencil' || tool === 'eraser') && currentPathRef.current.length > 0) {
      const op: DrawOp = tool === 'pencil'
        ? { type: 'path', points: currentPathRef.current, color, size: brushSize }
        : { type: 'erase', points: currentPathRef.current, size: brushSize };
      broadcastOp(op);
      currentPathRef.current = [];
    } else if (tool !== 'pencil' && tool !== 'eraser' && shapeStart && currentEndPos) {
      const op: DrawOp = {
        type: 'shape',
        shapeType: tool as 'line' | 'circle' | 'rectangle',
        start: normalize(shapeStart),
        end: normalize(currentEndPos),
        color,
        size: brushSize,
      };
      broadcastOp(op);
    }

    setShapeStart(null);
    setCurrentEndPos(null);
    snapshotRef.current = null;
    const ctx = getCtx();
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    persistCanvas();
  };

  const clearCanvas = () => {
    saveToUndoStack();
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    broadcastOp({ type: 'clear' });
    persistCanvas();
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

      {/* Sync + persistence indicator */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-card/80 border border-gold/20 rounded-full px-3 py-1 flex items-center gap-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-muted-foreground font-display">Sincronizado · Salvo automaticamente</span>
      </div>

      {/* Drawing toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur border border-border rounded-xl p-2 flex items-center gap-1 shadow-2xl flex-wrap justify-center max-w-[95vw]">
        {/* Undo/Redo */}
        <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="h-8 w-8 p-0">
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)" className="h-8 w-8 p-0">
          <Redo2 className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {tools.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`h-8 w-8 p-0 ${tool === t.id ? 'bg-primary text-primary-foreground' : ''}`}
          >
            <t.icon className="w-3.5 h-3.5" />
          </Button>
        ))}

        <div className="w-px h-6 bg-border" />

        {/* Colors */}
        <div className="flex gap-1 flex-wrap justify-center">
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

        <div className="flex items-center gap-2 w-20">
          <Slider value={[brushSize]} onValueChange={v => setBrushSize(v[0])} min={1} max={20} step={1} />
          <span className="text-xs text-muted-foreground w-4">{brushSize}</span>
        </div>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="sm" onClick={clearCanvas} title="Limpar tudo" className="h-8 w-8 p-0">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} title="Fechar" className="h-8 w-8 p-0">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </>
  );
}

import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImagePlus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

interface TokenImagePickerProps {
  sessionId: string;
  imageUrl: string | null;
  offsetX: number;
  offsetY: number;
  onChange: (next: { imageUrl: string | null; offsetX: number; offsetY: number }) => void;
  readOnly?: boolean;
  // Tailwind border color class — defaults to the player gold so the preview
  // matches what the token will look like on the board.
  borderClass?: string;
}

const STEP = 0.1;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

// Reusable circular avatar picker. Lets the user upload an image and shift it
// inside the circle (just like the token D-pad on the board), so the sheet's
// image becomes the source of truth for the player's token.
export default function TokenImagePicker({
  sessionId,
  imageUrl,
  offsetX,
  offsetY,
  onChange,
  readOnly = false,
  borderClass = 'border-gold',
}: TokenImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `tokens/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('vtt-assets').upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('vtt-assets').getPublicUrl(path);
      onChange({ imageUrl: data.publicUrl, offsetX, offsetY });
      toast.success('Imagem do token atualizada — não esqueça de salvar a ficha');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const nudge = (dx: number, dy: number) => {
    if (readOnly) return;
    onChange({ imageUrl, offsetX: clamp(offsetX + dx), offsetY: clamp(offsetY + dy) });
  };

  const recenter = () => {
    if (readOnly) return;
    onChange({ imageUrl, offsetX: 0, offsetY: 0 });
  };

  const clearImage = () => {
    if (readOnly) return;
    onChange({ imageUrl: null, offsetX: 0, offsetY: 0 });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Circular preview that mirrors the board token style. */}
      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 shadow-lg shrink-0 bg-secondary flex items-center justify-center ${borderClass}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Avatar do personagem"
            draggable={false}
            className="w-full h-full object-cover"
            style={{ objectPosition: `${50 + offsetX * 50}% ${50 + offsetY * 50}%` }}
          />
        ) : (
          <User className="w-8 h-8 text-muted-foreground/60" />
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-[11px] font-display border border-gold/40 text-gold rounded px-2 py-1 hover:bg-gold/10 disabled:opacity-50"
              title="Enviar imagem do personagem"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {uploading ? 'Enviando…' : (imageUrl ? 'Trocar' : 'Enviar')}
            </button>
            {imageUrl && (
              <button
                type="button"
                onClick={clearImage}
                className="flex items-center gap-1 text-[11px] font-display border border-border text-muted-foreground rounded px-2 py-1 hover:text-destructive hover:border-destructive/50"
                title="Remover imagem"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Framing D-pad — only relevant once an image exists. */}
          {imageUrl && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-display mr-1">Centralizar:</span>
              <div className="grid grid-cols-3 gap-0.5">
                <span />
                <button type="button" onClick={() => nudge(0, -STEP)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Subir">
                  <ArrowUp className="w-3 h-3 text-muted-foreground" />
                </button>
                <span />
                <button type="button" onClick={() => nudge(-STEP, 0)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Esquerda">
                  <ArrowLeft className="w-3 h-3 text-muted-foreground" />
                </button>
                <button type="button" onClick={recenter} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Centralizar">
                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                </button>
                <button type="button" onClick={() => nudge(STEP, 0)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Direita">
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
                <span />
                <button type="button" onClick={() => nudge(0, STEP)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Descer">
                  <ArrowDown className="w-3 h-3 text-muted-foreground" />
                </button>
                <span />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

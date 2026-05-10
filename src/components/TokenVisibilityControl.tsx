import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface TokenVisibilityControlProps {
  tokenId: string;
  isHidden: boolean;
  visionRadius: number;
  isDm: boolean;
  onUpdate: () => void;
}

export default function TokenVisibilityControl({
  tokenId,
  isHidden,
  visionRadius,
  isDm,
  onUpdate
}: TokenVisibilityControlProps) {
  const [radius, setRadius] = useState(visionRadius.toString());

  const toggleHidden = async () => {
    const { error } = await supabase
      .from('board_tokens')
      .update({ is_hidden: !isHidden })
      .eq('id', tokenId);

    if (error) {
      toast.error('Erro ao alterar visibilidade');
    } else {
      toast.success(isHidden ? 'Token revelado' : 'Token ocultado');
      onUpdate();
    }
  };

  const updateVisionRadius = async () => {
    const newRadius = parseInt(radius);
    if (isNaN(newRadius) || newRadius < 0) {
      toast.error('Raio inválido');
      return;
    }

    const { error } = await supabase
      .from('board_tokens')
      .update({ vision_radius: newRadius })
      .eq('id', tokenId);

    if (error) {
      toast.error('Erro ao atualizar raio de visão');
    } else {
      toast.success('Raio de visão atualizado');
      onUpdate();
    }
  };

  if (!isDm) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isHidden ? 'destructive' : 'outline'}
          onClick={toggleHidden}
          className="flex-1 h-8 text-xs"
        >
          {isHidden ? (
            <>
              <EyeOff className="w-3 h-3 mr-1" /> Oculto
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 mr-1" /> Visível
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Circle className="w-3 h-3 text-muted-foreground" />
        <Input
          type="number"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          onBlur={updateVisionRadius}
          onKeyDown={(e) => e.key === 'Enter' && updateVisionRadius()}
          className="h-7 text-xs flex-1"
          placeholder="Raio de visão"
        />
        <span className="text-xs text-muted-foreground">px</span>
      </div>
    </div>
  );
}

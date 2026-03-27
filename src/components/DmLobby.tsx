import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Plus, Copy, ArrowRight, Upload, X, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface DmLobbyProps {
  onSessionStart: (sessionId: string) => void;
}

export default function DmLobby({ onSessionStart }: DmLobbyProps) {
  const { player, setRole } = useAuth();
  const [sessionName, setSessionName] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [maps, setMaps] = useState<File[]>([]);
  const [monsters, setMonsters] = useState<File[]>([]);
  const [mapPreviews, setMapPreviews] = useState<string[]>([]);
  const [monsterPreviews, setMonsterPreviews] = useState<string[]>([]);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = (files: FileList | null, type: 'map' | 'monster') => {
    if (!files) return;
    const arr = Array.from(files);
    const previews = arr.map(f => URL.createObjectURL(f));
    if (type === 'map') {
      setMaps(prev => [...prev, ...arr]);
      setMapPreviews(prev => [...prev, ...previews]);
    } else {
      setMonsters(prev => [...prev, ...arr]);
      setMonsterPreviews(prev => [...prev, ...previews]);
    }
  };

  const removeFile = (index: number, type: 'map' | 'monster') => {
    if (type === 'map') {
      setMaps(prev => prev.filter((_, i) => i !== index));
      setMapPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setMonsters(prev => prev.filter((_, i) => i !== index));
      setMonsterPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadFiles = async (files: File[], folder: string) => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('vtt-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('vtt-assets').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const createSession = async () => {
    if (!sessionName.trim() || !sessionPassword.trim()) {
      toast.error('Preencha o nome e senha da sessão');
      return;
    }
    if (!player) return;
    setLoading(true);

    try {
      const mapUrls = await uploadFiles(maps, 'maps');
      const monsterUrls = await uploadFiles(monsters, 'monsters');

      const { data: session, error } = await supabase.from('sessions').insert({
        name: sessionName.trim(),
        dm_id: player.id,
        password: sessionPassword.trim(),
        maps: mapUrls,
        monster_images: monsterUrls,
        active_map_url: mapUrls[0] || null,
      }).select().single();

      if (error) throw error;

      await supabase.from('session_participants').insert({
        session_id: session.id,
        player_id: player.id,
        role: 'dm',
      });

      setCreatedSessionId(session.id);
      toast.success('Sessão criada!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/join/${createdSessionId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  if (createdSessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient">
        <div className="bg-card-gradient border border-border rounded-xl p-8 max-w-md w-full mx-4 text-center">
          <Crown className="w-12 h-12 text-gold mx-auto mb-4" />
          <h2 className="text-2xl font-display text-foreground mb-2">Sessão Criada!</h2>
          <p className="text-muted-foreground mb-6">Compartilhe o link com seus jogadores</p>
          
          <div className="bg-secondary rounded-lg p-3 mb-4 text-sm text-foreground break-all font-mono">
            {window.location.origin}/join/{createdSessionId}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 font-display" onClick={copyLink}>
              <Copy className="w-4 h-4 mr-2" /> Copiar Link
            </Button>
            <Button className="flex-1 font-display" onClick={() => onSessionStart(createdSessionId)}>
              <ArrowRight className="w-4 h-4 mr-2" /> Iniciar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient">
      <div className="bg-card-gradient border border-border rounded-xl p-8 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-gold" />
            <h2 className="text-2xl font-display text-foreground">Criar Nova Sessão</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRole(null)}>
            <LogOut className="w-4 h-4 mr-1" /> Voltar
          </Button>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-display text-sm">Nome da Sessão</Label>
              <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="A Masmorra do Dragão" className="mt-1 bg-secondary" />
            </div>
            <div>
              <Label className="font-display text-sm">Senha de Acesso</Label>
              <Input type="password" value={sessionPassword} onChange={e => setSessionPassword(e.target.value)} placeholder="••••••" className="mt-1 bg-secondary" />
            </div>
          </div>

          {/* Maps Upload */}
          <div>
            <Label className="font-display text-sm">Mapas</Label>
            <div className="mt-1 flex flex-wrap gap-3">
              {mapPreviews.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeFile(i, 'map')} className="absolute top-1 right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer hover:border-gold transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files, 'map')} />
              </label>
            </div>
          </div>

          {/* Monsters Upload */}
          <div>
            <Label className="font-display text-sm">Monstros</Label>
            <div className="mt-1 flex flex-wrap gap-3">
              {monsterPreviews.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-full overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeFile(i, 'monster')} className="absolute top-0 right-0 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer hover:border-gold transition-colors">
                <Plus className="w-5 h-5 text-muted-foreground" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files, 'monster')} />
              </label>
            </div>
          </div>

          <Button className="w-full font-display text-lg py-5" onClick={createSession} disabled={loading}>
            {loading ? 'Criando...' : 'Forjar a Sessão'}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Plus, Copy, ArrowRight, Upload, X, LogOut, History, Play, Calendar, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import ProfileSettings from './ProfileSettings';

interface DmLobbyProps {
  onSessionStart: (sessionId: string) => void;
}

interface PastSession {
  id: string;
  name: string;
  created_at: string;
  active_map_url: string | null;
  is_active: boolean;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function DmLobby({ onSessionStart }: DmLobbyProps) {
  const { player, setRole } = useAuth();
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [sessionName, setSessionName] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [maps, setMaps] = useState<File[]>([]);
  const [monsters, setMonsters] = useState<File[]>([]);
  const [mapPreviews, setMapPreviews] = useState<string[]>([]);
  const [monsterPreviews, setMonsterPreviews] = useState<string[]>([]);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (tab === 'history' && player) loadHistory();
  }, [tab, player]);

  const loadHistory = async () => {
    if (!player) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('sessions')
      .select('id, name, created_at, active_map_url, is_active')
      .eq('dm_id', player.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPastSessions((data as PastSession[]) || []);
    setLoadingHistory(false);
  };

  const rejoinSession = async (sessionId: string) => {
    if (!player) return;
    await supabase.from('session_participants').upsert({
      session_id: sessionId,
      player_id: player.id,
      role: 'dm',
    }, { onConflict: 'session_id,player_id' });
    onSessionStart(sessionId);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir esta sessão permanentemente? Todos os dados serão perdidos.')) return;
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) toast.error('Erro ao excluir sessão');
    else {
      toast.success('Sessão excluída');
      setPastSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

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
      const hashedPassword = await sha256(sessionPassword.trim());

      const { data: session, error } = await supabase.from('sessions').insert({
        name: sessionName.trim(),
        dm_id: player.id,
        password: hashedPassword,
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
      <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient p-4">
        <div className="bg-card-gradient border border-border rounded-xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-gold" />
          </div>
          <h2 className="text-2xl font-display text-foreground mb-2">Sessão Criada!</h2>
          <p className="text-muted-foreground mb-6 text-sm">Compartilhe o link com seus jogadores</p>
          <div className="bg-secondary rounded-lg p-3 mb-4 text-xs text-foreground break-all font-mono border border-border">
            {window.location.origin}/join/{createdSessionId}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 font-display text-sm" onClick={copyLink}>
              <Copy className="w-4 h-4 mr-2" /> Copiar Link
            </Button>
            <Button className="flex-1 font-display text-sm" onClick={() => onSessionStart(createdSessionId)}>
              <ArrowRight className="w-4 h-4 mr-2" /> Iniciar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}

      <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient p-4">
        <div className="bg-card-gradient border border-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                <Crown className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-display text-foreground leading-tight">Mestre de Jogo</h2>
                <p className="text-xs text-muted-foreground">{player?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowProfile(true)} className="h-8 w-8 p-0 text-muted-foreground">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRole(null)} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4 mr-1" /> Sair
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 py-3 text-sm font-display transition-colors flex items-center justify-center gap-2 ${
                tab === 'create' ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Plus className="w-4 h-4" /> Nova Sessão
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex-1 py-3 text-sm font-display transition-colors flex items-center justify-center gap-2 ${
                tab === 'history' ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-4 h-4" /> Retomar Sessão
            </button>
          </div>

          <div className="p-6">
            {tab === 'create' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-display text-sm">Nome da Sessão</Label>
                    <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="A Masmorra do Dragão" className="mt-1 bg-secondary border-border" />
                  </div>
                  <div>
                    <Label className="font-display text-sm">Senha de Acesso</Label>
                    <Input type="password" value={sessionPassword} onChange={e => setSessionPassword(e.target.value)} placeholder="••••••" className="mt-1 bg-secondary border-border" />
                    <p className="text-[10px] text-muted-foreground mt-1">Armazenada com hash SHA-256</p>
                  </div>
                </div>

                <div>
                  <Label className="font-display text-sm">Mapas</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {mapPreviews.map((url, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeFile(i, 'map')} className="absolute top-1 right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3 text-destructive-foreground" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center cursor-pointer hover:border-gold/60 transition-colors gap-1">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Adicionar</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files, 'map')} />
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="font-display text-sm">Monstros</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {monsterPreviews.map((url, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-full overflow-hidden border border-border group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeFile(i, 'monster')} className="absolute top-0 right-0 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3 text-destructive-foreground" />
                        </button>
                      </div>
                    ))}
                    <label className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-gold/60 transition-colors">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files, 'monster')} />
                    </label>
                  </div>
                </div>

                <Button className="w-full font-display text-base py-5" onClick={createSession} disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" /> Criando...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Crown className="w-4 h-4" /> Forjar a Sessão</span>
                  )}
                </Button>
              </div>
            )}

            {tab === 'history' && (
              <div>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <span className="animate-spin rounded-full h-6 w-6 border-2 border-gold border-t-transparent mr-3" />
                    Carregando sessões...
                  </div>
                ) : pastSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-display">Nenhuma sessão encontrada</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Crie sua primeira sessão na aba ao lado</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {pastSessions.map(session => (
                      <div key={session.id} className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border hover:border-gold/40 transition-all group">
                        {session.active_map_url ? (
                          <img src={session.active_map_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                            <Crown className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-sm text-foreground truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" onClick={() => rejoinSession(session.id)}
                            className="font-display text-xs bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30" variant="ghost">
                            <Play className="w-3 h-3 mr-1" /> Retomar
                          </Button>
                          <Button size="sm" onClick={(e) => deleteSession(session.id, e)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" variant="ghost">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sword, LogOut, ArrowRight, History, Play, Calendar, Map, Settings } from 'lucide-react';
import ProfileSettings from './ProfileSettings';

interface PlayerLobbyProps {
  onJoinSession: (sessionId: string) => void;
  onRejoinSession: (sessionId: string) => void;
}

interface PastSession {
  session_id: string;
  sessions: {
    id: string;
    name: string;
    created_at: string;
    active_map_url: string | null;
    is_active: boolean;
  };
}

export default function PlayerLobby({ onJoinSession, onRejoinSession }: PlayerLobbyProps) {
  const { player, setRole } = useAuth();
  const [tab, setTab] = useState<'join' | 'history'>('join');
  const [sessionLink, setSessionLink] = useState('');
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (tab === 'history' && player) {
      loadHistory();
    }
  }, [tab, player]);

  const loadHistory = async () => {
    if (!player) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('session_participants')
      .select('session_id, sessions(id, name, created_at, active_map_url, is_active)')
      .eq('player_id', player.id)
      .eq('role', 'player')
      .order('joined_at', { ascending: false })
      .limit(20);
    setPastSessions((data as unknown as PastSession[]) || []);
    setLoadingHistory(false);
  };

  const extractSessionId = () => {
    const match = sessionLink.match(/join\/([a-f0-9-]{36})/i) || sessionLink.match(/^([a-f0-9-]{36})$/i);
    if (match) {
      onJoinSession(match[1]);
    }
  };

  return (
    <>
      {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient p-4">
      <div className="bg-card-gradient border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-arcane/10 border border-arcane/30 flex items-center justify-center">
              <Sword className="w-5 h-5 text-arcane" />
            </div>
            <div>
              <h2 className="text-xl font-display text-foreground leading-tight">Aventureiro</h2>
              <p className="text-xs text-muted-foreground">{player?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
            onClick={() => setTab('join')}
            className={`flex-1 py-3 text-sm font-display transition-colors flex items-center justify-center gap-2 ${
              tab === 'join' ? 'text-arcane border-b-2 border-arcane bg-arcane/5' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowRight className="w-4 h-4" /> Nova Sessão
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-display transition-colors flex items-center justify-center gap-2 ${
              tab === 'history' ? 'text-arcane border-b-2 border-arcane bg-arcane/5' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-4 h-4" /> Retomar
          </button>
        </div>

        <div className="p-6">
          {/* Join New Session Tab */}
          {tab === 'join' && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm text-center">Cole o link ou ID da sessão do mestre</p>
              <div>
                <Label className="font-display text-sm">Link ou ID da Sessão</Label>
                <Input
                  value={sessionLink}
                  onChange={e => setSessionLink(e.target.value)}
                  placeholder="Cole o link aqui..."
                  className="mt-1 bg-secondary border-border"
                  onKeyDown={e => e.key === 'Enter' && extractSessionId()}
                />
              </div>
              <Button className="w-full font-display" onClick={extractSessionId}>
                <ArrowRight className="w-4 h-4 mr-2" /> Encontrar Sessão
              </Button>
            </div>
          )}

          {/* History Tab */}
          {tab === 'history' && (
            <div>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <span className="animate-spin rounded-full h-6 w-6 border-2 border-arcane border-t-transparent mr-3" />
                  Carregando sessões...
                </div>
              ) : pastSessions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-display">Nenhuma sessão encontrada</p>
                  <p className="text-muted-foreground/60 text-sm mt-1">Entre em uma nova sessão usando o link do mestre</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {pastSessions.map(item => {
                    const session = item.sessions;
                    if (!session) return null;
                    return (
                      <div
                        key={item.session_id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border hover:border-arcane/40 transition-all"
                      >
                        {session.active_map_url ? (
                          <img src={session.active_map_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                            <Map className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-sm text-foreground truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onRejoinSession(item.session_id)}
                          className="shrink-0 font-display text-xs bg-arcane/10 hover:bg-arcane/20 text-arcane border border-arcane/30 hover:border-arcane/60"
                          variant="ghost"
                        >
                          <Play className="w-3 h-3 mr-1" /> Retomar
                        </Button>
                      </div>
                    );
                  })}
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

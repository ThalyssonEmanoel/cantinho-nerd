import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import DiceRoller from './DiceRoller';
import DiceLog from './DiceLog';
import { Button } from '@/components/ui/button';
import { Image, Plus, Trash2, LogOut, Dices, ScrollText, Menu } from 'lucide-react';

interface GameBoardProps {
  sessionId: string;
  onLeave: () => void;
}

interface Token {
  id: string;
  session_id: string;
  owner_id: string | null;
  image_url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  token_type: string;
}

interface Session {
  id: string;
  name: string;
  dm_id: string;
  active_map_url: string | null;
  maps: string[];
  monster_images: string[];
}

export default function GameBoard({ sessionId, onLeave }: GameBoardProps) {
  const { player, role } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [showDice, setShowDice] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showMonsters, setShowMonsters] = useState(false);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);
  const isDm = role === 'dm';

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (data) setSession(data as Session);
    };
    loadSession();
  }, [sessionId]);

  // Load tokens
  useEffect(() => {
    const loadTokens = async () => {
      const { data } = await supabase.from('board_tokens').select('*').eq('session_id', sessionId);
      if (data) setTokens(data as Token[]);
    };
    loadTokens();
  }, [sessionId]);

  // Real-time subscriptions
  useEffect(() => {
    const tokenChannel = supabase
      .channel('board-tokens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_tokens', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTokens(prev => [...prev.filter(t => t.id !== (payload.new as Token).id), payload.new as Token]);
          } else if (payload.eventType === 'UPDATE') {
            setTokens(prev => prev.map(t => t.id === (payload.new as Token).id ? payload.new as Token : t));
          } else if (payload.eventType === 'DELETE') {
            setTokens(prev => prev.filter(t => t.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel('session-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setSession(prev => prev ? { ...prev, ...payload.new } as Session : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokenChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [sessionId]);

  // Change active map (DM only)
  const setActiveMap = async (url: string) => {
    await supabase.from('sessions').update({ active_map_url: url }).eq('id', sessionId);
    setShowMapPicker(false);
  };

  // Add player token to board
  const addPlayerToken = async () => {
    if (!player) return;
    const existing = tokens.find(t => t.owner_id === player.id && t.token_type === 'player');
    if (existing) {
      toast.info('Seu token já está no mapa!');
      return;
    }
    await supabase.from('board_tokens').insert({
      session_id: sessionId,
      owner_id: player.id,
      image_url: player.avatar_url || '',
      label: player.name,
      x: 200,
      y: 200,
      token_type: 'player',
    });
  };

  // Add monster token (DM only)
  const addMonsterToken = async (imageUrl: string) => {
    await supabase.from('board_tokens').insert({
      session_id: sessionId,
      owner_id: player?.id,
      image_url: imageUrl,
      label: 'Monstro',
      x: 300 + Math.random() * 200,
      y: 300 + Math.random() * 200,
      width: 50,
      height: 50,
      token_type: 'monster',
    });
    setShowMonsters(false);
  };

  // Remove token
  const removeToken = async (tokenId: string) => {
    await supabase.from('board_tokens').delete().eq('id', tokenId);
  };

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent, token: Token) => {
    // Only allow drag if: DM (can drag anything) or player owns the token
    if (!isDm && token.owner_id !== player?.id) return;
    if (!isDm && token.token_type === 'monster') return;

    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    setDraggingToken(token.id);
    setDragOffset({
      x: e.clientX - rect.left - token.x,
      y: e.clientY - rect.top - token.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDm, player]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingToken || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 50, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - 50, e.clientY - rect.top - dragOffset.y));

    // Optimistic local update
    setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x, y } : t));
  }, [draggingToken, dragOffset]);

  const handlePointerUp = useCallback(async () => {
    if (!draggingToken) return;
    const token = tokens.find(t => t.id === draggingToken);
    if (token) {
      await supabase.from('board_tokens').update({ x: token.x, y: token.y }).eq('id', token.id);
    }
    setDraggingToken(null);
  }, [draggingToken, tokens]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0 z-20">
        <span className="font-display text-gold text-sm tracking-wider">{session?.name || 'Carregando...'}</span>
        <div className="flex-1" />

        {isDm && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowMapPicker(!showMapPicker)} title="Trocar Mapa">
              <Image className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowMonsters(!showMonsters)} title="Monstros">
              <Plus className="w-4 h-4" />
            </Button>
          </>
        )}

        {!isDm && (
          <Button variant="ghost" size="sm" onClick={addPlayerToken} title="Colocar Token">
            <Plus className="w-4 h-4 mr-1" /> Meu Token
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={() => setShowDice(!showDice)}>
          <Dices className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowLog(!showLog)}>
          <ScrollText className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onLeave}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Board Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={boardRef}
          className="w-full h-full relative select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            backgroundImage: session?.active_map_url ? `url(${session.active_map_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: 'hsl(220, 20%, 6%)',
          }}
        >
          {!session?.active_map_url && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-display">
              {isDm ? 'Selecione um mapa para começar' : 'Aguardando o mestre selecionar um mapa...'}
            </div>
          )}

          {/* Tokens */}
          {tokens.map(token => (
            <div
              key={token.id}
              className={`absolute cursor-grab active:cursor-grabbing group ${draggingToken === token.id ? 'z-50' : 'z-10'}`}
              style={{ left: token.x, top: token.y, width: token.width, height: token.height }}
              onPointerDown={e => handlePointerDown(e, token)}
            >
              <div className={`w-full h-full rounded-full overflow-hidden border-2 ${
                token.token_type === 'player' ? 'border-gold glow-gold' : 'border-blood'
              } shadow-lg`}>
                <img src={token.image_url} alt={token.label} className="w-full h-full object-cover pointer-events-none" draggable={false} />
              </div>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-display bg-card/90 px-1.5 py-0.5 rounded text-foreground border border-border">
                {token.label}
              </div>
              {isDm && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeToken(token.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50"
                >
                  <Trash2 className="w-3 h-3 text-destructive-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Map picker overlay (DM) */}
        {showMapPicker && session && (
          <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 max-w-xs shadow-2xl">
            <h3 className="font-display text-sm text-gold mb-3">Mapas Disponíveis</h3>
            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-auto">
              {(session.maps || []).map((url, i) => (
                <button key={i} onClick={() => setActiveMap(url)}
                  className={`rounded-lg overflow-hidden border-2 transition-all ${session.active_map_url === url ? 'border-gold' : 'border-border hover:border-gold/50'}`}>
                  <img src={url} alt="" className="w-full h-16 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monster picker overlay (DM) */}
        {showMonsters && session && (
          <div className="absolute top-2 right-16 bg-card border border-border rounded-xl p-4 z-30 max-w-xs shadow-2xl">
            <h3 className="font-display text-sm text-gold mb-3">Adicionar Monstro</h3>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-auto">
              {(session.monster_images || []).map((url, i) => (
                <button key={i} onClick={() => addMonsterToken(url)}
                  className="w-14 h-14 rounded-full overflow-hidden border-2 border-border hover:border-blood transition-all">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dice Roller */}
        {showDice && (
          <div className="absolute bottom-4 left-4 z-30">
            <DiceRoller sessionId={sessionId} onClose={() => setShowDice(false)} />
          </div>
        )}

        {/* Dice Log */}
        {showLog && (
          <div className="absolute top-0 right-0 h-full w-80 z-30">
            <DiceLog sessionId={sessionId} onClose={() => setShowLog(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

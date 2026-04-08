import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import DiceRoller from './DiceRoller';
import DiceLog from './DiceLog';
import DrawingCanvas from './DrawingCanvas';
import MeasureRuler from './MeasureRuler';
import GridOverlay from './GridOverlay';
import FogOfWar from './FogOfWar';
import ChatPanel from './ChatPanel';
import CombatCalculator from './CombatCalculator';
import ProfileSettings from './ProfileSettings';
import CharacterSheet from './CharacterSheet';
import { Button } from '@/components/ui/button';
import {
  Image, Plus, Trash2, LogOut, Dices, ScrollText, Pencil, Ruler,
  ZoomIn, ZoomOut, Menu, X, Grid3x3, CloudFog, MessageCircle,
  Calculator, Settings, Smile, ClipboardList, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface TokenReaction {
  tokenId: string;
  emoji: string;
  id: string;
}

const REACTIONS = ['👍', '😮', '😱', '⚔️', '🎉', '💀', '✨', '❤️'];

export default function GameBoard({ sessionId, onLeave }: GameBoardProps) {
  const { player, role } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [showDice, setShowDice] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showMonsters, setShowMonsters] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showFog, setShowFog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [charSheetTarget, setCharSheetTarget] = useState<{ playerId: string; playerName: string; readOnly: boolean } | null>(null);
  const [showPlayerSheets, setShowPlayerSheets] = useState(false);
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null); // tokenId
  const [tokenReactions, setTokenReactions] = useState<TokenReaction[]>([]);
  const [gridSize, setGridSize] = useState(50);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  const boardRef = useRef<HTMLDivElement>(null);
  const reactionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isDm = role === 'dm';

  // Track board size for grid/fog
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setBoardSize({ w: width, h: height });
    });
    if (boardRef.current) obs.observe(boardRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (data) setSession(data as Session);
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('board_tokens').select('*').eq('session_id', sessionId);
      if (data) setTokens(data as Token[]);
    };
    load();
  }, [sessionId]);

  // Load all players in the session (for the character sheet picker)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('session_participants')
        .select('player_id, players(id, name, avatar_url)')
        .eq('session_id', sessionId);
      if (data) {
        const players = data
          .map((row: any) => row.players)
          .filter(Boolean) as { id: string; name: string; avatar_url: string | null }[];
        setSessionPlayers(players);
      }
    };
    load();
  }, [sessionId]);

  // Realtime subscriptions
  useEffect(() => {
    const tokenChannel = supabase
      .channel(`board-tokens-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_tokens', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setTokens(prev => [...prev.filter(t => t.id !== (payload.new as Token).id), payload.new as Token]);
          else if (payload.eventType === 'UPDATE') setTokens(prev => prev.map(t => t.id === (payload.new as Token).id ? payload.new as Token : t));
          else if (payload.eventType === 'DELETE') setTokens(prev => prev.filter(t => t.id !== (payload.old as any).id));
        })
      .subscribe();

    const sessionChannel = supabase
      .channel(`session-updates-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => { setSession(prev => prev ? { ...prev, ...payload.new } as Session : null); })
      .subscribe();

    // Reaction channel
    const reactionChannel = supabase
      .channel(`reactions-${sessionId}`)
      .on('broadcast', { event: 'token_reaction' }, ({ payload }) => {
        const reaction: TokenReaction = { tokenId: payload.tokenId, emoji: payload.emoji, id: crypto.randomUUID() };
        setTokenReactions(prev => [...prev, reaction]);
        setTimeout(() => setTokenReactions(prev => prev.filter(r => r.id !== reaction.id)), 3000);
      })
      .subscribe();

    reactionChannelRef.current = reactionChannel;

    return () => {
      supabase.removeChannel(tokenChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(reactionChannel);
    };
  }, [sessionId]);

  const sendReaction = (tokenId: string, emoji: string) => {
    reactionChannelRef.current?.send({
      type: 'broadcast',
      event: 'token_reaction',
      payload: { tokenId, emoji },
    });
    setShowReactionPicker(null);
  };

  const setActiveMap = async (url: string) => {
    await supabase.from('sessions').update({ active_map_url: url }).eq('id', sessionId);
    setShowMapPicker(false);
  };

  const addPlayerToken = async () => {
    if (!player) return;
    const existing = tokens.find(t => t.owner_id === player.id && t.token_type === 'player');
    if (existing) { toast.info('Seu token já está no mapa!'); return; }
    await supabase.from('board_tokens').insert({
      session_id: sessionId,
      owner_id: player.id,
      image_url: player.avatar_url || '',
      label: player.name,
      x: 200, y: 200,
      token_type: 'player',
    });
  };

  const addMonsterToken = async (imageUrl: string) => {
    await supabase.from('board_tokens').insert({
      session_id: sessionId,
      owner_id: player?.id,
      image_url: imageUrl,
      label: 'Monstro',
      x: 300 + Math.random() * 200,
      y: 300 + Math.random() * 200,
      width: 50, height: 50,
      token_type: 'monster',
    });
    setShowMonsters(false);
  };

  const removeToken = async (tokenId: string) => {
    await supabase.from('board_tokens').delete().eq('id', tokenId);
    if (selectedToken === tokenId) setSelectedToken(null);
  };

  const resizeToken = async (tokenId: string, delta: number) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const newSize = Math.max(20, Math.min(200, token.width + delta));
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, width: newSize, height: newSize } : t));
    await supabase.from('board_tokens').update({ width: newSize, height: newSize }).eq('id', tokenId);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, token: Token) => {
    if (showDrawing || showRuler || showFog) return;
    if (!isDm && token.owner_id !== player?.id) return;
    if (!isDm && token.token_type === 'monster') return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    setDraggingToken(token.id);
    setSelectedToken(token.id);
    setDragOffset({ x: e.clientX - rect.left - token.x, y: e.clientY - rect.top - token.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDm, player, showDrawing, showRuler, showFog]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingToken || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const token = tokens.find(t => t.id === draggingToken);
    const size = token?.width || 50;
    const x = Math.max(0, Math.min(rect.width - size, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - size, e.clientY - rect.top - dragOffset.y));
    setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x, y } : t));
  }, [draggingToken, dragOffset, tokens]);

  const handlePointerUp = useCallback(async () => {
    if (!draggingToken) return;
    const token = tokens.find(t => t.id === draggingToken);
    if (token) await supabase.from('board_tokens').update({ x: token.x, y: token.y }).eq('id', token.id);
    setDraggingToken(null);
  }, [draggingToken, tokens]);

  const canInteractToken = (token: Token) => isDm || token.owner_id === player?.id;

  const toggleTool = (tool: 'drawing' | 'ruler' | 'fog') => {
    setShowDrawing(tool === 'drawing' ? (v => !v) : false);
    setShowRuler(tool === 'ruler' ? (v => !v) : false);
    setShowFog(tool === 'fog' ? (v => !v) : false);
    setShowMobileMenu(false);
  };

  // Toolbar button helper
  const TB = ({ icon: Icon, label, active, onClick, className = '' }: { icon: any; label: string; active?: boolean; onClick: () => void; className?: string }) => (
    <Button variant={active ? 'default' : 'ghost'} size="sm" onClick={onClick} title={label}
      className={`h-8 w-8 p-0 ${active ? 'bg-primary text-primary-foreground' : ''} ${className}`}>
      <Icon className="w-4 h-4" />
    </Button>
  );

  return (
    <>
      {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}
      {charSheetTarget && (
        <CharacterSheet
          sessionId={sessionId}
          onClose={() => setCharSheetTarget(null)}
          targetPlayerId={charSheetTarget.playerId}
          targetPlayerName={charSheetTarget.playerName}
          readOnly={charSheetTarget.readOnly}
        />
      )}

      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Top bar */}
        <div className="h-12 bg-card border-b border-border flex items-center px-2 sm:px-3 gap-1 shrink-0 z-20">
          <span className="font-display text-gold text-xs sm:text-sm tracking-wider truncate max-w-[110px] sm:max-w-none">
            {session?.name || '...'}
          </span>
          <div className="flex-1" />

          {/* Desktop toolbar */}
          <div className="hidden sm:flex items-center gap-0.5">
            {isDm && (
              <>
                <TB icon={Image} label="Trocar Mapa" active={showMapPicker} onClick={() => { setShowMapPicker(v => !v); setShowMobileMenu(false); }} />
                <TB icon={Plus} label="Monstros" active={showMonsters} onClick={() => { setShowMonsters(v => !v); setShowMobileMenu(false); }} />
              </>
            )}
            {!isDm && (
              <Button variant="ghost" size="sm" onClick={addPlayerToken} className="h-8 text-xs px-2">
                <Plus className="w-3.5 h-3.5 mr-1" /> Token
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            <TB icon={Pencil} label="Desenhar" active={showDrawing} onClick={() => toggleTool('drawing')} />
            <TB icon={Ruler} label="Régua" active={showRuler} onClick={() => toggleTool('ruler')} />
            <TB icon={Grid3x3} label="Grade" active={showGrid} onClick={() => setShowGrid(v => !v)} />
            {isDm && <TB icon={CloudFog} label="Névoa de Guerra" active={showFog} onClick={() => toggleTool('fog')} />}

            <div className="w-px h-5 bg-border mx-1" />

            <TB icon={Dices} label="Dados" active={showDice} onClick={() => setShowDice(v => !v)} />
            <TB icon={ScrollText} label="Histórico" active={showLog} onClick={() => setShowLog(v => !v)} />
            <TB icon={MessageCircle} label="Chat" active={showChat} onClick={() => setShowChat(v => !v)} />
            <TB icon={Calculator} label="Calculadora" active={showCalc} onClick={() => setShowCalc(v => !v)} />

            <div className="w-px h-5 bg-border mx-1" />

            {isDm ? (
              <TB icon={Users} label="Fichas dos Jogadores" active={showPlayerSheets} onClick={() => setShowPlayerSheets(v => !v)} />
            ) : (
              <>
                <TB icon={ClipboardList} label="Minha Ficha" onClick={() => player && setCharSheetTarget({ playerId: player.id, playerName: player.name, readOnly: false })} />
                <TB icon={Users} label="Fichas dos Outros" active={showPlayerSheets} onClick={() => setShowPlayerSheets(v => !v)} />
              </>
            )}
            <TB icon={Settings} label="Perfil" onClick={() => setShowProfile(true)} />
            <TB icon={LogOut} label="Sair" onClick={onLeave} className="hover:text-destructive" />
          </div>

          {/* Mobile compact toolbar */}
          <div className="flex sm:hidden items-center gap-0.5">
            <TB icon={Dices} label="Dados" active={showDice} onClick={() => setShowDice(v => !v)} />
            <TB icon={MessageCircle} label="Chat" active={showChat} onClick={() => setShowChat(v => !v)} />
            <TB icon={Menu} label="Menu" active={showMobileMenu} onClick={() => setShowMobileMenu(v => !v)} />
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="sm:hidden absolute top-12 right-0 z-50 bg-card border border-border rounded-bl-xl shadow-2xl p-3 flex flex-col gap-1 min-w-[200px]"
            >
              {isDm && (
                <>
                  <MobileMenuItem icon={Image} label="Trocar Mapa" onClick={() => { setShowMapPicker(v => !v); setShowMobileMenu(false); }} active={showMapPicker} />
                  <MobileMenuItem icon={Plus} label="Monstros" onClick={() => { setShowMonsters(v => !v); setShowMobileMenu(false); }} active={showMonsters} />
                  <MobileMenuItem icon={CloudFog} label="Névoa de Guerra" onClick={() => toggleTool('fog')} active={showFog} />
                </>
              )}
              {!isDm && <MobileMenuItem icon={Plus} label="Meu Token" onClick={() => { addPlayerToken(); setShowMobileMenu(false); }} />}
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={Pencil} label="Desenhar" onClick={() => toggleTool('drawing')} active={showDrawing} />
              <MobileMenuItem icon={Ruler} label="Régua" onClick={() => toggleTool('ruler')} active={showRuler} />
              <MobileMenuItem icon={Grid3x3} label="Grade" onClick={() => { setShowGrid(v => !v); setShowMobileMenu(false); }} active={showGrid} />
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={ScrollText} label="Histórico" onClick={() => { setShowLog(v => !v); setShowMobileMenu(false); }} active={showLog} />
              <MobileMenuItem icon={Calculator} label="Calculadora" onClick={() => { setShowCalc(v => !v); setShowMobileMenu(false); }} active={showCalc} />
              {isDm ? (
                <MobileMenuItem icon={Users} label="Fichas dos Jogadores" onClick={() => { setShowPlayerSheets(v => !v); setShowMobileMenu(false); }} active={showPlayerSheets} />
              ) : (
                <>
                  <MobileMenuItem icon={ClipboardList} label="Minha Ficha" onClick={() => { if (player) { setCharSheetTarget({ playerId: player.id, playerName: player.name, readOnly: false }); setShowMobileMenu(false); } }} />
                  <MobileMenuItem icon={Users} label="Fichas dos Outros" onClick={() => { setShowPlayerSheets(v => !v); setShowMobileMenu(false); }} active={showPlayerSheets} />
                </>
              )}
              <MobileMenuItem icon={Settings} label="Perfil" onClick={() => { setShowProfile(true); setShowMobileMenu(false); }} />
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={LogOut} label="Sair" onClick={onLeave} className="text-destructive" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board Area */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={boardRef}
            className="w-full h-full relative select-none"
            onPointerMove={!showDrawing && !showRuler && !showFog ? handlePointerMove : undefined}
            onPointerUp={!showDrawing && !showRuler && !showFog ? handlePointerUp : undefined}
            onClick={() => { if (!draggingToken) setSelectedToken(null); setShowReactionPicker(null); }}
            style={{
              backgroundImage: session?.active_map_url ? `url(${session.active_map_url})` : undefined,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'hsl(220, 20%, 6%)',
              padding: '0 20px',
            }}
          >
            {!session?.active_map_url && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-display gap-2">
                <Image className="w-10 h-10 opacity-20" />
                <span className="text-sm">{isDm ? 'Selecione um mapa para começar' : 'Aguardando o mestre selecionar um mapa...'}</span>
              </div>
            )}

            {/* Grid overlay */}
            {showGrid && (
              <GridOverlay cellSize={gridSize} boardWidth={boardSize.w} boardHeight={boardSize.h} />
            )}

            {/* Fog of War */}
            {showFog && (
              <FogOfWar boardRef={boardRef} sessionId={sessionId} isDm={isDm} onClose={() => setShowFog(false)} />
            )}

            {/* Tokens */}
            {tokens.map(token => {
              const myReactions = tokenReactions.filter(r => r.tokenId === token.id);
              return (
                <div
                  key={token.id}
                  className={`absolute group ${!showDrawing && !showRuler && !showFog && canInteractToken(token) ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingToken === token.id ? 'z-50' : 'z-10'} ${selectedToken === token.id ? 'z-40' : ''}`}
                  style={{ left: token.x, top: token.y, width: token.width, height: token.height }}
                  onPointerDown={e => handlePointerDown(e, token)}
                  onClick={e => { e.stopPropagation(); if (canInteractToken(token)) setSelectedToken(token.id); }}
                >
                  <div className={`w-full h-full rounded-full overflow-hidden border-2 ${
                    token.token_type === 'player' ? 'border-gold glow-gold' : 'border-blood'
                  } shadow-lg transition-all ${selectedToken === token.id ? 'ring-2 ring-gold ring-offset-2 ring-offset-background' : ''}`}>
                    <img src={token.image_url} alt={token.label} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  </div>

                  {/* Token reactions */}
                  <AnimatePresence>
                    {myReactions.map(r => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, scale: 0, y: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -token.height - 8 }}
                        exit={{ opacity: 0, y: -token.height - 30 }}
                        className="absolute left-1/2 -translate-x-1/2 text-2xl pointer-events-none"
                        style={{ bottom: 0 }}
                      >
                        {r.emoji}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Token label */}
                  <div
                    className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-display bg-card/90 px-1.5 py-0.5 rounded text-foreground border border-border cursor-text"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (canInteractToken(token)) { setEditingLabel(token.id); setEditLabelValue(token.label); }
                    }}
                  >
                    {editingLabel === token.id ? (
                      <input
                        autoFocus
                        value={editLabelValue}
                        onChange={e => setEditLabelValue(e.target.value)}
                        onBlur={async () => {
                          if (editLabelValue.trim() && editLabelValue !== token.label)
                            await supabase.from('board_tokens').update({ label: editLabelValue.trim() }).eq('id', token.id);
                          setEditingLabel(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            if (editLabelValue.trim() && editLabelValue !== token.label)
                              await supabase.from('board_tokens').update({ label: editLabelValue.trim() }).eq('id', token.id);
                            setEditingLabel(null);
                          } else if (e.key === 'Escape') setEditingLabel(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        className="bg-transparent border-none outline-none text-xs text-foreground w-20 text-center"
                      />
                    ) : token.label}
                  </div>

                  {/* Controls: resize/delete/react */}
                  {selectedToken === token.id && canInteractToken(token) && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/95 border border-border rounded-lg px-1 py-0.5 shadow-lg z-50">
                      <button onClick={e => { e.stopPropagation(); resizeToken(token.id, -10); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Diminuir">
                        <ZoomOut className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <span className="text-[10px] text-muted-foreground w-6 text-center">{token.width}</span>
                      <button onClick={e => { e.stopPropagation(); resizeToken(token.id, 10); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Aumentar">
                        <ZoomIn className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === token.id ? null : token.id); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted" title="Reagir">
                        <Smile className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {isDm && (
                        <button onClick={e => { e.stopPropagation(); removeToken(token.id); }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/20 ml-0.5" title="Remover">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction picker */}
                  {showReactionPicker === token.id && (
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl p-1.5 flex gap-1 shadow-xl z-50"
                      onClick={e => e.stopPropagation()}>
                      {REACTIONS.map(emoji => (
                        <button key={emoji} onClick={() => sendReaction(token.id, emoji)}
                          className="text-lg hover:scale-125 transition-transform w-7 h-7 flex items-center justify-center rounded">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drawing Canvas */}
            {showDrawing && (
              <DrawingCanvas
                width={boardSize.w || boardRef.current?.clientWidth || 1920}
                height={boardSize.h || boardRef.current?.clientHeight || 1080}
                onClose={() => setShowDrawing(false)}
                sessionId={sessionId}
                playerId={player?.id ?? ''}
              />
            )}

            {/* Ruler */}
            {showRuler && (
              <MeasureRuler boardRef={boardRef} onClose={() => setShowRuler(false)} sessionId={sessionId} playerId={player?.id ?? ''} />
            )}
          </div>

          {/* Grid size control */}
          {showGrid && (
            <div className="absolute bottom-4 right-4 z-30 bg-card/90 border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
              <Grid3x3 className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-display text-muted-foreground">Grade:</span>
              <button onClick={() => setGridSize(v => Math.max(20, v - 10))} className="text-xs text-muted-foreground hover:text-foreground w-5">−</button>
              <span className="text-xs text-gold font-display w-8 text-center">{gridSize}px</span>
              <button onClick={() => setGridSize(v => Math.min(200, v + 10))} className="text-xs text-muted-foreground hover:text-foreground w-5">+</button>
              <button onClick={() => setShowGrid(false)} className="text-muted-foreground hover:text-foreground ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Map picker (DM) */}
          {showMapPicker && session && (
            <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold">Mapas Disponíveis</h3>
                <button onClick={() => setShowMapPicker(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
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

          {/* Monster picker (DM) */}
          {showMonsters && session && (
            <div className="absolute top-2 right-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-56">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold">Adicionar Monstro</h3>
                <button onClick={() => setShowMonsters(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-60 overflow-auto">
                {(session.monster_images || []).map((url, i) => (
                  <button key={i} onClick={() => addMonsterToken(url)}
                    className="w-12 h-12 rounded-full overflow-hidden border-2 border-border hover:border-blood transition-all">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player Sheets Panel (DM) */}
          {isDm && showPlayerSheets && (
            <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-72">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold flex items-center gap-2">
                  <Users className="w-4 h-4" /> Fichas dos Jogadores
                </h3>
                <button onClick={() => setShowPlayerSheets(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              {sessionPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground font-display text-center py-4">
                  Nenhum jogador na sessão ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sessionPlayers.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-display text-gold">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-display truncate">{p.name}</span>
                      <button
                        onClick={() => { setCharSheetTarget({ playerId: p.id, playerName: p.name, readOnly: false }); setShowPlayerSheets(false); }}
                        className="text-xs text-gold hover:text-gold/70 font-display border border-gold/30 rounded px-2 py-0.5 transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                  {/* DM can also open own sheet */}
                  {player && !sessionPlayers.find(p => p.id === player.id) && (
                    <button
                      onClick={() => { setCharSheetTarget({ playerId: player.id, playerName: player.name, readOnly: false }); setShowPlayerSheets(false); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground font-display py-1 text-center"
                    >
                      + Minha ficha (Mestre)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Player Sheet Viewer Panel (non-DM) — allows viewing other players' sheets */}
          {!isDm && showPlayerSheets && (
            <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold flex items-center gap-2">
                  <Users className="w-4 h-4" /> Outros Jogadores
                </h3>
                <button onClick={() => setShowPlayerSheets(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-1.5">
                {sessionPlayers.filter(p => p.id !== player?.id).map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="w-7 h-7 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-display text-gold">
                        {p.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-sm font-display truncate">{p.name}</span>
                    <button
                      onClick={() => { setCharSheetTarget({ playerId: p.id, playerName: p.name, readOnly: true }); setShowPlayerSheets(false); }}
                      className="text-xs text-muted-foreground hover:text-foreground font-display border border-border rounded px-2 py-0.5 transition-colors"
                    >
                      Ver
                    </button>
                  </div>
                ))}
                {sessionPlayers.filter(p => p.id !== player?.id).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum outro jogador na sessão.</p>
                )}
              </div>
            </div>
          )}

          {/* Dice Roller */}
          {showDice && (
            <div className="absolute bottom-4 left-2 sm:left-4 z-30 max-w-[calc(100vw-1rem)] sm:max-w-none">
              <DiceRoller sessionId={sessionId} onClose={() => setShowDice(false)} />
            </div>
          )}

          {/* Dice Log */}
          {showLog && (
            <div className="absolute top-0 right-0 h-full w-full sm:w-80 z-30">
              <DiceLog sessionId={sessionId} onClose={() => setShowLog(false)} />
            </div>
          )}

          {/* Chat Panel */}
          {showChat && (
            <div className="absolute top-0 right-0 h-full w-full sm:w-80 z-30" style={{ right: showLog ? '320px' : 0 }}>
              <ChatPanel sessionId={sessionId} onClose={() => setShowChat(false)} />
            </div>
          )}

          {/* Combat Calculator */}
          {showCalc && (
            <div className="absolute bottom-4 right-4 z-30 max-w-[calc(100vw-2rem)] sm:max-w-none">
              <CombatCalculator onClose={() => setShowCalc(false)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Mobile menu item helper
function MobileMenuItem({
  icon: Icon, label, onClick, active, className = '',
}: { icon: any; label: string; onClick: () => void; active?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-display transition-colors w-full text-left ${
        active ? 'bg-primary/10 text-primary' : `hover:bg-secondary text-foreground ${className}`
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

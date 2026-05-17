import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import DiceRoller from './DiceRoller';
import DiceLog from './DiceLog';
import DrawingCanvas from './DrawingCanvas';
import MeasureRuler from './MeasureRuler';
import GridOverlay from './GridOverlay';
import ChatPanel from './ChatPanel';
import CombatCalculator from './CombatCalculator';
import ProfileSettings from './ProfileSettings';
import InitiativeTracker from './InitiativeTracker';
import TokenHealthBar from './TokenHealthBar';
import CombatLogPanel from './CombatLogPanel';
import TokenConditions from './TokenConditions';
import ConditionIcons from './ConditionIcons';
import ConditionsSummaryPanel from './ConditionsSummaryPanel';
import PullPlayersModal from './PullPlayersModal';
import FogOfWar from './FogOfWar';
import TokenVisibilityControl from './TokenVisibilityControl';
import BestiaryManager from './BestiaryManager';
import EncounterBuilder from './EncounterBuilder';
import CharacterSheet from './CharacterSheet';
import CharacterSheetOP from './CharacterSheetOP';
import { Button } from '@/components/ui/button';
import {
  Image, Plus, Trash2, LogOut, Dices, ScrollText, Pencil, Ruler,
  ZoomIn, ZoomOut, Menu, X, Grid3x3, MessageCircle,
  Calculator, Settings, Smile, ClipboardList, Users, Swords, Activity, AlertCircle, Shield, UserPlus, Eye, BookOpen,
  Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Fixed virtual coordinate space. All tokens, drawings, ruler points and
// grid cells are stored and broadcast in this coordinate system, so every
// client sees identical positions regardless of their physical screen size.
const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;

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
  hp_current: number | null;
  hp_max: number | null;
  pe_current: number | null;
  pe_max: number | null;
  ps_current: number | null;
  ps_max: number | null;
  is_hidden: boolean;
  vision_radius: number;
  // Offset (-1..1) used as object-position percentage so users can reframe
  // the avatar inside the circular token without re-uploading the image.
  image_offset_x?: number;
  image_offset_y?: number;
}

interface Session {
  id: string;
  name: string;
  dm_id: string;
  active_map_url: string | null;
  maps: string[];
  monster_images: string[];
  show_grid: boolean;
  grid_size: number;
  system: string;
  fog_enabled: boolean;
  default_vision_radius: number;
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
  const [showChat, setShowChat] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showInitiative, setShowInitiative] = useState(false);
  const [showHealthBars, setShowHealthBars] = useState(true);
  const [showCombatLog, setShowCombatLog] = useState(false);
  const [showConditionsPanel, setShowConditionsPanel] = useState<string | null>(null);
  const [showConditionsSummary, setShowConditionsSummary] = useState(false);
  const [showPullPlayersModal, setShowPullPlayersModal] = useState(false);
  const [showBestiary, setShowBestiary] = useState(false);
  const [showEncounterBuilder, setShowEncounterBuilder] = useState(false);
  const [charSheetTarget, setCharSheetTarget] = useState<{ playerId: string; playerName: string; readOnly: boolean } | null>(null);
  const [showPlayerSheets, setShowPlayerSheets] = useState(false);
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null); // tokenId
  const [showImageAdjust, setShowImageAdjust] = useState<string | null>(null); // tokenId being reframed
  const [tokenReactions, setTokenReactions] = useState<TokenReaction[]>([]);
  const [tokenConditions, setTokenConditions] = useState<Record<string, any[]>>({});
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [uploadingMaps, setUploadingMaps] = useState(false);
  const [uploadingMonsters, setUploadingMonsters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const mapUploadInputRef = useRef<HTMLInputElement>(null);
  const monsterUploadInputRef = useRef<HTMLInputElement>(null);
  const reactionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isDm = role === 'dm';
  const showGrid = !!session?.show_grid;
  const gridSize = session?.grid_size ?? 50;
  const fogEnabled = !!session?.fog_enabled;

  // Compute the scale factor to fit the virtual board into the available area.
  // This guarantees every client renders the same logical board, just at a
  // different visual size.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / VIRTUAL_W, height / VIRTUAL_H));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Counter-scale factor for in-board UI overlays (labels, controls, health,
  // conditions). Full inverse-scale on mobile (~5x) made the UI overpowering
  // relative to the tiny map; instead we partially compensate so the UI
  // grows on smaller viewports but never balloons. Floor 1.6 keeps the
  // desktop sweet spot; ceiling 2.8 caps phones to ~2.5x natural size.
  const uiScale = scale > 0
    ? Math.max(1.6, Math.min(2.8, 1 / scale * 0.5))
    : 1.6;

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
    loadAllConditions();
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

    // Conditions channel
    const conditionsChannel = supabase
      .channel(`conditions-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_conditions', filter: `session_id=eq.${sessionId}` },
        () => loadAllConditions())
      .subscribe();

    reactionChannelRef.current = reactionChannel;

    return () => {
      supabase.removeChannel(tokenChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(reactionChannel);
      supabase.removeChannel(conditionsChannel);
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

  const loadAllConditions = async () => {
    const { data } = await supabase
      .from('token_conditions')
      .select('*')
      .eq('session_id', sessionId);
    
    if (data) {
      const grouped: Record<string, any[]> = {};
      data.forEach((condition: any) => {
        if (!grouped[condition.token_id]) grouped[condition.token_id] = [];
        grouped[condition.token_id].push(condition);
      });
      setTokenConditions(grouped);
    }
  };

  const setActiveMap = async (url: string) => {
    await supabase.from('sessions').update({ active_map_url: url }).eq('id', sessionId);
    setShowMapPicker(false);
  };

  const removeMap = async (url: string) => {
    if (!isDm || !session) return;
    if (!confirm('Excluir este mapa da sessão? Esta ação não pode ser desfeita.')) return;
    const nextMaps = (session.maps || []).filter(m => m !== url);
    const nextActiveMap = session.active_map_url === url
      ? (nextMaps[0] ?? null)
      : session.active_map_url;
    const { error } = await supabase
      .from('sessions')
      .update({ maps: nextMaps, active_map_url: nextActiveMap })
      .eq('id', sessionId);
    if (error) {
      toast.error('Erro ao excluir mapa');
      return;
    }
    setSession(prev => prev ? { ...prev, maps: nextMaps, active_map_url: nextActiveMap } : prev);
    // Best-effort: try to remove the file from storage. Ignore errors so the
    // DB stays consistent even if the object was already deleted.
    try {
      const match = url.match(/\/vtt-assets\/(.+)$/);
      if (match) await supabase.storage.from('vtt-assets').remove([match[1]]);
    } catch { /* noop */ }
    toast.success('Mapa removido');
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

  const uploadFiles = async (files: File[], folder: 'maps' | 'monsters') => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${folder}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('vtt-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('vtt-assets').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const addMapsToSession = async (files: FileList | null) => {
    if (!isDm || !session || !files || files.length === 0) return;
    setUploadingMaps(true);
    try {
      const uploadedUrls = await uploadFiles(Array.from(files), 'maps');
      const nextMaps = [...(session.maps || []), ...uploadedUrls];
      const nextActiveMap = session.active_map_url || uploadedUrls[0] || null;

      const { error } = await supabase
        .from('sessions')
        .update({ maps: nextMaps, active_map_url: nextActiveMap })
        .eq('id', sessionId);

      if (error) throw error;

      setSession(prev => prev ? { ...prev, maps: nextMaps, active_map_url: nextActiveMap } : prev);
      toast.success('Mapa(s) adicionado(s) à sessão');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar mapas');
    } finally {
      setUploadingMaps(false);
      if (mapUploadInputRef.current) mapUploadInputRef.current.value = '';
    }
  };

  const addMonstersToSession = async (files: FileList | null) => {
    if (!isDm || !session || !files || files.length === 0) return;
    setUploadingMonsters(true);
    try {
      const uploadedUrls = await uploadFiles(Array.from(files), 'monsters');
      const nextMonsters = [...(session.monster_images || []), ...uploadedUrls];

      const { error } = await supabase
        .from('sessions')
        .update({ monster_images: nextMonsters })
        .eq('id', sessionId);

      if (error) throw error;

      setSession(prev => prev ? { ...prev, monster_images: nextMonsters } : prev);
      toast.success('Monstro(s) adicionado(s) à sessão');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar monstros');
    } finally {
      setUploadingMonsters(false);
      if (monsterUploadInputRef.current) monsterUploadInputRef.current.value = '';
    }
  };

  const removeToken = async (tokenId: string) => {
    // Optimistic update — don't wait for the realtime DELETE event, which is
    // unreliable on tables without REPLICA IDENTITY FULL and breaks the trash
    // button until a refresh.
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    if (selectedToken === tokenId) setSelectedToken(null);
    const { error } = await supabase.from('board_tokens').delete().eq('id', tokenId);
    if (error) toast.error('Erro ao remover token');
  };

  // Convert a pointer event into virtual board coordinates.
  const getVirtualPos = useCallback((clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    const sx = VIRTUAL_W / rect.width;
    const sy = VIRTUAL_H / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }, []);

  const resizeToken = async (tokenId: string, delta: number) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const newSize = Math.max(20, Math.min(200, token.width + delta));
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, width: newSize, height: newSize } : t));
    await supabase.from('board_tokens').update({ width: newSize, height: newSize }).eq('id', tokenId);
  };

  // Reframe the avatar inside the circular token. dx/dy are in offset units
  // (-1..1) and shift the visible center of the image. Pass nulls to reset.
  const adjustTokenImage = async (tokenId: string, dx: number | null, dy: number | null) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const prevX = token.image_offset_x ?? 0;
    const prevY = token.image_offset_y ?? 0;
    const nextX = dx === null ? 0 : clamp(prevX + dx);
    const nextY = dy === null ? 0 : clamp(prevY + dy);
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, image_offset_x: nextX, image_offset_y: nextY } : t));
    const { error } = await supabase
      .from('board_tokens')
      .update({ image_offset_x: nextX, image_offset_y: nextY })
      .eq('id', tokenId);
    if (error) {
      // Most common cause: the 20260515000001_token_image_offset migration
      // hasn't been applied yet, so the columns don't exist. Revert locally
      // so the user isn't fooled into thinking it persisted.
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, image_offset_x: prevX, image_offset_y: prevY } : t));
      toast.error('Não foi possível salvar o ajuste. Aplique a migration mais recente do banco.');
    }
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, token: Token) => {
    if (showDrawing || showRuler) return;
    if (!isDm && token.owner_id !== player?.id) return;
    if (!isDm && token.token_type === 'monster') return;
    const pos = getVirtualPos(e.clientX, e.clientY);
    setDraggingToken(token.id);
    setSelectedToken(token.id);
    setDragOffset({ x: pos.x - token.x, y: pos.y - token.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDm, player, showDrawing, showRuler, getVirtualPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingToken) return;
    const token = tokens.find(t => t.id === draggingToken);
    const size = token?.width || 50;
    const pos = getVirtualPos(e.clientX, e.clientY);
    const x = Math.max(0, Math.min(VIRTUAL_W - size, pos.x - dragOffset.x));
    const y = Math.max(0, Math.min(VIRTUAL_H - size, pos.y - dragOffset.y));
    setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x, y } : t));
  }, [draggingToken, dragOffset, tokens, getVirtualPos]);

  const handlePointerUp = useCallback(async () => {
    if (!draggingToken) return;
    const token = tokens.find(t => t.id === draggingToken);
    if (token) await supabase.from('board_tokens').update({ x: token.x, y: token.y }).eq('id', token.id);
    setDraggingToken(null);
  }, [draggingToken, tokens]);

  const canInteractToken = (token: Token) => isDm || token.owner_id === player?.id;

  const toggleTool = (tool: 'drawing' | 'ruler') => {
    setShowDrawing(tool === 'drawing' ? (v => !v) : false);
    setShowRuler(tool === 'ruler' ? (v => !v) : false);
    setShowMobileMenu(false);
  };

  // Grid is owned by the DM and synced to all players via the session row.
  const toggleGrid = async () => {
    if (!isDm || !session) return;
    await supabase.from('sessions').update({ show_grid: !session.show_grid }).eq('id', sessionId);
    setShowMobileMenu(false);
  };

  const toggleFog = async () => {
    if (!isDm || !session) return;
    await supabase.from('sessions').update({ fog_enabled: !session.fog_enabled }).eq('id', sessionId);
    setShowMobileMenu(false);
  };

  const updateGridSize = async (next: number) => {
    if (!isDm || !session) return;
    const clamped = Math.max(20, Math.min(200, next));
    await supabase.from('sessions').update({ grid_size: clamped }).eq('id', sessionId);
  };

  // Allow renaming a token (used by the DM, including for monsters).
  const startEditingLabel = (token: Token) => {
    if (!canInteractToken(token)) return;
    setEditingLabel(token.id);
    setEditLabelValue(token.label);
  };

  // Toolbar button helper — larger on mobile for usable tap targets
  const TB = ({ icon: Icon, label, active, onClick, className = '' }: { icon: any; label: string; active?: boolean; onClick: () => void; className?: string }) => (
    <Button variant={active ? 'default' : 'ghost'} size="sm" onClick={onClick} title={label}
      className={`h-10 w-10 sm:h-9 sm:w-9 p-0 ${active ? 'bg-primary text-primary-foreground' : ''} ${className}`}>
      <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
    </Button>
  );

  return (
    <>
      {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}
      {showPullPlayersModal && player && (
        <PullPlayersModal
          sessionId={sessionId}
          dmId={player.id}
          onClose={() => setShowPullPlayersModal(false)}
          onSuccess={() => loadAllConditions()}
        />
      )}
      {showBestiary && player && (
        <BestiaryManager
          dmId={player.id}
          system={session?.system || 'dnd5e'}
          onClose={() => setShowBestiary(false)}
        />
      )}
      {showEncounterBuilder && player && (
        <EncounterBuilder
          dmId={player.id}
          sessionId={sessionId}
          system={session?.system || 'dnd5e'}
          onClose={() => setShowEncounterBuilder(false)}
        />
      )}
      {charSheetTarget && (
        session?.system === 'ordem_paranormal' ? (
          <CharacterSheetOP
            sessionId={sessionId}
            onClose={() => setCharSheetTarget(null)}
            targetPlayerId={charSheetTarget.playerId}
            targetPlayerName={charSheetTarget.playerName}
            readOnly={charSheetTarget.readOnly}
          />
        ) : (
          <CharacterSheet
            sessionId={sessionId}
            onClose={() => setCharSheetTarget(null)}
            targetPlayerId={charSheetTarget.playerId}
            targetPlayerName={charSheetTarget.playerName}
            readOnly={charSheetTarget.readOnly}
          />
        )
      )}

      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Top bar */}
        <div className="h-14 sm:h-12 bg-card border-b border-border flex items-center px-2 sm:px-3 gap-1 shrink-0 z-20">
          <span className="font-display text-gold text-sm sm:text-sm tracking-wider truncate max-w-[110px] sm:max-w-none">
            {session?.name || '...'}
          </span>
          <div className="flex-1" />

          {/* Desktop toolbar */}
          <div className="hidden sm:flex items-center gap-0.5">
            {isDm && (
              <>
                <TB icon={Image} label="Trocar Mapa" active={showMapPicker} onClick={() => { setShowMapPicker(v => !v); setShowMobileMenu(false); }} />
                <TB icon={Plus} label="Monstros" active={showMonsters} onClick={() => { setShowMonsters(v => !v); setShowMobileMenu(false); }} />
                <TB icon={UserPlus} label="Puxar Jogadores" onClick={() => setShowPullPlayersModal(true)} />
                <TB icon={Swords} label="Encontros" active={showEncounterBuilder} onClick={() => setShowEncounterBuilder(v => !v)} />
              </>
            )}
            {!isDm && (
              <Button variant="ghost" size="sm" onClick={addPlayerToken} className="h-9 text-sm px-2">
                <Plus className="w-4 h-4 mr-1" /> Token
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            <TB icon={Pencil} label="Desenhar" active={showDrawing} onClick={() => toggleTool('drawing')} />
            <TB icon={Ruler} label="Régua" active={showRuler} onClick={() => toggleTool('ruler')} />
            {isDm && <TB icon={Grid3x3} label="Grade" active={showGrid} onClick={toggleGrid} />}
            {isDm && <TB icon={Eye} label="Fog of War" active={fogEnabled} onClick={toggleFog} />}

            <div className="w-px h-5 bg-border mx-1" />

            <TB icon={Dices} label="Dados" active={showDice} onClick={() => setShowDice(v => !v)} />
            <TB icon={ScrollText} label="Histórico" active={showLog} onClick={() => setShowLog(v => !v)} />
            <TB icon={MessageCircle} label="Chat" active={showChat} onClick={() => setShowChat(v => !v)} />
            <TB icon={Calculator} label="Calculadora" active={showCalc} onClick={() => setShowCalc(v => !v)} />
            <TB icon={Swords} label="Iniciativa" active={showInitiative} onClick={() => setShowInitiative(v => !v)} />
            <TB icon={Activity} label="Log de Combate" active={showCombatLog} onClick={() => setShowCombatLog(v => !v)} />
            <TB icon={AlertCircle} label="Condições Ativas" active={showConditionsSummary} onClick={() => setShowConditionsSummary(v => !v)} />
            {isDm && <TB icon={BookOpen} label="Bestiário" active={showBestiary} onClick={() => setShowBestiary(v => !v)} />}

            <div className="w-px h-5 bg-border mx-1" />

            {isDm ? (
              <TB icon={Users} label="Fichas dos Jogadores" active={showPlayerSheets} onClick={() => setShowPlayerSheets(v => !v)} />
            ) : (
              <>
                <TB icon={ClipboardList} label="Minha Ficha" onClick={() => player && setCharSheetTarget({ playerId: player.id, playerName: player.name, readOnly: false })} />
                <TB icon={Users} label="Jogadores na Sessão" active={showPlayerSheets} onClick={() => setShowPlayerSheets(v => !v)} />
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
              className="sm:hidden absolute top-14 right-0 z-50 bg-card border border-border rounded-bl-xl shadow-2xl p-3 flex flex-col gap-1.5 min-w-[230px]"
            >
              {isDm && (
                <>
                  <MobileMenuItem icon={Image} label="Trocar Mapa" onClick={() => { setShowMapPicker(v => !v); setShowMobileMenu(false); }} active={showMapPicker} />
                  <MobileMenuItem icon={Plus} label="Monstros" onClick={() => { setShowMonsters(v => !v); setShowMobileMenu(false); }} active={showMonsters} />
                  <MobileMenuItem icon={UserPlus} label="Puxar Jogadores" onClick={() => { setShowPullPlayersModal(true); setShowMobileMenu(false); }} />
                  <MobileMenuItem icon={Swords} label="Encontros" onClick={() => { setShowEncounterBuilder(v => !v); setShowMobileMenu(false); }} active={showEncounterBuilder} />
                </>
              )}
              {!isDm && <MobileMenuItem icon={Plus} label="Meu Token" onClick={() => { addPlayerToken(); setShowMobileMenu(false); }} />}
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={Pencil} label="Desenhar" onClick={() => toggleTool('drawing')} active={showDrawing} />
              <MobileMenuItem icon={Ruler} label="Régua" onClick={() => toggleTool('ruler')} active={showRuler} />
              {isDm && <MobileMenuItem icon={Grid3x3} label="Grade" onClick={toggleGrid} active={showGrid} />}
              {isDm && <MobileMenuItem icon={Eye} label="Fog of War" onClick={toggleFog} active={fogEnabled} />}
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={ScrollText} label="Histórico" onClick={() => { setShowLog(v => !v); setShowMobileMenu(false); }} active={showLog} />
              <MobileMenuItem icon={Calculator} label="Calculadora" onClick={() => { setShowCalc(v => !v); setShowMobileMenu(false); }} active={showCalc} />
              <MobileMenuItem icon={Swords} label="Iniciativa" onClick={() => { setShowInitiative(v => !v); setShowMobileMenu(false); }} active={showInitiative} />
              <MobileMenuItem icon={Activity} label="Log de Combate" onClick={() => { setShowCombatLog(v => !v); setShowMobileMenu(false); }} active={showCombatLog} />
              <MobileMenuItem icon={AlertCircle} label="Condições Ativas" onClick={() => { setShowConditionsSummary(v => !v); setShowMobileMenu(false); }} active={showConditionsSummary} />
              {isDm && <MobileMenuItem icon={BookOpen} label="Bestiário" onClick={() => { setShowBestiary(v => !v); setShowMobileMenu(false); }} active={showBestiary} />}
              {isDm ? (
                <MobileMenuItem icon={Users} label="Fichas dos Jogadores" onClick={() => { setShowPlayerSheets(v => !v); setShowMobileMenu(false); }} active={showPlayerSheets} />
              ) : (
                <>
                  <MobileMenuItem icon={ClipboardList} label="Minha Ficha" onClick={() => { if (player) { setCharSheetTarget({ playerId: player.id, playerName: player.name, readOnly: false }); setShowMobileMenu(false); } }} />
                  <MobileMenuItem icon={Users} label="Jogadores na Sessão" onClick={() => { setShowPlayerSheets(v => !v); setShowMobileMenu(false); }} active={showPlayerSheets} />
                </>
              )}
              <MobileMenuItem icon={Settings} label="Perfil" onClick={() => { setShowProfile(true); setShowMobileMenu(false); }} />
              <div className="h-px bg-border my-1" />
              <MobileMenuItem icon={LogOut} label="Sair" onClick={onLeave} className="text-destructive" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board Area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{ backgroundColor: 'hsl(220, 20%, 6%)' }}
        >
          {/* Inner virtual board: fixed VIRTUAL_W x VIRTUAL_H, scaled to fit */}
          <div
            ref={boardRef}
            className="absolute select-none"
            style={{
              width: VIRTUAL_W,
              height: VIRTUAL_H,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: 'center center',
              backgroundColor: 'hsl(220, 25%, 4%)',
            }}
            onPointerMove={!showDrawing && !showRuler ? handlePointerMove : undefined}
            onPointerUp={!showDrawing && !showRuler ? handlePointerUp : undefined}
            onClick={() => { if (!draggingToken) setSelectedToken(null); setShowReactionPicker(null); setShowImageAdjust(null); }}
          >
            {/* Background map (rendered as <img> so it lives in virtual space) */}
            {session?.active_map_url && (
              <img
                src={session.active_map_url}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            )}

            {!session?.active_map_url && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-display gap-2">
                <Image className="w-10 h-10 opacity-20" />
                <span className="text-sm">{isDm ? 'Selecione um mapa para começar' : 'Aguardando o mestre selecionar um mapa...'}</span>
              </div>
            )}

            {/* Grid overlay (DM-controlled, synced via session row) */}
            {showGrid && (
              <GridOverlay cellSize={gridSize} boardWidth={VIRTUAL_W} boardHeight={VIRTUAL_H} />
            )}

            {/* Drawings layer — always mounted so every client sees every stroke */}
            <DrawingCanvas
              virtualWidth={VIRTUAL_W}
              virtualHeight={VIRTUAL_H}
              active={showDrawing}
              onClose={() => setShowDrawing(false)}
              sessionId={sessionId}
              playerId={player?.id ?? ''}
              uiScale={uiScale}
            />

            {/* Fog of War */}
            <FogOfWar
              sessionId={sessionId}
              playerId={player?.id ?? ''}
              isDm={isDm}
              tokens={tokens.map(t => ({
                id: t.id,
                x: t.x,
                y: t.y,
                width: t.width,
                height: t.height,
                owner_id: t.owner_id,
                token_type: t.token_type,
                is_hidden: t.is_hidden ?? false,
              }))}
              virtualWidth={VIRTUAL_W}
              virtualHeight={VIRTUAL_H}
              enabled={fogEnabled}
            />

            {/* Tokens */}
            {tokens.map(token => {
              const myReactions = tokenReactions.filter(r => r.tokenId === token.id);
              const myConditions = tokenConditions[token.id] || [];
              const hasHealth = token.hp_max && token.hp_max > 0;
              const isVisible = isDm || !token.is_hidden; // Simplificado - fog controla visibilidade
              
              if (!isVisible) return null;
              
              return (
                <div
                  key={token.id}
                  className={`absolute group ${!showDrawing && !showRuler && canInteractToken(token) ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingToken === token.id ? 'z-50' : 'z-10'} ${selectedToken === token.id ? 'z-40' : ''}`}
                  style={{ left: token.x, top: token.y, width: token.width, height: token.height }}
                  onPointerDown={e => handlePointerDown(e, token)}
                  onClick={e => { e.stopPropagation(); if (canInteractToken(token)) setSelectedToken(token.id); }}
                >
                  {/* Condition icons */}
                  <ConditionIcons
                    conditions={myConditions}
                    onClick={() => setShowConditionsPanel(showConditionsPanel === token.id ? null : token.id)}
                    uiScale={uiScale}
                  />

                  {/* Conditions panel */}
                  {showConditionsPanel === token.id && (
                    <TokenConditions
                      tokenId={token.id}
                      sessionId={sessionId}
                      canEdit={isDm || token.owner_id === player?.id}
                      showPanel={true}
                      onClose={() => setShowConditionsPanel(null)}
                      uiScale={uiScale}
                    />
                  )}
                  {/* Health bars */}
                  {showHealthBars && hasHealth && (
                    <TokenHealthBar
                      tokenId={token.id}
                      sessionId={sessionId}
                      playerId={player?.id || ''}
                      playerName={player?.name || 'Desconhecido'}
                      hp_current={token.hp_current || 0}
                      hp_max={token.hp_max || 0}
                      pe_current={token.pe_current || undefined}
                      pe_max={token.pe_max || undefined}
                      ps_current={token.ps_current || undefined}
                      ps_max={token.ps_max || undefined}
                      system={session?.system || 'dnd5e'}
                      onUpdate={async (hp, pe, ps) => {
                        await supabase.from('board_tokens').update({
                          hp_current: hp,
                          pe_current: pe,
                          ps_current: ps
                        }).eq('id', token.id);
                      }}
                      canEdit={isDm || token.owner_id === player?.id}
                      showControls={selectedToken === token.id}
                      uiScale={uiScale}
                    />
                  )}
                  <div className={`w-full h-full rounded-full overflow-hidden border-2 ${
                    token.token_type === 'player' ? 'border-gold glow-gold' : 'border-blood'
                  } shadow-lg transition-all ${selectedToken === token.id ? 'ring-2 ring-gold ring-offset-2 ring-offset-background' : ''}`}>
                    <img
                      src={token.image_url}
                      alt={token.label}
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        objectPosition: `${50 + (token.image_offset_x ?? 0) * 50}% ${50 + (token.image_offset_y ?? 0) * 50}%`,
                      }}
                      draggable={false}
                    />
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
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div
                      style={{ transform: `scale(${uiScale})`, transformOrigin: 'center top' }}
                      className="pointer-events-auto"
                    >
                      <div
                        className="whitespace-nowrap text-sm font-display bg-card/90 px-1.5 py-0.5 rounded text-foreground border border-border cursor-text"
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
                            className="bg-transparent border-none outline-none text-sm text-foreground w-20 text-center"
                          />
                        ) : token.label}
                      </div>
                    </div>
                  </div>

                  {/* Controls: resize/rename/react/conditions/visibility/delete */}
                  {selectedToken === token.id && canInteractToken(token) && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                      <div
                        style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}
                        className="pointer-events-auto"
                      >
                        <div className="flex items-center gap-1 bg-card/95 border border-border rounded-lg px-1 py-0.5 shadow-lg">
                          <button onClick={e => { e.stopPropagation(); resizeToken(token.id, -10); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Diminuir">
                            <ZoomOut className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <span className="text-xs text-muted-foreground w-7 text-center">{token.width}</span>
                          <button onClick={e => { e.stopPropagation(); resizeToken(token.id, 10); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Aumentar">
                            <ZoomIn className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); startEditingLabel(token); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Renomear">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); setShowImageAdjust(showImageAdjust === token.id ? null : token.id); setShowReactionPicker(null); setShowConditionsPanel(null); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Ajustar imagem">
                            <Move className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); setShowConditionsPanel(showConditionsPanel === token.id ? null : token.id); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Condições">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isDm && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await supabase.from('board_tokens').update({ is_hidden: !token.is_hidden }).eq('id', token.id);
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                              title={token.is_hidden ? 'Revelar' : 'Ocultar'}
                            >
                              <Eye className={`w-4 h-4 ${token.is_hidden ? 'text-destructive' : 'text-muted-foreground'}`} />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === token.id ? null : token.id); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted" title="Reagir">
                            <Smile className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isDm && (
                            <button onClick={e => { e.stopPropagation(); removeToken(token.id); }}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 ml-0.5" title="Remover">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reaction picker */}
                  {showReactionPicker === token.id && (
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                      <div
                        style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}
                        className="pointer-events-auto"
                      >
                        <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1 shadow-xl"
                          onClick={e => e.stopPropagation()}>
                          {REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => sendReaction(token.id, emoji)}
                              className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image position adjuster — D-pad style controls.
                      pointerDown is stopped here so clicking an arrow doesn't
                      start a token drag, whose pointerUp would push a stale
                      row back through realtime and undo our offset update. */}
                  {showImageAdjust === token.id && selectedToken === token.id && canInteractToken(token) && (
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                      <div
                        style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}
                        className="pointer-events-auto"
                      >
                        <div
                          className="bg-card border border-border rounded-xl p-2 shadow-xl flex flex-col items-center gap-1"
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                        >
                          <div className="text-[10px] text-muted-foreground font-display mb-0.5">Ajustar imagem</div>
                          <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={() => adjustTokenImage(token.id, 0, -0.1)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                            title="Subir"
                          >
                            <ArrowUp className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => adjustTokenImage(token.id, -0.1, 0)}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                              title="Esquerda"
                            >
                              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => adjustTokenImage(token.id, null, null)}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                              title="Centralizar"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => adjustTokenImage(token.id, 0.1, 0)}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                              title="Direita"
                            >
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                          <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={() => adjustTokenImage(token.id, 0, 0.1)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted"
                            title="Descer"
                          >
                            <ArrowDown className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ruler */}
            {showRuler && (
              <MeasureRuler
                boardRef={boardRef}
                virtualWidth={VIRTUAL_W}
                virtualHeight={VIRTUAL_H}
                gridCellSize={gridSize}
                onClose={() => setShowRuler(false)}
                sessionId={sessionId}
                playerId={player?.id ?? ''}
                uiScale={uiScale}
              />
            )}
          </div>

          {/* Grid size control (DM only) */}
          {showGrid && isDm && (
            <div className="absolute bottom-4 right-4 z-30 bg-card/90 border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
              <Grid3x3 className="w-4 h-4 text-gold" />
              <span className="text-sm font-display text-muted-foreground">Grade:</span>
              <button onClick={() => updateGridSize(gridSize - 10)} className="text-base text-muted-foreground hover:text-foreground w-6">−</button>
              <span className="text-sm text-gold font-display w-10 text-center">{gridSize}px</span>
              <button onClick={() => updateGridSize(gridSize + 10)} className="text-base text-muted-foreground hover:text-foreground w-6">+</button>
              <button onClick={toggleGrid} className="text-muted-foreground hover:text-foreground ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Map picker (DM) */}
          {showMapPicker && session && (
            <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold">Mapas Disponíveis</h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => mapUploadInputRef.current?.click()}
                    disabled={uploadingMaps}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {uploadingMaps ? 'Enviando...' : 'Adicionar'}
                  </Button>
                  <button onClick={() => setShowMapPicker(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
              </div>
              <input
                ref={mapUploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addMapsToSession(e.target.files)}
              />
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-auto">
                {(session.maps || []).map((url, i) => (
                  <div
                    key={i}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all group ${session.active_map_url === url ? 'border-gold' : 'border-border hover:border-gold/50'}`}
                  >
                    <button
                      onClick={() => setActiveMap(url)}
                      className="block w-full"
                      title="Usar este mapa"
                    >
                      <img src={url} alt="" className="w-full h-16 object-cover" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMap(url); }}
                      className="absolute top-1 right-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
                      title="Excluir mapa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {(session.maps || []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Nenhum mapa ainda. Use Adicionar para enviar.</p>
              )}
            </div>
          )}

          {/* Monster picker (DM) */}
          {showMonsters && session && (
            <div className="absolute top-2 right-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-56">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold">Adicionar Monstro</h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => monsterUploadInputRef.current?.click()}
                    disabled={uploadingMonsters}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {uploadingMonsters ? 'Enviando...' : 'Adicionar'}
                  </Button>
                  <button onClick={() => setShowMonsters(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
              </div>
              <input
                ref={monsterUploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addMonstersToSession(e.target.files)}
              />
              <div className="grid grid-cols-4 gap-2 max-h-60 overflow-auto">
                {(session.monster_images || []).map((url, i) => (
                  <button key={i} onClick={() => addMonsterToken(url)}
                    className="w-12 h-12 rounded-full overflow-hidden border-2 border-border hover:border-blood transition-all">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              {(session.monster_images || []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Nenhum monstro ainda. Use Adicionar para enviar.</p>
              )}
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

          {/* Player roster (non-DM) — players see only names; sheets are private */}
          {!isDm && showPlayerSheets && (
            <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-4 z-30 shadow-2xl w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm text-gold flex items-center gap-2">
                  <Users className="w-4 h-4" /> Jogadores na Sessão
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
                  </div>
                ))}
                {sessionPlayers.filter(p => p.id !== player?.id).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum outro jogador na sessão.</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-3 italic">
                Apenas o mestre pode visualizar as fichas dos outros jogadores.
              </p>
            </div>
          )}

          {/* Dice Roller */}
          {showDice && (
            <div className="absolute bottom-4 left-2 sm:left-4 z-30 max-w-[calc(100vw-1rem)] sm:max-w-none">
              <DiceRoller sessionId={sessionId} sessionSystem={session?.system} onClose={() => setShowDice(false)} />
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

          {/* Initiative Tracker */}
          {showInitiative && (
            <div className="absolute top-14 right-4 z-30">
              <InitiativeTracker
                sessionId={sessionId}
                isDm={isDm}
                tokens={tokens.map(t => ({ id: t.id, label: t.label }))}
                onClose={() => setShowInitiative(false)}
              />
            </div>
          )}

          {/* Combat Log */}
          {showCombatLog && (
            <div className="absolute top-14 left-4 z-30">
              <CombatLogPanel
                sessionId={sessionId}
                onClose={() => setShowCombatLog(false)}
              />
            </div>
          )}

          {/* Conditions Summary */}
          {showConditionsSummary && (
            <div className="absolute bottom-4 left-4 z-30">
              <ConditionsSummaryPanel
                sessionId={sessionId}
                onClose={() => setShowConditionsSummary(false)}
              />
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-display transition-colors w-full text-left ${
        active ? 'bg-primary/10 text-primary' : `hover:bg-secondary text-foreground ${className}`
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

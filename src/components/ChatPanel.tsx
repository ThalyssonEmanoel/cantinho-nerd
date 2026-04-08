import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { X, MessageCircle, Send, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  player_id: string;
  player_name: string;
  player_avatar: string | null;
  content: string;
  is_whisper: boolean;
  whisper_to_player_id: string | null;
  whisper_to_name: string | null;
  created_at: string;
}

interface Participant {
  player_id: string;
  player_name: string;
}

interface ChatPanelProps {
  sessionId: string;
  onClose: () => void;
}

export default function ChatPanel({ sessionId, onClose }: ChatPanelProps) {
  const { player, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [whisperTo, setWhisperTo] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showWhisperPicker, setShowWhisperPicker] = useState(false);
  const [dbError, setDbError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDm = role === 'dm';

  useEffect(() => {
    loadMessages();
    loadParticipants();

    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        // Show: own messages, public messages, whispers addressed to you, DM sees all
        const isVisible =
          msg.player_id === player?.id ||
          !msg.is_whisper ||
          msg.whisper_to_player_id === player?.id ||
          isDm;
        if (isVisible) {
          setMessages(prev => [...prev, msg].slice(-100));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, player?.id, isDm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('session_messages' as any)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      setDbError(true);
      return;
    }

    const all = (data as unknown as ChatMessage[]) || [];
    const visible = all.filter(msg =>
      msg.player_id === player?.id ||
      !msg.is_whisper ||
      msg.whisper_to_player_id === player?.id ||
      isDm
    );
    setMessages(visible);
  };

  const loadParticipants = async () => {
    const { data } = await supabase
      .from('session_participants')
      .select('player_id, players(name)')
      .eq('session_id', sessionId)
      .neq('player_id', player?.id ?? '');

    if (data) {
      setParticipants(
        (data as any[]).map(p => ({
          player_id: p.player_id,
          player_name: p.players?.name ?? 'Desconhecido',
        }))
      );
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !player) return;

    const { error } = await supabase.from('session_messages' as any).insert({
      session_id: sessionId,
      player_id: player.id,
      player_name: player.name,
      player_avatar: player.avatar_url,
      content: input.trim(),
      is_whisper: !!whisperTo,
      whisper_to_player_id: whisperTo?.player_id ?? null,
      whisper_to_name: whisperTo?.player_name ?? null,
    });

    if (!error) {
      setInput('');
      setWhisperTo(null);
    }
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full bg-card/95 backdrop-blur-sm border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="font-display text-gold text-sm flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Chat da Sessão
        </h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {dbError ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div>
            <p className="text-destructive font-display text-sm mb-1">Tabela de chat não encontrada</p>
            <p className="text-muted-foreground text-xs">Execute a migração SQL para habilitar o chat.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            <AnimatePresence initial={false}>
              {messages.map(msg => {
                const isOwn = msg.player_id === player?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}
                  >
                    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {msg.player_avatar && (
                        <img src={msg.player_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                      )}
                      <span className="font-display">{msg.player_name}</span>
                      <span>{formatTime(msg.created_at)}</span>
                      {msg.is_whisper && (
                        <span className="text-arcane flex items-center gap-0.5">
                          <EyeOff className="w-3 h-3" />
                          {msg.whisper_to_name ? `→ ${msg.whisper_to_name}` : ''}
                        </span>
                      )}
                    </div>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm ${
                      msg.is_whisper
                        ? 'bg-arcane/20 border border-arcane/30 text-arcane italic'
                        : isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary text-foreground rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8">
                Nenhuma mensagem ainda...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Whisper indicator */}
          {whisperTo && (
            <div className="px-3 py-1.5 bg-arcane/10 border-t border-arcane/20 flex items-center gap-2 text-xs text-arcane">
              <EyeOff className="w-3 h-3" />
              <span>Sussurrando para <strong>{whisperTo.player_name}</strong></span>
              <button onClick={() => setWhisperTo(null)} className="ml-auto hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Whisper picker */}
          {showWhisperPicker && (
            <div className="border-t border-border bg-secondary p-2 space-y-1 max-h-32 overflow-auto">
              <p className="text-xs text-muted-foreground px-1 font-display">Sussurrar para:</p>
              {participants.map(p => (
                <button
                  key={p.player_id}
                  onClick={() => { setWhisperTo(p); setShowWhisperPicker(false); }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-muted text-sm text-foreground"
                >
                  {p.player_name}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-9 w-9 p-0 shrink-0 ${whisperTo || showWhisperPicker ? 'text-arcane' : 'text-muted-foreground'}`}
              onClick={() => setShowWhisperPicker(v => !v)}
              title="Sussurrar"
            >
              <EyeOff className="w-4 h-4" />
            </Button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={whisperTo ? `Sussurrar...` : 'Mensagem...'}
              className="h-9 bg-secondary text-sm"
            />
            <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={sendMessage} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

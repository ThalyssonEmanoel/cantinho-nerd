import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface JoinSessionProps {
  sessionId: string;
  onJoin: (sessionId: string) => void;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isSha256Hash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export default function JoinSession({ sessionId, onJoin }: JoinSessionProps) {
  const { player } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!password.trim() || !player) return;
    setLoading(true);

    try {
      const { data: session, error: fetchErr } = await supabase
        .from('sessions')
        .select('id, password')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!session) {
        toast.error('Sessão não encontrada');
        setLoading(false);
        return;
      }

      const trimmedPassword = password.trim();
      const inputToCompare = isSha256Hash(session.password)
        ? await sha256(trimmedPassword)
        : trimmedPassword;

      if (session.password !== inputToCompare) {
        toast.error('Senha incorreta');
        setLoading(false);
        return;
      }

      await supabase.from('session_participants').upsert({
        session_id: sessionId,
        player_id: player.id,
        role: 'player',
      }, { onConflict: 'session_id,player_id' });

      onJoin(sessionId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient p-4">
      <div className="bg-card-gradient border border-border rounded-xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-gold" />
        </div>
        <h2 className="text-2xl font-display text-foreground mb-2">Entrar na Sessão</h2>
        <p className="text-muted-foreground mb-6 text-sm">Insira a senha do mestre</p>

        <div className="space-y-4">
          <div className="text-left">
            <Label className="font-display text-sm">Senha da Sessão</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              className="mt-1 bg-secondary"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <Button className="w-full font-display" onClick={handleJoin} disabled={loading}>
            <ArrowRight className="w-4 h-4 mr-2" />
            {loading ? 'Entrando...' : 'Adentrar o Reino'}
          </Button>
        </div>
      </div>
    </div>
  );
}

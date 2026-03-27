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

export default function JoinSession({ sessionId, onJoin }: JoinSessionProps) {
  const { player } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!password.trim() || !player) return;
    setLoading(true);

    try {
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('password', password.trim())
        .maybeSingle();

      if (error) throw error;
      if (!session) {
        toast.error('Senha incorreta');
        setLoading(false);
        return;
      }

      // Join as participant
      await supabase.from('session_participants').upsert({
        session_id: sessionId,
        player_id: player.id,
        role: 'player',
      });

      onJoin(sessionId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient">
      <div className="bg-card-gradient border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        <KeyRound className="w-12 h-12 text-gold mx-auto mb-4" />
        <h2 className="text-2xl font-display text-foreground mb-2">Entrar na Sessão</h2>
        <p className="text-muted-foreground mb-6">Insira a senha do mestre</p>

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
            <ArrowRight className="w-4 h-4 mr-2" /> {loading ? 'Entrando...' : 'Adentrar o Reino'}
          </Button>
        </div>
      </div>
    </div>
  );
}

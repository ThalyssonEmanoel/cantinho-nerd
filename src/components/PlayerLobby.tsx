import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sword, LogOut, ArrowRight } from 'lucide-react';

interface PlayerLobbyProps {
  onJoinSession: (sessionId: string) => void;
}

export default function PlayerLobby({ onJoinSession }: PlayerLobbyProps) {
  const { setRole } = useAuth();
  const [sessionLink, setSessionLink] = useState('');

  const extractSessionId = () => {
    // Try to extract UUID from pasted link or direct ID
    const match = sessionLink.match(/join\/([a-f0-9-]{36})/i) || sessionLink.match(/^([a-f0-9-]{36})$/i);
    if (match) {
      onJoinSession(match[1]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient">
      <div className="bg-card-gradient border border-border rounded-xl p-8 max-w-md w-full mx-4 text-center">
        <Sword className="w-12 h-12 text-arcane mx-auto mb-4" />
        <h2 className="text-2xl font-display text-foreground mb-2">Entrar em uma Sessão</h2>
        <p className="text-muted-foreground mb-6">Cole o link ou ID da sessão do mestre</p>

        <div className="space-y-4">
          <div className="text-left">
            <Label className="font-display text-sm">Link ou ID da Sessão</Label>
            <Input
              value={sessionLink}
              onChange={e => setSessionLink(e.target.value)}
              placeholder="Cole o link aqui..."
              className="mt-1 bg-secondary"
              onKeyDown={e => e.key === 'Enter' && extractSessionId()}
            />
          </div>
          <Button className="w-full font-display" onClick={extractSessionId}>
            <ArrowRight className="w-4 h-4 mr-2" /> Encontrar Sessão
          </Button>
        </div>

        <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={() => setRole(null)}>
          <LogOut className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    </div>
  );
}

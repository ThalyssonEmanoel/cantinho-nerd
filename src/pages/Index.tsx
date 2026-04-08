import { useState } from 'react';
import { useAuth, AuthProvider } from '@/lib/auth-context';
import LoginScreen from '@/components/LoginScreen';
import RoleSelection from '@/components/RoleSelection';
import DmLobby from '@/components/DmLobby';
import PlayerLobby from '@/components/PlayerLobby';
import JoinSession from '@/components/JoinSession';
import GameBoard from '@/components/GameBoard';

function AppContent() {
  const { player, role } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  if (!player) return <LoginScreen />;
  if (!role) return <RoleSelection />;

  if (activeSessionId) {
    return <GameBoard sessionId={activeSessionId} onLeave={() => setActiveSessionId(null)} />;
  }

  if (joiningSessionId) {
    return <JoinSession sessionId={joiningSessionId} onJoin={setActiveSessionId} />;
  }

  if (role === 'dm') {
    return <DmLobby onSessionStart={setActiveSessionId} />;
  }

  return (
    <PlayerLobby
      onJoinSession={setJoiningSessionId}
      onRejoinSession={setActiveSessionId}
    />
  );
}

const Index = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;

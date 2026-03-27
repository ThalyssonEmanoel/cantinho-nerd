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

  // Not logged in
  if (!player) return <LoginScreen />;

  // No role selected
  if (!role) return <RoleSelection />;

  // In active game session
  if (activeSessionId) {
    return <GameBoard sessionId={activeSessionId} onLeave={() => setActiveSessionId(null)} />;
  }

  // Joining a session (need password)
  if (joiningSessionId) {
    return <JoinSession sessionId={joiningSessionId} onJoin={setActiveSessionId} />;
  }

  // DM flow
  if (role === 'dm') {
    return <DmLobby onSessionStart={setActiveSessionId} />;
  }

  // Player flow
  return <PlayerLobby onJoinSession={setJoiningSessionId} />;
}

const Index = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;

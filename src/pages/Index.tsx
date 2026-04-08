import { useState, useCallback } from 'react';
import { useAuth, AuthProvider } from '@/lib/auth-context';
import LoginScreen from '@/components/LoginScreen';
import RoleSelection from '@/components/RoleSelection';
import DmLobby from '@/components/DmLobby';
import PlayerLobby from '@/components/PlayerLobby';
import JoinSession from '@/components/JoinSession';
import GameBoard from '@/components/GameBoard';

const ACTIVE_SESSION_KEY = 'vtt-active-session';

function AppContent() {
  const { player, role } = useAuth();
  // Persist the active session id across page reloads. Without this, F5
  // boots the user back to the lobby and forces them to re-enter the password.
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_SESSION_KEY)
  );
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
    if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  }, []);

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

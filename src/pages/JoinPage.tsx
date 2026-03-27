import { AuthProvider } from '@/lib/auth-context';
import JoinSession from '@/components/JoinSession';
import GameBoard from '@/components/GameBoard';
import LoginScreen from '@/components/LoginScreen';
import { useAuth } from '@/lib/auth-context';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function JoinContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { player, setRole } = useAuth();
  const [joined, setJoined] = useState(false);
  const navigate = useNavigate();

  if (!player) return <LoginScreen />;

  if (joined && sessionId) {
    return <GameBoard sessionId={sessionId} onLeave={() => navigate('/')} />;
  }

  if (sessionId) {
    return (
      <JoinSession
        sessionId={sessionId}
        onJoin={() => {
          setRole('player');
          setJoined(true);
        }}
      />
    );
  }

  return null;
}

export default function JoinPage() {
  return (
    <AuthProvider>
      <JoinContent />
    </AuthProvider>
  );
}

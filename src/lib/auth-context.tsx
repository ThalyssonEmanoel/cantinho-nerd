import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Player {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  player: Player | null;
  role: 'dm' | 'player' | null;
  setPlayer: (p: Player | null) => void;
  setRole: (r: 'dm' | 'player' | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(() => {
    const stored = localStorage.getItem('vtt-player');
    return stored ? JSON.parse(stored) : null;
  });
  const [role, setRole] = useState<'dm' | 'player' | null>(() => {
    return localStorage.getItem('vtt-role') as 'dm' | 'player' | null;
  });

  const handleSetPlayer = useCallback((p: Player | null) => {
    setPlayer(p);
    if (p) localStorage.setItem('vtt-player', JSON.stringify(p));
    else localStorage.removeItem('vtt-player');
  }, []);

  const handleSetRole = useCallback((r: 'dm' | 'player' | null) => {
    setRole(r);
    if (r) localStorage.setItem('vtt-role', r);
    else localStorage.removeItem('vtt-role');
  }, []);

  const logout = useCallback(() => {
    handleSetPlayer(null);
    handleSetRole(null);
  }, [handleSetPlayer, handleSetRole]);

  return (
    <AuthContext.Provider value={{ player, role, setPlayer: handleSetPlayer, setRole: handleSetRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

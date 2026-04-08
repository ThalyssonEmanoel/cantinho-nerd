import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    localStorage.removeItem('vtt-active-session');
  }, [handleSetPlayer, handleSetRole]);

  // Validate the cached player against the database on mount. If the row no
  // longer exists (database reset, player deleted, different environment),
  // clear the cache so the user is sent back to the login screen instead of
  // hitting an FK violation later when creating a session or token.
  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, avatar_url')
        .eq('id', player.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) return; // network failure — keep cached player, don't log out
      if (!data) {
        handleSetPlayer(null);
        handleSetRole(null);
        localStorage.removeItem('vtt-active-session');
        return;
      }
      // Refresh local cache with latest name/avatar.
      if (data.name !== player.name || data.avatar_url !== player.avatar_url) {
        handleSetPlayer({ id: data.id, name: data.name, avatar_url: data.avatar_url });
      }
    })();
    return () => { cancelled = true; };
    // Only run once on mount with the initial cached player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

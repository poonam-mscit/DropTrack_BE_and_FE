/**
 * Auth + session context. Hydrates from AsyncStorage on mount.
 * Exposes signIn / signOut helpers used by all screens.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearSession, getSession, setSession, type Session } from './storage';

interface AuthCtx {
  session: Session | null;
  ready: boolean;
  signIn: (s: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setS] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSession();
      setS(s);
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (s: Session) => {
    await setSession(s);
    setS(s);
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setS(null);
  }, []);

  return <Ctx.Provider value={{ session, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

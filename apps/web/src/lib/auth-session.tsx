import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/lib/api-client';

let currentAccessToken: string | null = null;

/** Read by api-client to attach the Authorization header — kept outside React state on purpose. */
export function getAccessToken(): string | null {
  return currentAccessToken;
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthSessionContextValue {
  status: SessionStatus;
  workspaceId: string | null;
  setSession: (accessToken: string, workspaceId: string) => void;
  clearSession: () => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const setSession = useCallback((accessToken: string, wsId: string) => {
    currentAccessToken = accessToken;
    setWorkspaceId(wsId);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    currentAccessToken = null;
    setWorkspaceId(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    // Silently try to resume a session from the shared refresh cookie on load.
    authApi
      .refresh()
      .then((result) => {
        if (result.accessToken && result.workspaceId) setSession(result.accessToken, result.workspaceId);
        else setStatus('unauthenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, [setSession]);

  return (
    <AuthSessionContext.Provider value={{ status, workspaceId, setSession, clearSession }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return ctx;
}

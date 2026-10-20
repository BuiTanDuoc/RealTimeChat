import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../lib/api';
import type { AuthResponse, User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login(userName: string, password: string): Promise<void>;
  register(v: { userName: string; displayName: string; email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  setUser(u: User): void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    api.get<User>('/api/users/me')
      .then((r) => setUser(r.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('rtc:logout', onLogout);
    return () => window.removeEventListener('rtc:logout', onLogout);
  }, []);

  const accept = (data: AuthResponse) => { tokenStore.set(data); setUser(data.user); };

  const login = useCallback(async (userName: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/api/auth/login', { userName, password });
    accept(data);
  }, []);

  const register = useCallback(async (v: { userName: string; displayName: string; email: string; password: string }) => {
    const { data } = await api.post<AuthResponse>('/api/auth/register', v);
    accept(data);
  }, []);

  const logout = useCallback(async () => {
    const t = tokenStore.get();
    if (t) await api.post('/api/auth/logout', { refreshToken: t.refreshToken }).catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

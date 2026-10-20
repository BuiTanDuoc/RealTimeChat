import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse } from '../types';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const KEY = 'rtc.auth';
type Tokens = { accessToken: string; refreshToken: string };

export const tokenStore = {
  get(): Tokens | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  },
  set(t: Tokens) { localStorage.setItem(KEY, JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken })); },
  clear() { localStorage.removeItem(KEY); },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t.accessToken}`;
  return cfg;
});

// One refresh at a time; parallel 401s wait for the same promise.
let refreshing: Promise<string> | null = null;
async function refreshTokens(): Promise<string> {
  const t = tokenStore.get();
  if (!t) throw new Error('No session');
  const { data } = await axios.post<AuthResponse>(`${API_URL}/api/auth/refresh`, { refreshToken: t.refreshToken });
  tokenStore.set(data);
  return data.accessToken;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/api/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokenStore.get()) {
      original._retry = true;
      try {
        refreshing ??= refreshTokens().finally(() => { refreshing = null; });
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event('rtc:logout'));
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string; errors?: Record<string, string[]>; title?: string } | undefined;
    if (data?.message) return data.message;
    if (data?.errors) return Object.values(data.errors).flat().join(' ');
    if (!e.response) return 'Cannot reach the server.';
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export const fileUrl = (path?: string | null) => (path ? (path.startsWith('http') ? path : `${API_URL}${path}`) : '');

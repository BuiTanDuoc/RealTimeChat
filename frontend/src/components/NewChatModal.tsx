import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';
import { useChat } from '../context/ChatContext';
import type { User } from '../types';
import Avatar from './Avatar';
import Modal from './Modal';

export default function NewChatModal({ onClose }: { onClose(): void }) {
  const { openPrivate, createGroup, isOnline, friends } = useChat();
  const [mode, setMode] = useState<'private' | 'group'>('private');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get<User[]>('/api/users/search', { params: { q } })
        .then((r) => setResults(r.data))
        .catch((e) => toast.error(errorMessage(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); onClose(); } catch (e) { toast.error(errorMessage(e)); setBusy(false); }
  };

  const toggle = (u: User) =>
    setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));

  const pick = (u: User) => (mode === 'private' ? void run(() => openPrivate(u.id)) : toggle(u));

  return (
    <Modal title="New chat" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="tablist">
        {(['private', 'group'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={`rounded-md py-1.5 transition ${mode === m ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
            {m === 'private' ? 'Private chat' : 'Group'}
          </button>
        ))}
      </div>

      {mode === 'group' && (
        <input className="field mb-3" placeholder="Group name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      )}

      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="field pl-9" placeholder="Search people by name or username" value={query}
               onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>

      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <li key={u.id}><button onClick={() => toggle(u)} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {u.displayName} ✕</button></li>
          ))}
        </ul>
      )}

      <ul className="max-h-64 overflow-y-auto">
        {(query.trim() ? results : friends).map((u) => {
          const on = selected.some((x) => x.id === u.id);
          return (
            <li key={u.id}>
              <button disabled={busy} onClick={() => pick(u)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100">
                <Avatar name={u.displayName} src={u.avatarUrl} size={36} online={isOnline(u.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{u.displayName}</span>
                  <span className="block truncate text-xs text-slate-500">@{u.userName}</span>
                </span>
                {mode === 'group' && on && <Check size={18} className="text-brand-600" />}
              </button>
            </li>
          );
        })}
        {!query.trim() && friends.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Search for someone, or add friends to see them here.</li>}
        {query.trim() && results.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No one found.</li>}
      </ul>

      {mode === 'group' && (
        <button className="btn mt-4 w-full" disabled={busy || !name.trim() || selected.length === 0}
                onClick={() => void run(() => createGroup(name.trim(), selected.map((u) => u.id)))}>
          Create group{selected.length ? ` (${selected.length + 1} members)` : ''}
        </button>
      )}
    </Modal>
  );
}

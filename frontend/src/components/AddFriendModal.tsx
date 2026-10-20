import { useEffect, useState } from 'react';
import { Check, Search, UserCheck, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';
import { useChat } from '../context/ChatContext';
import type { User } from '../types';
import Avatar from './Avatar';
import Modal from './Modal';

export default function AddFriendModal({ onClose }: { onClose(): void }) {
  const { sendFriendRequest, acceptRequest, removeRequest, isOnline } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const patch = (id: string, p: Partial<User>) =>
    setResults((rs) => rs.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const act = async (u: User, fn: () => Promise<void>) => {
    setBusyId(u.id);
    try { await fn(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  const add = (u: User) => act(u, async () => {
    const r = await sendFriendRequest(u.id);
    patch(u.id, { friendship: 'RequestSent', friendRequestId: r.id });
    toast.success(`Request sent to ${u.displayName}`);
  });
  const cancel = (u: User) => act(u, async () => {
    await removeRequest(u.friendRequestId!);
    patch(u.id, { friendship: 'None', friendRequestId: null });
  });
  const accept = (u: User) => act(u, async () => {
    await acceptRequest(u.friendRequestId!);
    patch(u.id, { friendship: 'Friends', friendRequestId: null });
  });

  return (
    <Modal title="Add friend" onClose={onClose}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="field pl-9" placeholder="Search by name or username" value={query}
               onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>

      <ul className="max-h-72 overflow-y-auto">
        {results.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={u.displayName} src={u.avatarUrl} size={40} online={isOnline(u.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{u.displayName}</span>
              <span className="block truncate text-xs text-slate-500">@{u.userName}</span>
            </span>

            {u.friendship === 'Friends' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><UserCheck size={16} /> Friends</span>
            )}
            {u.friendship === 'RequestSent' && (
              <button className="btn-ghost !px-2 !py-1 text-xs" disabled={busyId === u.id} onClick={() => void cancel(u)}>
                <X size={14} /> Cancel request
              </button>
            )}
            {u.friendship === 'RequestReceived' && (
              <button className="btn !px-3 !py-1 text-xs" disabled={busyId === u.id} onClick={() => void accept(u)}>
                <Check size={14} /> Accept
              </button>
            )}
            {(!u.friendship || u.friendship === 'None') && (
              <button className="btn !px-3 !py-1 text-xs" disabled={busyId === u.id} onClick={() => void add(u)}>
                <UserPlus size={14} /> Add
              </button>
            )}
          </li>
        ))}
        {query.trim() && results.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No one found.</li>}
        {!query.trim() && <li className="py-4 text-center text-sm text-slate-500">Type a name or username to find people.</li>}
      </ul>
    </Modal>
  );
}

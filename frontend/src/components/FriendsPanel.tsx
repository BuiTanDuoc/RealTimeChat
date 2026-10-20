import { Check, MessageCircle, UserMinus, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '../lib/api';
import { formatLastSeen } from '../lib/helpers';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';

interface Props { filter: string; onAdd(): void; onOpenChat(): void }

export default function FriendsPanel({ filter, onAdd, onOpenChat }: Props) {
  const { friends, requests, isOnline, acceptRequest, removeRequest, unfriend, openPrivate } = useChat();

  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const q = filter.trim().toLowerCase();
  const shown = friends.filter((f) => !q || f.displayName.toLowerCase().includes(q) || f.userName.toLowerCase().includes(q));
  const incoming = requests.filter((r) => r.direction === 'Incoming');
  const outgoing = requests.filter((r) => r.direction === 'Outgoing');

  const message = (id: string) => run(async () => { await openPrivate(id); onOpenChat(); });
  const remove = (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from your friends?`)) void run(() => unfriend(id));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {incoming.length > 0 && (
        <section aria-label="Friend requests">
          <h2 className="px-4 pb-1 pt-3 text-sm font-bold text-slate-600">Requests ({incoming.length})</h2>
          <ul>
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={r.user.displayName} src={r.user.avatarUrl} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.user.displayName}</span>
                  <span className="block truncate text-xs text-slate-500">@{r.user.userName}</span>
                </span>
                <button className="icon-btn !bg-brand-600 !text-white hover:!bg-brand-700" aria-label={`Accept ${r.user.displayName}`}
                        onClick={() => void run(() => acceptRequest(r.id))}><Check size={18} /></button>
                <button className="icon-btn" aria-label={`Decline ${r.user.displayName}`}
                        onClick={() => void run(() => removeRequest(r.id))}><X size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section aria-label="Sent requests">
          <h2 className="px-4 pb-1 pt-3 text-sm font-bold text-slate-600">Sent ({outgoing.length})</h2>
          <ul>
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={r.user.displayName} src={r.user.avatarUrl} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.user.displayName}</span>
                  <span className="block text-xs text-slate-500">Waiting for a reply</span>
                </span>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => void run(() => removeRequest(r.id))}>Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Friends">
        <h2 className="px-4 pb-1 pt-3 text-sm font-bold text-slate-600">Friends ({friends.length})</h2>
        <ul>
          {shown.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <Avatar name={f.displayName} src={f.avatarUrl} size={42} online={isOnline(f.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{f.displayName}</span>
                <span className="block truncate text-xs text-slate-500">{isOnline(f.id) ? 'Online' : formatLastSeen(f.lastSeenAt)}</span>
              </span>
              <button className="icon-btn" aria-label={`Message ${f.displayName}`} onClick={() => void message(f.id)}><MessageCircle size={18} /></button>
              <button className="icon-btn" aria-label={`Remove ${f.displayName}`} onClick={() => remove(f.id, f.displayName)}><UserMinus size={18} /></button>
            </li>
          ))}
        </ul>
        {friends.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            <p>You have no friends yet.</p>
            <button className="btn mt-3" onClick={onAdd}><UserPlus size={16} /> Add a friend</button>
          </div>
        )}
        {friends.length > 0 && shown.length === 0 && <p className="px-6 py-6 text-center text-sm text-slate-500">No friends match “{filter}”.</p>}
      </section>
    </div>
  );
}

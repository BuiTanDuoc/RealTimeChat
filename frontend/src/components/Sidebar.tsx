import { useState } from 'react';
import { Search, SquarePen, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { conversationTitle, formatListTime, messagePreview, otherUser } from '../lib/helpers';
import AddFriendModal from './AddFriendModal';
import Avatar from './Avatar';
import FriendsPanel from './FriendsPanel';
import NewChatModal from './NewChatModal';
import ProfileModal from './ProfileModal';

export default function Sidebar() {
  const { user } = useAuth();
  const { conversations, activeId, selectConversation, isOnline, requests } = useChat();
  const [tab, setTab] = useState<'chats' | 'friends'>('chats');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState<'new' | 'profile' | 'friend' | null>(null);
  if (!user) return null;

  const incomingCount = requests.filter((r) => r.direction === 'Incoming').length;
  const shown = conversations.filter((c) => conversationTitle(c, user.id).toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <aside className={`${activeId ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-80 lg:w-96`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setModal('profile')} aria-label="Open profile" className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
          <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
        </button>
        <h1 className="flex-1 truncate text-lg font-extrabold">Chats</h1>
        <button className="icon-btn" onClick={() => setModal('friend')} aria-label="Add friend"><UserPlus size={20} /></button>
        <button className="icon-btn" onClick={() => setModal('new')} aria-label="New chat"><SquarePen size={20} /></button>
      </header>

      <div className="mx-4 mb-2 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="tablist">
        <button role="tab" aria-selected={tab === 'chats'} onClick={() => setTab('chats')}
                className={`rounded-md py-1.5 transition ${tab === 'chats' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Chats</button>
        <button role="tab" aria-selected={tab === 'friends'} onClick={() => setTab('friends')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${tab === 'friends' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
          Friends
          {incomingCount > 0 && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">{incomingCount}</span>}
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field pl-9" placeholder={tab === 'chats' ? 'Filter chats' : 'Filter friends'} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {tab === 'friends' ? (
        <FriendsPanel filter={filter} onAdd={() => setModal('friend')} onOpenChat={() => setTab('chats')} />
      ) : (
      <ul className="flex-1 overflow-y-auto">
        {shown.map((c) => {
          const title = conversationTitle(c, user.id);
          const other = otherUser(c, user.id);
          const last = c.lastMessage;
          const mine = last?.senderId === user.id;
          return (
            <li key={c.id}>
              <button onClick={() => void selectConversation(c.id)} aria-current={c.id === activeId}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${c.id === activeId ? 'bg-brand-50' : ''}`}>
                <Avatar name={title} src={c.isGroup ? null : other?.avatarUrl} online={c.isGroup || !other ? null : isOnline(other.id)} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">{title}</span>
                    {last && <time className="shrink-0 text-xs text-slate-400" dateTime={last.sentAt}>{formatListTime(last.sentAt)}</time>}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unreadCount ? 'font-semibold text-ink' : 'text-slate-500'}`}>
                      {last && (mine ? 'You: ' : c.isGroup ? `${last.senderName}: ` : '')}{messagePreview(last)}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {conversations.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-slate-500">
            No chats yet. Use the <SquarePen size={14} className="inline" /> button to find someone to talk to.
          </li>
        )}
      </ul>
      )}

      {modal === 'friend' && <AddFriendModal onClose={() => setModal(null)} />}
      {modal === 'new' && <NewChatModal onClose={() => setModal(null)} />}
      {modal === 'profile' && <ProfileModal onClose={() => setModal(null)} />}
    </aside>
  );
}

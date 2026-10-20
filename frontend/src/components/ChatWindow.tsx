import { useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { conversationTitle, formatLastSeen, otherUser } from '../lib/helpers';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatWindow() {
  const { user } = useAuth();
  const { conversations, messages, activeId, hasMore, loadingMessages, loadOlder, selectConversation, isOnline, connected } = useChat();
  const scroller = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);

  const conv = conversations.find((c) => c.id === activeId);
  const list = (activeId && messages[activeId]) || [];
  const lastId = list[list.length - 1]?.id;

  // New message at the bottom (or chat switch) → jump down; older page prepended → keep position.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeId, lastId, list.length === 0]);

  useEffect(() => { prevHeight.current = null; }, [activeId]);

  if (!conv || !user) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-slate-500 md:flex">
        <MessageCircle size={48} className="text-brand-500" />
        <p className="font-semibold">Select a chat or start a new one</p>
      </div>
    );
  }

  const other = otherUser(conv, user.id);
  const title = conversationTitle(conv, user.id);
  const subtitle = conv.isGroup
    ? `${conv.participants.length} members`
    : other && (isOnline(other.id) ? 'Online' : formatLastSeen(other.lastSeenAt));

  const older = async () => {
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    await loadOlder();
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
        <button className="icon-btn md:hidden" onClick={() => void selectConversation(null)} aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <Avatar name={title} src={conv.isGroup ? null : other?.avatarUrl} online={conv.isGroup || !other ? null : isOnline(other.id)} />
        <div className="min-w-0">
          <h2 className="truncate font-bold leading-tight">{title}</h2>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        {!connected && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Reconnecting…</span>}
      </header>

      <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto bg-paper px-3 py-4 md:px-6">
        {hasMore[conv.id] && (
          <div className="flex justify-center pb-2">
            <button className="btn-ghost !py-1 text-xs" onClick={() => void older()} disabled={loadingMessages}>
              {loadingMessages ? <Loader2 size={14} className="animate-spin" /> : null} Load older messages
            </button>
          </div>
        )}
        {loadingMessages && list.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Loading messages…</p>}
        {!loadingMessages && list.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello.</p>}

        {list.map((m, i) => (
          <MessageBubble key={m.id} message={m} own={m.senderId === user.id}
                         showSender={conv.isGroup && list[i - 1]?.senderId !== m.senderId} />
        ))}
      </div>

      <MessageInput conversationId={conv.id} />
    </section>
  );
}

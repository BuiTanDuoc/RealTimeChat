import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import toast from 'react-hot-toast';
import { API_URL, api, errorMessage, tokenStore } from '../lib/api';
import { useAuth } from './AuthContext';
import type { Conversation, FriendRequest, Message, MessageStatusEvent, MessageType, User } from '../types';

const PAGE = 50;
const byName = (a: User, b: User) => a.displayName.localeCompare(b.displayName);

export interface OutgoingMessage {
  conversationId: string;
  type: MessageType;
  content?: string | null;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  activeId: string | null;
  connected: boolean;
  loadingMessages: boolean;
  friends: User[];
  requests: FriendRequest[];
  sendFriendRequest(userId: string): Promise<FriendRequest>;
  acceptRequest(requestId: string): Promise<void>;
  /** Decline an incoming request or cancel an outgoing one. */
  removeRequest(requestId: string): Promise<void>;
  unfriend(userId: string): Promise<void>;
  isOnline(userId: string): boolean;
  selectConversation(id: string | null): Promise<void>;
  sendMessage(m: OutgoingMessage): Promise<void>;
  loadOlder(): Promise<void>;
  openPrivate(userId: string): Promise<void>;
  createGroup(name: string, memberIds: string[]): Promise<void>;
}

const Ctx = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user!.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Refs let long-lived SignalR handlers read current state without re-subscribing.
  const connRef = useRef<signalR.HubConnection | null>(null);
  const activeRef = useRef<string | null>(null);
  const convRef = useRef<Conversation[]>([]);
  const msgRef = useRef<Record<string, Message[]>>({});
  convRef.current = conversations;
  msgRef.current = messages;

  const markRead = useCallback((conversationId: string) => {
    const c = connRef.current;
    if (c?.state === signalR.HubConnectionState.Connected) c.invoke('MarkAsRead', conversationId).catch(() => {});
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get<Conversation[]>('/api/conversations');
      setConversations(data);
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        api.get<User[]>('/api/friends'),
        api.get<FriendRequest[]>('/api/friends/requests'),
      ]);
      setFriends(f.data);
      setRequests(r.data);
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  const fetchMessages = useCallback(async (id: string, before?: string) => {
    const { data } = await api.get<Message[]>(`/api/conversations/${id}/messages`, { params: { before, take: PAGE } });
    setMessages((prev) => {
      const existing = before ? prev[id] ?? [] : [];
      const ids = new Set(existing.map((m) => m.id));
      return { ...prev, [id]: [...data.filter((m) => !ids.has(m.id)), ...existing] };
    });
    setHasMore((prev) => ({ ...prev, [id]: data.length === PAGE }));
  }, []);

  // ---------- SignalR ----------
  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/chat`, { accessTokenFactory: () => tokenStore.get()?.accessToken ?? '' })
      .withAutomaticReconnect()
      .build();
    connRef.current = conn;

    conn.on('ReceiveMessage', (m: Message) => {
      setMessages((prev) => {
        const list = prev[m.conversationId];
        if (!list || list.some((x) => x.id === m.id)) return prev;
        return { ...prev, [m.conversationId]: [...list, m] };
      });

      if (!convRef.current.some((c) => c.id === m.conversationId)) {
        void loadConversations(); // a brand-new chat started by someone else
        return;
      }
      const viewing = activeRef.current === m.conversationId && document.hasFocus();
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === m.conversationId);
        if (idx < 0) return prev;
        const c = prev[idx];
        const unread = m.senderId !== me && !viewing ? c.unreadCount + 1 : c.unreadCount;
        return [{ ...c, lastMessage: m, unreadCount: unread }, ...prev.filter((_, i) => i !== idx)];
      });
      if (m.senderId !== me && viewing) markRead(m.conversationId);
    });

    conn.on('MessageStatus', (e: MessageStatusEvent) => {
      setMessages((prev) => {
        const list = prev[e.conversationId];
        if (!list) return prev;
        const ids = new Set(e.messageIds);
        return {
          ...prev,
          [e.conversationId]: list.map((m) =>
            !ids.has(m.id) ? m : {
              ...m,
              receipts: m.receipts.map((r) => r.userId !== e.userId ? r : {
                ...r,
                deliveredAt: r.deliveredAt ?? e.at,
                readAt: e.status === 'Read' ? r.readAt ?? e.at : r.readAt,
              }),
            }),
        };
      });
    });

    conn.on('ConversationRead', (id: string) =>
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))));

    conn.on('ConversationCreated', (c: Conversation) =>
      setConversations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev])));

    conn.on('FriendRequestReceived', (r: FriendRequest) => {
      setRequests((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
      toast(`${r.user.displayName} sent you a friend request`);
    });
    conn.on('FriendRequestAccepted', (e: { requestId: string; user: User }) => {
      setRequests((prev) => prev.filter((x) => x.id !== e.requestId));
      setFriends((prev) => (prev.some((f) => f.id === e.user.id) ? prev : [...prev, e.user].sort(byName)));
      toast.success(`${e.user.displayName} accepted your friend request`);
    });
    conn.on('FriendRequestRemoved', (id: string) => setRequests((prev) => prev.filter((x) => x.id !== id)));
    conn.on('FriendRemoved', (userId: string) => setFriends((prev) => prev.filter((f) => f.id !== userId)));

    conn.on('OnlineUsers', (ids: string[]) => setOnline(new Set(ids)));
    conn.on('UserOnline', (id: string) => setOnline((s) => new Set(s).add(id)));
    conn.on('UserOffline', (e: { userId: string; lastSeenAt: string }) => {
      setOnline((s) => { const n = new Set(s); n.delete(e.userId); return n; });
      setConversations((prev) => prev.map((c) => ({
        ...c,
        participants: c.participants.map((p) => (p.id === e.userId ? { ...p, lastSeenAt: e.lastSeenAt } : p)),
      })));
      setFriends((prev) => prev.map((f) => (f.id === e.userId ? { ...f, lastSeenAt: e.lastSeenAt } : f)));
    });

    conn.onreconnecting(() => setConnected(false));
    conn.onreconnected(() => {
      setConnected(true);
      void loadConversations();
      void loadFriends();
      if (activeRef.current) void fetchMessages(activeRef.current).then(() => markRead(activeRef.current!));
    });
    conn.onclose(() => setConnected(false));

    conn.start()
      .then(() => setConnected(true))
      .catch((err) => { if (conn.state !== signalR.HubConnectionState.Disconnected || !String(err).includes('stopped')) console.warn(err); });

    void loadConversations();
    void loadFriends();
    return () => { void conn.stop(); };
  }, [me, loadConversations, loadFriends, fetchMessages, markRead]);

  // Mark the open chat as read when the window regains focus or the connection comes back.
  useEffect(() => {
    const onFocus = () => {
      const id = activeRef.current;
      if (!id) return;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
      markRead(id);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markRead]);

  useEffect(() => { if (connected && activeId) markRead(activeId); }, [connected, activeId, markRead]);

  // ---------- actions ----------
  const selectConversation = useCallback(async (id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    if (!id) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    if (!msgRef.current[id]) {
      setLoadingMessages(true);
      try { await fetchMessages(id); } catch (e) { toast.error(errorMessage(e)); } finally { setLoadingMessages(false); }
    }
    markRead(id);
  }, [fetchMessages, markRead]);

  const sendMessage = useCallback(async (m: OutgoingMessage) => {
    const conn = connRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) throw new Error('You are offline. Reconnecting…');
    await conn.invoke('SendMessage', m);
  }, []);

  const loadOlder = useCallback(async () => {
    const id = activeRef.current;
    const first = id ? msgRef.current[id]?.[0] : undefined;
    if (!id || !first) return;
    setLoadingMessages(true);
    try { await fetchMessages(id, first.sentAt); } catch (e) { toast.error(errorMessage(e)); } finally { setLoadingMessages(false); }
  }, [fetchMessages]);

  const addAndOpen = useCallback(async (c: Conversation) => {
    setConversations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
    await selectConversation(c.id);
  }, [selectConversation]);

  const openPrivate = useCallback(async (userId: string) => {
    const { data } = await api.post<Conversation>('/api/conversations/private', { userId });
    await addAndOpen(data);
  }, [addAndOpen]);

  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    const { data } = await api.post<Conversation>('/api/conversations/group', { name, memberIds });
    await addAndOpen(data);
  }, [addAndOpen]);

  const sendFriendRequest = useCallback(async (userId: string) => {
    const { data } = await api.post<FriendRequest>('/api/friends/requests', { userId });
    setRequests((prev) => (prev.some((x) => x.id === data.id) ? prev : [data, ...prev]));
    return data;
  }, []);

  const acceptRequest = useCallback(async (requestId: string) => {
    const { data } = await api.post<User>(`/api/friends/requests/${requestId}/accept`);
    setRequests((prev) => prev.filter((x) => x.id !== requestId));
    setFriends((prev) => (prev.some((f) => f.id === data.id) ? prev : [...prev, data].sort(byName)));
  }, []);

  const removeRequest = useCallback(async (requestId: string) => {
    await api.delete(`/api/friends/requests/${requestId}`);
    setRequests((prev) => prev.filter((x) => x.id !== requestId));
  }, []);

  const unfriend = useCallback(async (userId: string) => {
    await api.delete(`/api/friends/${userId}`);
    setFriends((prev) => prev.filter((f) => f.id !== userId));
  }, []);

  const isOnline = useCallback((id: string) => online.has(id), [online]);

  return (
    <Ctx.Provider value={{
      conversations, messages, hasMore, activeId, connected, loadingMessages,
      friends, requests, sendFriendRequest, acceptRequest, removeRequest, unfriend,
      isOnline, selectConversation, sendMessage, loadOlder, openPrivate, createGroup,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useChat() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useChat must be used inside ChatProvider');
  return c;
}

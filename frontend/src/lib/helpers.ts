import type { Conversation, Message, User } from '../types';

export const otherUser = (c: Conversation, meId: string): User | undefined =>
  c.participants.find((p) => p.id !== meId);

export const conversationTitle = (c: Conversation, meId: string) =>
  c.isGroup ? c.name ?? 'Group' : otherUser(c, meId)?.displayName ?? 'Conversation';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

/** Receipts only exist for recipients, so "all" means everyone but the sender. */
export function deliveryStatus(m: Message): DeliveryStatus {
  if (m.receipts.length === 0) return 'sent';
  if (m.receipts.every((r) => r.readAt)) return 'read';
  if (m.receipts.every((r) => r.deliveredAt)) return 'delivered';
  return 'sent';
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatListTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(iso);
  const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export function formatLastSeen(iso?: string | null) {
  if (!iso) return 'Offline';
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString() ? 'today' : d.toLocaleDateString();
  return `Last seen ${day} at ${formatTime(iso)}`;
}

export function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function messagePreview(m?: Message | null) {
  if (!m) return 'No messages yet';
  if (m.type === 'Image') return m.content ? `Photo: ${m.content}` : 'Photo';
  if (m.type === 'File') return m.content ? `${m.fileName}: ${m.content}` : m.fileName ?? 'File';
  return m.content ?? '';
}

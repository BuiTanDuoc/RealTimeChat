export interface User {
  id: string;
  userName: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeenAt?: string | null;
  /** Only present on search results. */
  friendship?: 'None' | 'Friends' | 'RequestSent' | 'RequestReceived' | null;
  friendRequestId?: string | null;
}

export interface FriendRequest {
  id: string;
  user: User;
  createdAt: string;
  direction: 'Incoming' | 'Outgoing';
}

export interface Receipt {
  userId: string;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export type MessageType = 'Text' | 'Image' | 'File';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content?: string | null;
  type: MessageType;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  sentAt: string;
  receipts: Receipt[];
}

export interface Conversation {
  id: string;
  name?: string | null;
  isGroup: boolean;
  createdAt: string;
  participants: User[];
  lastMessage?: Message | null;
  unreadCount: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
  isImage: boolean;
}

export interface MessageStatusEvent {
  conversationId: string;
  messageIds: string[];
  userId: string;
  status: 'Delivered' | 'Read';
  at: string;
}

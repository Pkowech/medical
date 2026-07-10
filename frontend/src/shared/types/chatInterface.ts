export interface Message {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    name: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: { id: string; name: string }[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageResponse {
  success: boolean;
  data: Message;
}

export interface MessagesListResponse {
  success: boolean;
  data: Message[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationResponse {
  success: boolean;
  data: Conversation;
}

export interface ConversationsListResponse {
  success: boolean;
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
}

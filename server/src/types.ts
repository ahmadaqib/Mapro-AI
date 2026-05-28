export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export type SseEventType = 'reasoning' | 'token' | 'done' | 'error';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  private?: boolean;
  history?: Message[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export interface HistoryStore {
  activeConversationId: string | null;
  conversations: Conversation[];
}

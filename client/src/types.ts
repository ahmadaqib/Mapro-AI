export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string;
  isStreaming: boolean;
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ApiMessage[];
}

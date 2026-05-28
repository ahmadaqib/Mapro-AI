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

export interface FileContext {
  name: string;
  text: string;
}

export interface ExtractedFile extends FileContext {
  mimeType: string;
  charCount: number;
  truncated: boolean;
}

export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export type SseEventType = 'reasoning' | 'token' | 'done' | 'error';

export interface ChatRequest {
  message: string;
}

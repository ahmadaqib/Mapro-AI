import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { Conversation, ConversationSummary, HistoryStore, Message } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = process.env.HISTORY_FILE_OVERRIDE
  ?? path.resolve(__dirname, '../../../history.json');

const LEGACY_CONVERSATION_ID = 'legacy-history';

function nowIso(): string {
  return new Date().toISOString();
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Partial<Message>;
  return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
}

function normalizeTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Percakapan baru';
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function createConversation(messages: Message[] = [], id = randomUUID()): Conversation {
  const timestamp = nowIso();
  const firstUserMessage = messages.find(message => message.role === 'user')?.content ?? '';
  return {
    id,
    title: normalizeTitle(firstUserMessage),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages,
  };
}

function parseStore(parsed: unknown): HistoryStore | null {
  if (Array.isArray(parsed)) {
    const messages = parsed.filter(isMessage);
    if (messages.length === 0) {
      return { activeConversationId: null, conversations: [] };
    }

    const conversation = createConversation(messages, LEGACY_CONVERSATION_ID);
    return {
      activeConversationId: conversation.id,
      conversations: [conversation],
    };
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const raw = parsed as Partial<HistoryStore>;
  if (!Array.isArray(raw.conversations)) return null;

  const conversations = raw.conversations
    .filter((conversation): conversation is Conversation => {
      if (!conversation || typeof conversation !== 'object') return false;
      return (
        typeof conversation.id === 'string'
        && typeof conversation.title === 'string'
        && typeof conversation.createdAt === 'string'
        && typeof conversation.updatedAt === 'string'
        && Array.isArray(conversation.messages)
      );
    })
    .map(conversation => ({
      ...conversation,
      messages: conversation.messages.filter(isMessage),
    }));

  const activeConversationId = typeof raw.activeConversationId === 'string'
    && conversations.some(conversation => conversation.id === raw.activeConversationId)
    ? raw.activeConversationId
    : conversations[0]?.id ?? null;

  return { activeConversationId, conversations };
}

function saveStore(store: HistoryStore): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function loadStore(): HistoryStore {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      return parseStore(parsed) ?? { activeConversationId: null, conversations: [] };
    }
  } catch {
    // corrupt — return empty
  }
  return { activeConversationId: null, conversations: [] };
}

export function loadHistory(): Message[] {
  const store = loadStore();
  const activeConversation = store.conversations.find(
    conversation => conversation.id === store.activeConversationId,
  );
  return activeConversation?.messages ?? [];
}

export function listConversations(): ConversationSummary[] {
  const store = loadStore();
  return store.conversations
    .map(conversation => {
      const lastMessage = [...conversation.messages].reverse().find(message => message.content.trim());
      return {
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
        preview: lastMessage?.content.replace(/\s+/g, ' ').slice(0, 80) ?? '',
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation(id: string): Conversation | null {
  return loadStore().conversations.find(conversation => conversation.id === id) ?? null;
}

export function createStoredConversation(): Conversation {
  const store = loadStore();
  const conversation = createConversation();
  store.conversations.unshift(conversation);
  store.activeConversationId = conversation.id;
  saveStore(store);
  return conversation;
}

export function ensureConversation(id?: string): Conversation {
  const store = loadStore();
  const existing = id
    ? store.conversations.find(conversation => conversation.id === id)
    : undefined;

  if (existing) {
    store.activeConversationId = existing.id;
    saveStore(store);
    return existing;
  }

  const conversation = createConversation();
  store.conversations.unshift(conversation);
  store.activeConversationId = conversation.id;
  saveStore(store);
  return conversation;
}

export function appendHistory(
  userMessage: string,
  assistantReply: string,
  conversationId?: string,
): Conversation {
  const store = loadStore();
  let conversation = conversationId
    ? store.conversations.find(item => item.id === conversationId)
    : store.conversations.find(item => item.id === store.activeConversationId);

  if (!conversation) {
    conversation = createConversation();
    store.conversations.unshift(conversation);
  }

  conversation.messages.push({ role: 'user', content: userMessage });
  conversation.messages.push({ role: 'assistant', content: assistantReply });

  if (conversation.title === 'Percakapan baru') {
    conversation.title = normalizeTitle(userMessage);
  }
  conversation.updatedAt = nowIso();
  store.activeConversationId = conversation.id;
  saveStore(store);

  return conversation;
}

export function resetHistory(conversationId?: string): void {
  const store = loadStore();
  const targetId = conversationId ?? store.activeConversationId;

  if (!targetId) {
    saveStore({ activeConversationId: null, conversations: [] });
    return;
  }

  const conversation = store.conversations.find(item => item.id === targetId);
  if (!conversation) return;

  conversation.messages = [];
  conversation.title = 'Percakapan baru';
  conversation.updatedAt = nowIso();
  store.activeConversationId = conversation.id;
  saveStore(store);
}

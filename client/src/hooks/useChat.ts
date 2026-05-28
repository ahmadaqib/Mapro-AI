import { useEffect, useState, useCallback } from 'react';
import type { ApiMessage, Conversation, ConversationSummary, DisplayMessage, FileContext } from '../types';

const API = 'http://localhost:3000';
const ACTIVE_CONVERSATION_KEY = 'mapro.activeConversationId';

function toDisplayMessages(messages: ApiMessage[]): DisplayMessage[] {
  return messages.map(message => ({
    id: crypto.randomUUID(),
    role: message.role,
    content: message.content,
    reasoning: '',
    isStreaming: false,
  }));
}

function toApiMessages(messages: DisplayMessage[]): ApiMessage[] {
  return messages
    .filter(message => !message.isStreaming && message.content.trim())
    .map(message => ({
      role: message.role,
      content: message.content,
    }));
}

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const refreshConversations = useCallback(async () => {
    const response = await fetch(`${API}/api/conversations`);
    const data = await response.json() as ConversationSummary[];
    setConversations(data);
    return data;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const response = await fetch(`${API}/api/conversations/${id}`);
    if (!response.ok) return;

    const conversation = await response.json() as Conversation;
    setMessages(toDisplayMessages(conversation.messages));
    setActiveConversationId(conversation.id);
    setIsPrivate(false);
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversation.id);
  }, []);

  useEffect(() => {
    let isMounted = true;

    refreshConversations().then(async list => {
      if (!isMounted || list.length === 0) return;

      const storedId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
      const initialConversation = list.find(item => item.id === storedId) ?? list[0];
      await loadConversation(initialConversation.id);
    }).catch(() => {
      setConversations([]);
    });

    return () => {
      isMounted = false;
    };
  }, [loadConversation, refreshConversations]);

  const startNewConversation = useCallback(async () => {
    if (isStreaming) return;

    const response = await fetch(`${API}/api/conversations`, { method: 'POST' });
    const conversation = await response.json() as Conversation;

    setMessages([]);
    setActiveConversationId(conversation.id);
    setIsPrivate(false);
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversation.id);
    await refreshConversations();
  }, [isStreaming, refreshConversations]);

  const startPrivateConversation = useCallback(() => {
    if (isStreaming) return;

    setMessages([]);
    setActiveConversationId(null);
    setIsPrivate(true);
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }, [isStreaming]);

  const deleteConversation = useCallback(async (id: string) => {
    if (isStreaming) return;

    const response = await fetch(`${API}/api/conversations/${id}`, { method: 'DELETE' });
    if (!response.ok) return;

    const nextConversations = await refreshConversations();
    if (id !== activeConversationId) return;

    setMessages([]);
    setActiveConversationId(null);
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);

    if (nextConversations.length === 0) {
      setIsPrivate(false);
    }
  }, [activeConversationId, isStreaming, refreshConversations]);

  const sendMessage = useCallback(async (text: string, fileContext?: FileContext) => {
    if (!text.trim() || isStreaming) return;
    const historyForRequest = toApiMessages(messages);
    let targetConversationId = activeConversationId;
    const visibleText = fileContext
      ? `${text}\n\n[Lampiran: ${fileContext.name}]`
      : text;

    if (!isPrivate && !targetConversationId) {
      const response = await fetch(`${API}/api/conversations`, { method: 'POST' });
      const conversation = await response.json() as Conversation;
      targetConversationId = conversation.id;
      setActiveConversationId(conversation.id);
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversation.id);
    }

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: visibleText,
      reasoning: '',
      isStreaming: false,
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: visibleText,
          conversationId: targetConversationId,
          private: isPrivate,
          history: isPrivate ? historyForRequest : undefined,
          fileContext,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const patch = (fn: (m: DisplayMessage) => DisplayMessage) =>
        setMessages(prev => prev.map(m => m.id === assistantId ? fn(m) : m));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            const data = JSON.parse(line.slice(6)) as Record<string, string>;
            if (eventType === 'reasoning') {
              patch(m => ({ ...m, reasoning: m.reasoning + (data.text ?? '') }));
            } else if (eventType === 'token') {
              patch(m => ({ ...m, content: m.content + (data.text ?? '') }));
            } else if (eventType === 'done' || eventType === 'error') {
              const errMsg = eventType === 'error' ? (data.message ?? 'Error') : undefined;
              patch(m => ({
                ...m,
                isStreaming: false,
                content: errMsg ? `⚠ ${errMsg}` : m.content,
              }));
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: '⚠ Gagal terhubung ke server.', isStreaming: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
      if (!isPrivate) {
        await refreshConversations();
      }
    }
  }, [activeConversationId, isPrivate, isStreaming, messages, refreshConversations]);

  const resetHistory = useCallback(async () => {
    if (isStreaming) return;

    if (!isPrivate && activeConversationId) {
      await fetch(`${API}/api/history?conversationId=${activeConversationId}`, { method: 'DELETE' });
      await refreshConversations();
    }

    setMessages([]);
  }, [activeConversationId, isPrivate, isStreaming, refreshConversations]);

  return {
    messages,
    conversations,
    activeConversationId,
    isPrivate,
    isStreaming,
    sendMessage,
    resetHistory,
    startNewConversation,
    startPrivateConversation,
    deleteConversation,
    loadConversation,
  };
}

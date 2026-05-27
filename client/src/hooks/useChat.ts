import { useState, useCallback } from 'react';
import type { DisplayMessage } from '../types';

const API = 'http://localhost:3000';

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
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
        body: JSON.stringify({ message: text }),
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
    }
  }, [isStreaming]);

  const resetHistory = useCallback(async () => {
    await fetch(`${API}/api/history`, { method: 'DELETE' });
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, resetHistory };
}

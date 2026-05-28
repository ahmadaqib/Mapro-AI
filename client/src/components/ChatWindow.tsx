import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { DisplayMessage } from '../types';

interface Props {
  messages: DisplayMessage[];
}

export function ChatWindow({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="empty-state">
          <img src="/assets/logo.png" alt="Mapro Logo" className="empty-state-logo" />
          <h2>Hai, saya Mapro.</h2>
          <p>Saya tidak akan selalu setuju dengan kamu.<br />Bicara saja.</p>
        </div>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

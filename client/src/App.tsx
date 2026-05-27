import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { useChat } from './hooks/useChat';

export default function App() {
  const { messages, isStreaming, sendMessage, resetHistory } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar
        onReset={resetHistory}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <main className="main">
        <ChatWindow messages={messages} />
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </main>
    </div>
  );
}

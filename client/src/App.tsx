import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { useChat } from './hooks/useChat';

export default function App() {
  const {
    messages,
    conversations,
    activeConversationId,
    isPrivate,
    isStreaming,
    sendMessage,
    resetHistory,
    startNewConversation,
    startPrivateConversation,
    loadConversation,
  } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar
        onReset={resetHistory}
        onNewConversation={startNewConversation}
        onPrivateConversation={startPrivateConversation}
        onSelectConversation={(id) => {
          loadConversation(id);
          setSidebarOpen(false);
        }}
        conversations={conversations}
        activeConversationId={activeConversationId}
        isPrivate={isPrivate}
        isStreaming={isStreaming}
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

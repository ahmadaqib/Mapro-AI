import type { ConversationSummary } from '../types';

interface Props {
  onReset: () => void;
  onNewConversation: () => void;
  onPrivateConversation: () => void;
  onSelectConversation: (id: string) => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isPrivate: boolean;
  isStreaming: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

export function Sidebar({
  onReset,
  onNewConversation,
  onPrivateConversation,
  onSelectConversation,
  conversations,
  activeConversationId,
  isPrivate,
  isStreaming,
  isOpen,
  onToggle,
}: Props) {
  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        ☰
      </button>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onToggle}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">MAPRO</div>
          <div className="tagline">AI Debater · Bahasa Indonesia</div>
        </div>
        <div className="sidebar-actions">
          <button className="primary-sidebar-btn" onClick={onNewConversation} disabled={isStreaming}>
            + Percakapan baru
          </button>
          <button
            className={`private-sidebar-btn ${isPrivate ? 'active' : ''}`}
            onClick={onPrivateConversation}
            disabled={isStreaming}
          >
            Mode privat
          </button>
        </div>
        <div className="divider" />
        <div className="conversation-list" aria-label="Daftar percakapan tersimpan">
          {isPrivate && (
            <div className="private-session-pill">
              <span>Privat sementara</span>
              <small>Tidak disimpan</small>
            </div>
          )}
          {conversations.length === 0 && !isPrivate && (
            <p className="conversation-empty">Belum ada percakapan tersimpan.</p>
          )}
          {conversations.map(conversation => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === activeConversationId && !isPrivate ? 'active' : ''}`}
              onClick={() => onSelectConversation(conversation.id)}
              disabled={isStreaming}
            >
              <span className="conversation-title">{conversation.title}</span>
              <span className="conversation-meta">
                {formatTime(conversation.updatedAt)}
                {conversation.messageCount > 0 ? ` · ${conversation.messageCount} pesan` : ''}
              </span>
              {conversation.preview && (
                <span className="conversation-preview">{conversation.preview}</span>
              )}
            </button>
          ))}
        </div>
        <div className="divider" />
        <button className="reset-btn" onClick={onReset} disabled={isStreaming}>
          ↺ &nbsp;Reset percakapan ini
        </button>
      </aside>
    </>
  );
}

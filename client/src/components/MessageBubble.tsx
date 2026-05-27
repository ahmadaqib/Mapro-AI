import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReasoningBlock } from './ReasoningBlock';
import type { DisplayMessage } from '../types';

interface Props { message: DisplayMessage; }

function downloadMd(content: string) {
  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mapro-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const canDownload = !isUser && !message.isStreaming && message.content.trim().length > 80;

  return (
    <div className={`msg-wrapper ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <ReasoningBlock text={message.reasoning} isStreaming={message.isStreaming} />
      )}
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        {!isUser && <span className="mapro-label">Mapro</span>}

        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && !message.content && (
              <span className="cursor">▍</span>
            )}
          </div>
        )}
      </div>

      {canDownload && (
        <button
          className="artifact-btn"
          onClick={() => downloadMd(message.content)}
          title="Simpan sebagai file Markdown"
        >
          <span className="artifact-icon">↓</span>
          Simpan .md
        </button>
      )}
    </div>
  );
}

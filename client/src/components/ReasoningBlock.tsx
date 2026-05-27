import { useState } from 'react';

interface Props {
  text: string;
  isStreaming: boolean;
}

export function ReasoningBlock({ text, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!text && !isStreaming) return null;

  return (
    <div className="reasoning-block">
      <button className="reasoning-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="reasoning-toggle-label">
          <span className={`reasoning-dot ${isStreaming ? 'streaming' : ''}`} />
          {isStreaming ? 'Berpikir...' : 'Proses berpikir'}
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && text && (
        <pre className="reasoning-body">{text}</pre>
      )}
    </div>
  );
}

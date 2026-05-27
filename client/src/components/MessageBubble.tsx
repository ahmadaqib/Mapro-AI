import { ReasoningBlock } from './ReasoningBlock';
import type { DisplayMessage } from '../types';

interface Props { message: DisplayMessage; }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={`msg-wrapper ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <ReasoningBlock text={message.reasoning} isStreaming={message.isStreaming} />
      )}
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        {!isUser && <span className="mapro-label">Mapro</span>}
        <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        {message.isStreaming && !message.content && (
          <span className="cursor">▍</span>
        )}
      </div>
    </div>
  );
}

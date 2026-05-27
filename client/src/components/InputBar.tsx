import { useState, useRef, type KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const onInput = () => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  };

  return (
    <div className="input-bar">
      <textarea
        ref={ref}
        className="input-textarea"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        placeholder="Tulis pesan…  (Enter kirim · Shift+Enter baris baru)"
        disabled={disabled}
        rows={1}
      />
      <button
        className={`send-btn${disabled ? ' streaming' : ''}`}
        onClick={submit}
        disabled={disabled || !value.trim()}
        title="Kirim"
      >
        {disabled ? '↻' : '↑'}
      </button>
    </div>
  );
}

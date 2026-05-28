import { useState, useRef, type KeyboardEvent } from 'react';
import type { ExtractedFile, FileContext } from '../types';

const API = 'http://localhost:3000';

interface Props {
  onSend: (text: string, fileContext?: FileContext) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const [attachedFile, setAttachedFile] = useState<ExtractedFile | null>(null);
  const [fileError, setFileError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const text = value.trim() || (attachedFile ? 'Analisis file ini secara kritis dan berikan rekomendasi perbaikannya.' : '');
    if (!text || disabled || isUploading) return;

    const fileContext = attachedFile
      ? { name: attachedFile.name, text: attachedFile.text }
      : undefined;

    onSend(text, fileContext);
    setValue('');
    setAttachedFile(null);
    setFileError('');
    if (fileRef.current) fileRef.current.value = '';
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

  const uploadFile = async (file: File) => {
    setFileError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API}/api/files/extract`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as ExtractedFile | { message?: string };

      if (!response.ok) {
        throw new Error('message' in data ? data.message : 'Gagal membaca file.');
      }

      setAttachedFile(data as ExtractedFile);
    } catch (err) {
      setAttachedFile(null);
      setFileError(err instanceof Error ? err.message : 'Gagal membaca file.');
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="input-bar">
      <div className="input-main">
        {attachedFile && (
          <div className="file-chip">
            <span className="file-chip-name">{attachedFile.name}</span>
            <span className="file-chip-meta">
              {attachedFile.truncated ? 'dipotong' : 'siap'} · {attachedFile.charCount.toLocaleString('id-ID')} karakter
            </span>
            <button
              className="file-chip-remove"
              onClick={() => {
                setAttachedFile(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              disabled={disabled || isUploading}
              title="Hapus lampiran"
            >
              ×
            </button>
          </div>
        )}
        {fileError && <div className="file-error">{fileError}</div>}
        <textarea
          ref={ref}
          className="input-textarea"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          placeholder="Tulis pesan…  (Enter kirim · Shift+Enter baris baru)"
          disabled={disabled || isUploading}
          rows={1}
        />
      </div>
      <input
        ref={fileRef}
        className="file-input"
        type="file"
        accept=".docx,.txt,.md"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <button
        className="attach-btn"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || isUploading}
        title="Upload file .docx, .txt, atau .md"
      >
        {isUploading ? '…' : '+'}
      </button>
      <button
        className={`send-btn${disabled ? ' streaming' : ''}`}
        onClick={submit}
        disabled={disabled || isUploading || (!value.trim() && !attachedFile)}
        title="Kirim"
      >
        {disabled ? '↻' : '↑'}
      </button>
    </div>
  );
}

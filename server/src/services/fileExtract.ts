import mammoth from 'mammoth';

const MAX_EXTRACTED_CHARS = 18000;

export interface ExtractedFile {
  name: string;
  mimeType: string;
  text: string;
  charCount: number;
  truncated: boolean;
}

function extensionOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function limitText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: text.slice(0, MAX_EXTRACTED_CHARS).trimEnd(),
    truncated: true,
  };
}

export async function extractTextFromFile(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<ExtractedFile> {
  const ext = extensionOf(filename);
  let rawText = '';

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value;
  } else if (ext === 'txt' || ext === 'md') {
    rawText = buffer.toString('utf-8');
  } else {
    throw new Error('Format file belum didukung. Gunakan .docx, .txt, atau .md.');
  }

  const normalized = normalizeText(rawText);
  if (!normalized) {
    throw new Error('Tidak ada teks yang bisa diekstrak dari file ini.');
  }

  const limited = limitText(normalized);
  return {
    name: filename,
    mimeType,
    text: limited.text,
    charCount: normalized.length,
    truncated: limited.truncated,
  };
}

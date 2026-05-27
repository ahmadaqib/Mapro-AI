import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Message } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = process.env.HISTORY_FILE_OVERRIDE
  ?? path.resolve(__dirname, '../../../history.json');

export function loadHistory(): Message[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed as Message[];
    }
  } catch {
    // corrupt — return empty
  }
  return [];
}

export function appendHistory(userMessage: string, assistantReply: string): void {
  const history = loadHistory();
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: assistantReply });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

export function resetHistory(): void {
  fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
}

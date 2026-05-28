import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tulis ulang HISTORY_FILE path ke temp file untuk isolasi test
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, '__test_history__.json');

// Override env sebelum import service
process.env.HISTORY_FILE_OVERRIDE = TEST_FILE;

const {
  appendHistory,
  createStoredConversation,
  getConversation,
  listConversations,
  loadHistory,
  resetHistory,
} = await import('./history.js');

describe('history service', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('loadHistory returns [] when file does not exist', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('appendHistory saves user + assistant messages', () => {
    const conversation = appendHistory('halo', 'hai balik');
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ role: 'user', content: 'halo' });
    expect(h[1]).toEqual({ role: 'assistant', content: 'hai balik' });
    expect(conversation.title).toBe('halo');
  });

  it('resetHistory clears all messages', () => {
    const conversation = appendHistory('halo', 'hai');
    resetHistory();
    expect(loadHistory()).toEqual([]);
    expect(getConversation(conversation.id)?.messages).toEqual([]);
  });

  it('loadHistory returns [] when file is corrupt JSON', () => {
    fs.writeFileSync(TEST_FILE, 'INVALID JSON', 'utf-8');
    expect(loadHistory()).toEqual([]);
  });

  it('creates and lists separate conversations', () => {
    const first = createStoredConversation();
    appendHistory('topik A', 'jawaban A', first.id);

    const second = createStoredConversation();
    appendHistory('topik B', 'jawaban B', second.id);

    const summaries = listConversations();
    expect(summaries).toHaveLength(2);
    expect(summaries[0].title).toBe('topik B');
    expect(summaries[1].title).toBe('topik A');
    expect(getConversation(first.id)?.messages).toHaveLength(2);
    expect(getConversation(second.id)?.messages).toHaveLength(2);
  });

  it('reads legacy array history as one conversation', () => {
    fs.writeFileSync(TEST_FILE, JSON.stringify([
      { role: 'user', content: 'legacy question' },
      { role: 'assistant', content: 'legacy answer' },
    ]), 'utf-8');

    expect(loadHistory()).toHaveLength(2);
    expect(listConversations()).toHaveLength(1);
    expect(listConversations()[0].title).toBe('legacy question');
  });
});

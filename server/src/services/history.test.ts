import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tulis ulang HISTORY_FILE path ke temp file untuk isolasi test
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, '__test_history__.json');

// Override env sebelum import service
process.env.HISTORY_FILE_OVERRIDE = TEST_FILE;

const { loadHistory, appendHistory, resetHistory } = await import('./history.js');

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
    appendHistory('halo', 'hai balik');
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ role: 'user', content: 'halo' });
    expect(h[1]).toEqual({ role: 'assistant', content: 'hai balik' });
  });

  it('resetHistory clears all messages', () => {
    appendHistory('halo', 'hai');
    resetHistory();
    expect(loadHistory()).toEqual([]);
  });

  it('loadHistory returns [] when file is corrupt JSON', () => {
    fs.writeFileSync(TEST_FILE, 'INVALID JSON', 'utf-8');
    expect(loadHistory()).toEqual([]);
  });
});

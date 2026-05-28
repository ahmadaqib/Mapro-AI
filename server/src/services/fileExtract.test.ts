import { describe, expect, it } from 'vitest';
import { extractTextFromFile } from './fileExtract.js';

describe('file extraction service', () => {
  it('extracts text from plain text files', async () => {
    const result = await extractTextFromFile(
      'cv.txt',
      'text/plain',
      Buffer.from('Nama: Aqib\nSkill: React, Node.js', 'utf-8'),
    );

    expect(result.name).toBe('cv.txt');
    expect(result.text).toContain('Skill: React');
    expect(result.truncated).toBe(false);
  });

  it('rejects unsupported file formats', async () => {
    await expect(
      extractTextFromFile('cv.doc', 'application/msword', Buffer.from('test')),
    ).rejects.toThrow('Format file belum didukung');
  });
});

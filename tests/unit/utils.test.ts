import { describe, it, expect } from 'vitest';
import { generateId, hashContent, detectLanguage, isTextFile, chunkText, truncateString, formatBytes, formatDuration, sleep } from '@/shared/utils';

describe('Shared Utilities', () => {
  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('includes prefix when provided', () => {
      const id = generateId('test');
      expect(id.startsWith('test_')).toBe(true);
    });
  });

  describe('hashContent', () => {
    it('produces consistent hashes', () => {
      const hash1 = hashContent('hello world');
      const hash2 = hashContent('hello world');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different content', () => {
      const hash1 = hashContent('hello');
      const hash2 = hashContent('world');
      expect(hash1).not.toBe(hash2);
    });

    it('returns 16 character hex string', () => {
      const hash = hashContent('test');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('detectLanguage', () => {
    it('detects TypeScript files', () => {
      expect(detectLanguage('test.ts')).toBe('typescript');
      expect(detectLanguage('test.tsx')).toBe('typescript');
    });

    it('detects JavaScript files', () => {
      expect(detectLanguage('test.js')).toBe('javascript');
      expect(detectLanguage('test.jsx')).toBe('javascript');
    });

    it('detects common languages', () => {
      expect(detectLanguage('test.py')).toBe('python');
      expect(detectLanguage('test.rs')).toBe('rust');
      expect(detectLanguage('test.go')).toBe('go');
      expect(detectLanguage('test.md')).toBe('markdown');
      expect(detectLanguage('test.json')).toBe('json');
    });

    it('returns text for unknown extensions', () => {
      expect(detectLanguage('test.xyz')).toBe('text');
      expect(detectLanguage('README')).toBe('text');
    });
  });

  describe('isTextFile', () => {
    it('returns true for known text extensions', () => {
      expect(isTextFile('test.ts')).toBe(true);
      expect(isTextFile('test.js')).toBe(true);
      expect(isTextFile('test.md')).toBe(true);
      expect(isTextFile('test.py')).toBe(true);
    });

    it('returns false for binary extensions', () => {
      expect(isTextFile('test.png')).toBe(false);
      expect(isTextFile('test.jpg')).toBe(false);
      expect(isTextFile('test.exe')).toBe(false);
      expect(isTextFile('test.pdf')).toBe(false);
    });
  });

  describe('chunkText', () => {
    it('chunks text into overlapping segments', () => {
      const content = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10';
      const chunks = chunkText(content, 5, 2, 'test.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(5);
      expect(chunks[1].startLine).toBe(4); // 5 - 2 + 1 = 4 (overlap)
    });

    it('handles content smaller than chunk size', () => {
      const content = 'line1\nline2';
      const chunks = chunkText(content, 10, 2, 'test.ts', 'typescript');

      expect(chunks.length).toBe(1);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(2);
    });

    it('skips empty chunks', () => {
      const content = 'line1\n\n\nline2';
      const chunks = chunkText(content, 2, 1, 'test.ts', 'typescript');

      // Should only have non-empty chunks
      for (const chunk of chunks) {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('truncateString', () => {
    it('returns original string if shorter than max', () => {
      expect(truncateString('hello', 10)).toBe('hello');
    });

    it('truncates and adds ellipsis', () => {
      expect(truncateString('hello world', 8)).toBe('hello...');
    });

    it('handles exact length', () => {
      expect(truncateString('hello', 5)).toBe('hello');
    });
  });

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(65000)).toBe('1m 5.0s');
      expect(formatDuration(125000)).toBe('2m 5.0s');
    });
  });

  describe('sleep', () => {
    it('resolves after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
    });
  });
});
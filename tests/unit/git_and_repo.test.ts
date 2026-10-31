import { describe, it, expect } from 'vitest';
import { findGitRoot } from '@/core/repository';
import { getBlame } from '@/core/git';
import { chunkText } from '@/shared/utils';
import { resolve, join } from 'node:path';

describe('Repository & Git Layer', () => {
  it('findGitRoot finds true git root from subdirectories', async () => {
    const cwd = process.cwd();
    const subDir = join(cwd, 'src', 'cli');
    const root = await findGitRoot(subDir);
    expect(root).toBe(resolve(cwd));
  });

  it('chunkText handles chunkSize <= overlap safely without infinite loop', () => {
    const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
    // Edge case: chunkSize <= overlap
    const chunks = chunkText(content, 2, 2, 'test.ts', 'typescript');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.filePath).toBe('test.ts');
  });

  it('chunkText normalizes file paths to POSIX', () => {
    const content = 'console.log("hello");';
    const chunks = chunkText(content, 10, 2, 'src\\features\\auth.ts', 'typescript');
    expect(chunks[0]?.filePath).toBe('src/features/auth.ts');
  });

  it('getBlame correctly captures current file line numbers and authors', async () => {
    const cwd = process.cwd();
    const blameResult = await getBlame(cwd, 'package.json', 1, 5);
    expect(blameResult.filePath).toBe('package.json');
    expect(blameResult.lines.length).toBeGreaterThan(0);
    // Line numbers should be 1, 2, 3, 4, 5
    expect(blameResult.lines[0]?.lineNumber).toBe(1);
    expect(blameResult.lines[0]?.commitHash).toMatch(/^[0-9a-f]{40}$/);
    expect(blameResult.lines[0]?.author).toBeTruthy();
  });
});

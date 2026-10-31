import { describe, it, expect } from 'vitest';
import { parseEvidenceReferences, validateEvidence } from '@/core/evidence';
import { RepositoryIndex, CodeChunk, GitCommit } from '@/shared/types';

describe('Evidence & Citation System', () => {
  const dummyChunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/features/auth.ts',
      startLine: 10,
      endLine: 40,
      content: 'export function authenticate() {}',
      language: 'typescript',
    },
    {
      id: 'chunk-2',
      filePath: 'src/utils/token.ts',
      startLine: 1,
      endLine: 25,
      content: 'export function signToken() {}',
      language: 'typescript',
    },
  ];

  const dummyCommits: GitCommit[] = [
    {
      hash: 'a1b2c3d4e5f678901234567890abcdef12345678',
      shortHash: 'a1b2c3d',
      author: 'Test Dev',
      date: '2026-01-01T00:00:00Z',
      message: 'Initial auth implementation',
      changedFiles: ['src/features/auth.ts'],
    },
  ];

  const dummyIndex: RepositoryIndex = {
    metadata: {
      id: 'test-repo',
      rootPath: 'D:/Projects/test',
      name: 'test',
      indexedAt: new Date().toISOString(),
      headCommit: 'a1b2c3d4e5f678901234567890abcdef12345678',
      totalFiles: 2,
      totalChunks: 2,
      totalSymbols: 2,
      totalCommits: 1,
      version: 1,
    },
    files: [
      {
        path: 'src/features/auth.ts',
        language: 'typescript',
        size: 500,
        hash: 'hash1',
        lastModified: Date.now(),
        symbols: [],
      },
      {
        path: 'src/utils/token.ts',
        language: 'typescript',
        size: 300,
        hash: 'hash2',
        lastModified: Date.now(),
        symbols: [],
      },
    ],
    chunks: dummyChunks,
    symbols: [],
    commits: dummyCommits,
  };

  it('parses inline citations [S1] and [G1] from model output', () => {
    const text = 'According to [S1], authentication is handled here. Also see commit [G1] by the team.';
    const refs = parseEvidenceReferences(text, {
      codeChunks: dummyChunks,
      commits: dummyCommits,
    });

    expect(refs.length).toBe(2);
    const sourceRef = refs.find(r => r.type === 'source');
    expect(sourceRef?.path).toBe('src/features/auth.ts');
    expect(sourceRef?.startLine).toBe(10);
    expect(sourceRef?.endLine).toBe(40);

    const commitRef = refs.find(r => r.type === 'commit');
    expect(commitRef?.commitHash).toBe(dummyCommits[0]?.hash);
  });

  it('validates evidence references against the repository index', () => {
    const text = 'Reference to src/features/auth.ts:15-30 and commit a1b2c3d.';
    const refs = parseEvidenceReferences(text);
    const validation = validateEvidence(refs, dummyIndex);

    expect(validation.validCount).toBe(2);
    expect(validation.invalidCount).toBe(0);
    expect(validation.sourceReferences[0]?.valid).toBe(true);
    expect(validation.commitReferences[0]?.valid).toBe(true);
  });

  it('invalidates non-existent files or invalid line numbers', () => {
    const text = 'Reference to src/nonexistent.ts:10 and src/features/auth.ts:999';
    const refs = parseEvidenceReferences(text);
    const validation = validateEvidence(refs, dummyIndex);

    expect(validation.invalidCount).toBe(2);
    expect(validation.validCount).toBe(0);
  });
});

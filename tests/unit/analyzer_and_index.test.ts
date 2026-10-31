import { describe, it, expect, afterAll } from 'vitest';
import { analyzeFile } from '@/core/analyzer';
import { getCommitHistory } from '@/core/git';
import { createRepositoryIndex, buildSearchIndexes } from '@/core/indexer';
import { OllamaProvider } from '@/core/llm/ollama.provider';
import { IndexingConfig } from '@/shared/types';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const defaultConfig: IndexingConfig = {
  maxFileSize: 1024 * 1024,
  maxTotalFiles: 5000,
  includeExtensions: ['.ts', '.py', '.go', '.rs'],
  excludePatterns: ['node_modules/**'],
  chunkSize: 50,
  chunkOverlap: 10,
};

describe('Analyzer Polyglot & Arrow Function Support', () => {
  const tempDir = join(tmpdir(), 'reposeance-test-analyzer');
  const tempFiles: string[] = [];

  async function createTempFile(name: string, content: string): Promise<string> {
    await mkdir(tempDir, { recursive: true });
    const fullPath = join(tempDir, name);
    await writeFile(fullPath, content, 'utf-8');
    tempFiles.push(fullPath);
    return fullPath;
  }

  afterAll(async () => {
    for (const f of tempFiles) {
      try {
        await unlink(f);
      } catch {
        // ignore
      }
    }
  });

  it('extracts TypeScript arrow functions, imports, and exports', async () => {
    const tsCode = `
import { readFile } from 'fs';
import defaultVal, { named1, named2 } from './other';

export const handleRequest = async (req: Request) => {
  return true;
};

export class SessionService {
  login() {}
}

export default function startApp() {}
`;
    const filePath = await createTempFile('sample.ts', tsCode);
    const result = await analyzeFile(
      {
        path: filePath,
        relativePath: 'sample.ts',
        language: 'typescript',
        size: tsCode.length,
        hash: 'hash-ts',
        lastModified: Date.now(),
      },
      defaultConfig,
    );

    const symbolNames = result.symbols.map(s => s.name);
    expect(symbolNames).toContain('handleRequest');
    expect(symbolNames).toContain('SessionService');
    expect(symbolNames).toContain('startApp');

    expect(result.imports.length).toBe(2);
    expect(result.imports.some(i => i.moduleSpecifier === 'fs')).toBe(true);

    const exportNames = result.exports.map(e => e.name);
    expect(exportNames).toContain('handleRequest');
    expect(exportNames).toContain('SessionService');
  });

  it('extracts Python def functions and classes', async () => {
    const pyCode = `
import os
from math import sqrt

class NeuralNetwork:
    def __init__(self, layers):
        self.layers = layers

def train_model(data, epochs=10):
    pass
`;
    const filePath = await createTempFile('sample.py', pyCode);
    const result = await analyzeFile(
      {
        path: filePath,
        relativePath: 'sample.py',
        language: 'python',
        size: pyCode.length,
        hash: 'hash-py',
        lastModified: Date.now(),
      },
      defaultConfig,
    );

    const symbolNames = result.symbols.map(s => s.name);
    expect(symbolNames).toContain('NeuralNetwork');
    expect(symbolNames).toContain('__init__');
    expect(symbolNames).toContain('train_model');
  });

  it('extracts Go func, type, and struct symbols', async () => {
    const goCode = `
package main

type Config struct {
    Port int
}

func NewConfig() *Config {
    return &Config{Port: 8080}
}
`;
    const filePath = await createTempFile('sample.go', goCode);
    const result = await analyzeFile(
      {
        path: filePath,
        relativePath: 'sample.go',
        language: 'go',
        size: goCode.length,
        hash: 'hash-go',
        lastModified: Date.now(),
      },
      defaultConfig,
    );

    const symbolNames = result.symbols.map(s => s.name);
    expect(symbolNames).toContain('Config');
    expect(symbolNames).toContain('NewConfig');
  });

  it('extracts Rust fn, struct, and impl symbols', async () => {
    const rsCode = `
pub struct UserSession {
    pub id: String,
}

impl UserSession {
    pub fn new(id: String) -> Self {
        Self { id }
    }
}

pub fn validate_token(token: &str) -> bool {
    true
}
`;
    const filePath = await createTempFile('sample.rs', rsCode);
    const result = await analyzeFile(
      {
        path: filePath,
        relativePath: 'sample.rs',
        language: 'rust',
        size: rsCode.length,
        hash: 'hash-rs',
        lastModified: Date.now(),
      },
      defaultConfig,
    );

    const symbolNames = result.symbols.map(s => s.name);
    expect(symbolNames).toContain('UserSession');
    expect(symbolNames).toContain('validate_token');
  });
});

describe('Git Commit History with Changed Files', () => {
  it('correctly parses git commits and populates changedFiles', async () => {
    const cwd = process.cwd();
    const commits = await getCommitHistory(cwd, 5);
    expect(commits.length).toBeGreaterThan(0);

    const firstCommit = commits[0]!;
    expect(firstCommit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(firstCommit.shortHash).toHaveLength(7);
    expect(firstCommit.author).toBeTruthy();
    expect(firstCommit.message).toBeTruthy();
    expect(Array.isArray(firstCommit.changedFiles)).toBe(true);
    expect(firstCommit.changedFiles.length).toBeGreaterThan(0);
  });
});

describe('MiniSearch Indexing & Changed Files Search', () => {
  it('indexes commits and allows searching by changed file name', async () => {
    const mockCommits = [
      {
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        shortHash: 'aaaaaaa',
        author: 'Archaeologist',
        date: new Date().toISOString(),
        message: 'fix(auth): update session tokens',
        body: 'Details about auth fix',
        changedFiles: ['src/features/auth/session.ts', 'src/shared/types.ts'],
      },
      {
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        shortHash: 'bbbbbbb',
        author: 'Developer',
        date: new Date().toISOString(),
        message: 'feat(doctor): add disk space checks',
        body: 'Details about doctor checks',
        changedFiles: ['src/cli/commands/doctor.command.ts'],
      },
    ];

    const repoIndex = await createRepositoryIndex(
      join(tmpdir(), 'test-repo-' + Date.now()),
      defaultConfig,
      [],
      [],
      [],
      mockCommits,
    );

    const indexes = await buildSearchIndexes(repoIndex);
    const searchResults = indexes.commitIndex.search('session.ts');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0]?.id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    const searchResults2 = indexes.commitIndex.search('doctor.command.ts');
    expect(searchResults2.length).toBeGreaterThan(0);
    expect(searchResults2[0]?.id).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });
});

describe('Ollama Model Matching Precision', () => {
  it('does not falsely prefix-match gemma2 to gemma', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'gemma:latest',
      timeout: 1000,
    });

    // Mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        models: [{ name: 'gemma2:9b' }, { name: 'llama3:8b' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      // User asks for "gemma" - should NOT match "gemma2:9b"
      const hasGemma = await provider.checkModel('gemma');
      expect(hasGemma).toBe(false);

      // User asks for "gemma2" - SHOULD match "gemma2:9b"
      const hasGemma2 = await provider.checkModel('gemma2');
      expect(hasGemma2).toBe(true);

      // User asks for "llama3:8b" - SHOULD match exact
      const hasLlama3 = await provider.checkModel('llama3:8b');
      expect(hasLlama3).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

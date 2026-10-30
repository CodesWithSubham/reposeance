import { describe, it, expect } from 'vitest';
import {
  RepositoryMetadataSchema,
  CodeChunkSchema,
  GitCommitSchema,
  OllamaConfigSchema,
  IndexingConfigSchema,
  RetrievalConfigSchema,
  CLIConfigSchema,
  ReposeanceConfigSchema,
} from '@/shared/schemas';

describe('Zod Schemas', () => {
  describe('RepositoryMetadataSchema', () => {
    it('validates correct metadata', () => {
      const data = {
        id: 'repo_123',
        rootPath: '/path/to/repo',
        name: 'my-repo',
        indexedAt: '2026-01-15T10:30:00.000Z',
        headCommit: 'abc123def456',
        totalFiles: 100,
        totalChunks: 500,
        version: 1,
      };
      const result = RepositoryMetadataSchema.parse(data);
      expect(result).toEqual(data);
    });

    it('rejects invalid data', () => {
      const data = {
        id: 'repo_123',
        rootPath: '/path/to/repo',
        name: 'my-repo',
        indexedAt: 'invalid-date',
        headCommit: 'abc123def456',
        totalFiles: 100,
        totalChunks: 500,
        version: 1,
      };
      expect(() => RepositoryMetadataSchema.parse(data)).toThrow();
    });
  });

  describe('CodeChunkSchema', () => {
    it('validates correct chunk', () => {
      const data = {
        id: 'chunk_123',
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 50,
        content: 'export function main() {}',
        language: 'typescript',
        symbolName: 'main',
        symbolType: 'function',
      };
      const result = CodeChunkSchema.parse(data);
      expect(result).toEqual(data);
    });

    it('allows optional fields to be omitted', () => {
      const data = {
        id: 'chunk_123',
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 50,
        content: 'export function main() {}',
        language: 'typescript',
      };
      const result = CodeChunkSchema.parse(data);
      expect(result.symbolName).toBeUndefined();
      expect(result.symbolType).toBeUndefined();
    });
  });

  describe('GitCommitSchema', () => {
    it('validates correct commit', () => {
      const data = {
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        author: 'John Doe',
        date: '2026-01-15T10:30:00.000Z',
        message: 'Add authentication module',
        changedFiles: ['src/auth.ts', 'src/auth.test.ts'],
      };
      const result = GitCommitSchema.parse(data);
      expect(result).toEqual(data);
    });
  });

  describe('OllamaConfigSchema', () => {
    it('validates with defaults', () => {
      const data = {};
      const result = OllamaConfigSchema.parse(data);
      expect(result.baseUrl).toBe('http://localhost:11434');
      expect(result.model).toBe('gemma3:1b');
      expect(result.timeout).toBe(120000);
    });

    it('validates custom values', () => {
      const data = {
        baseUrl: 'http://localhost:11435',
        model: 'gemma3:4b',
        timeout: 60000,
      };
      const result = OllamaConfigSchema.parse(data);
      expect(result).toEqual(data);
    });
  });

  describe('IndexingConfigSchema', () => {
    it('validates with defaults', () => {
      const data = {};
      const result = IndexingConfigSchema.parse(data);
      expect(result.maxFileSize).toBe(1024 * 1024);
      expect(result.maxTotalFiles).toBe(10000);
      expect(result.chunkSize).toBe(80);
      expect(result.chunkOverlap).toBe(20);
      expect(result.excludedPatterns).toContain('node_modules/**');
    });
  });

  describe('RetrievalConfigSchema', () => {
    it('validates with defaults', () => {
      const data = {};
      const result = RetrievalConfigSchema.parse(data);
      expect(result.maxCodeChunks).toBe(10);
      expect(result.maxSymbols).toBe(20);
      expect(result.maxCommits).toBe(10);
      expect(result.maxContextTokens).toBe(8000);
    });
  });

  describe('CLIConfigSchema', () => {
    it('validates with defaults', () => {
      const data = {};
      const result = CLIConfigSchema.parse(data);
      expect(result.theme).toBe('auto');
      expect(result.verbose).toBe(false);
      expect(result.jsonOutput).toBe(false);
    });
  });

  describe('ReposeanceConfigSchema', () => {
    it('validates complete config with defaults', () => {
      const data = {
        ollama: {},
        indexing: {},
        retrieval: {},
        cli: {},
      };
      const result = ReposeanceConfigSchema.parse(data);
      expect(result.ollama.model).toBe('gemma3:1b');
      expect(result.indexing.chunkSize).toBe(80);
      expect(result.retrieval.maxCodeChunks).toBe(10);
      expect(result.cli.theme).toBe('auto');
    });

    it('validates complete custom config', () => {
      const data = {
        ollama: { baseUrl: 'http://localhost:11435', model: 'llama3', timeout: 30000 },
        indexing: { maxFileSize: 2048, maxTotalFiles: 5000, chunkSize: 100, chunkOverlap: 10, excludedPatterns: [], includedExtensions: ['.ts'] },
        retrieval: { maxCodeChunks: 5, maxSymbols: 10, maxCommits: 5, maxContextTokens: 4000, codeWeight: 1, symbolWeight: 2, commitWeight: 1, fileWeight: 1 },
        cli: { theme: 'dark', verbose: true, jsonOutput: true },
      };
      const result = ReposeanceConfigSchema.parse(data);
      expect(result.ollama.model).toBe('llama3');
      expect(result.cli.theme).toBe('dark');
    });
  });
});
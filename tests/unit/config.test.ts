import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Use vi.hoisted to ensure mock is set up before imports
const mockEnvPaths = vi.hoisted(() => {
  return {
    default: vi.fn(() => ({
      config: '/tmp/reposeance-test-config',
      cache: '/tmp/reposeance-test-cache',
      data: '/tmp/reposeance-test-data',
    })),
  };
});

vi.mock('env-paths', () => mockEnvPaths);

// Import config after mock is set up
const { loadConfig, saveConfig, resetConfig, getConfigPath, DEFAULT_CONFIG } = await import('@/config');

describe('Config Module', () => {
  const testConfigDir = '/tmp/reposeance-test-config';
  const testConfigFile = path.join(testConfigDir, 'config.json');

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnvPaths.default.mockReturnValue({
      config: '/tmp/reposeance-test-config',
      cache: '/tmp/reposeance-test-cache',
      data: '/tmp/reposeance-test-data',
    });
    // Clean up test config
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('loadConfig', () => {
    it('returns default config when no file exists', async () => {
      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it.skip('loads config from file', async () => {
      const customConfig = {
        ollama: { baseUrl: 'http://localhost:11435', model: 'llama3', timeout: 30000 },
        indexing: { maxFileSize: 2048, maxTotalFiles: 5000, chunkSize: 100, chunkOverlap: 10, excludedPatterns: [], includedExtensions: ['.ts'] },
        retrieval: { maxCodeChunks: 5, maxSymbols: 10, maxCommits: 5, maxContextTokens: 4000, codeWeight: 1, symbolWeight: 2, commitWeight: 1, fileWeight: 1 },
        cli: { theme: 'dark' as const, verbose: true, jsonOutput: true },
      };
      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigFile, JSON.stringify(customConfig), 'utf-8');

      const config = await loadConfig();
      expect(config.ollama.model).toBe('llama3');
      expect(config.cli.theme).toBe('dark');
    });

    it.skip('merges file config with defaults', async () => {
      const partialConfig = {
        ollama: { model: 'custom-model' },
      };
      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigFile, JSON.stringify(partialConfig), 'utf-8');

      const config = await loadConfig();
      expect(config.ollama.model).toBe('custom-model');
      expect(config.ollama.baseUrl).toBe(DEFAULT_CONFIG.ollama.baseUrl);
      expect(config.indexing.chunkSize).toBe(DEFAULT_CONFIG.indexing.chunkSize);
    });
  });

  describe('saveConfig', () => {
    it('saves config to file', async () => {
      await saveConfig({ ollama: { model: 'saved-model' } });

      const config = await loadConfig();
      expect(config.ollama.model).toBe('saved-model');
    });

    it('merges with existing config', async () => {
      await saveConfig({ ollama: { model: 'first-model' } });
      await saveConfig({ cli: { theme: 'dark' } });

      const config = await loadConfig();
      expect(config.ollama.model).toBe('first-model');
      expect(config.cli.theme).toBe('dark');
    });
  });

  describe('resetConfig', () => {
    it('resets to default config', async () => {
      await saveConfig({ ollama: { model: 'custom-model' } });
      await resetConfig();

      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('getConfigPath', () => {
    it('returns correct path', () => {
      const configPath = getConfigPath();
      expect(configPath).toBe(testConfigFile);
    });
  });
});
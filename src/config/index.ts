import envPaths from 'env-paths';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ReposeanceConfigSchema, ReposeanceConfig } from '../shared/schemas';
import { handleError } from '../shared/errors';

const paths = envPaths('reposeance', { suffix: '' });
const CONFIG_FILE = join(paths.config, 'config.json');

const DEFAULT_CONFIG: ReposeanceConfig = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:1b',
    timeout: 120000,
  },
  indexing: {
    maxFileSize: 1024 * 1024,
    maxTotalFiles: 10000,
    chunkSize: 80,
    chunkOverlap: 20,
    excludedPatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '*.log',
      '.env*',
      '*.key',
      '*.pem',
      '*.cert',
      '*.crt',
      '*.p12',
      '*.pfx',
    ],
    includedExtensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
      '.md',
      '.txt',
      '.yml',
      '.yaml',
      '.toml',
      '.py',
      '.rs',
      '.go',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.php',
      '.rb',
      '.swift',
      '.kt',
      '.scala',
      '.clj',
      '.hs',
      '.ml',
      '.fs',
      '.vim',
      '.lua',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.ps1',
      '.bat',
      '.cmd',
      '.dockerfile',
      '.gitignore',
      '.gitattributes',
    ],
  },
  retrieval: {
    maxCodeChunks: 10,
    maxSymbols: 20,
    maxCommits: 10,
    maxContextTokens: 8000,
    codeWeight: 1.0,
    symbolWeight: 1.5,
    commitWeight: 0.8,
    fileWeight: 0.5,
  },
  cli: {
    theme: 'auto',
    verbose: false,
    jsonOutput: false,
  },
};

let cachedConfig: ReposeanceConfig | null = null;

export async function loadConfig(): Promise<ReposeanceConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const configContent = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(configContent);
    const merged = deepMerge(DEFAULT_CONFIG, parsed);
    const validated = ReposeanceConfigSchema.parse(merged);
    cachedConfig = validated;
    return cachedConfig;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      cachedConfig = DEFAULT_CONFIG;
      return cachedConfig;
    }
    handleError(error);
  }
}

export async function saveConfig(config: Partial<ReposeanceConfig>): Promise<void> {
  const current = await loadConfig();
  const merged = deepMerge(current, config);
  const validated = ReposeanceConfigSchema.parse(merged);

  try {
    await mkdir(paths.config, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(validated, null, 2), 'utf-8');
    cachedConfig = validated;
  } catch (error) {
    handleError(error);
  }
}

export async function resetConfig(): Promise<void> {
  try {
    await mkdir(paths.config, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    cachedConfig = DEFAULT_CONFIG;
  } catch (error) {
    handleError(error);
  }
}

export function _resetConfigCache(): void {
  cachedConfig = null;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getCacheDir(): string {
  return paths.cache;
}

export function getDataDir(): string {
  return paths.data;
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }
  return result;
}

export { DEFAULT_CONFIG };
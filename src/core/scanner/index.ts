import { execa } from 'execa';
import ignore from 'ignore';
import { readFile, lstat, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IndexingConfig } from '../../shared/types';
import { isTextFile, detectLanguage, hashFile, normalizePath } from '../../shared/utils';

export interface DiscoveredFile {
  path: string;
  relativePath: string;
  language: string;
  size: number;
  hash: string;
  lastModified: number;
}

export interface ScanResult {
  files: DiscoveredFile[];
  totalScanned: number;
  excluded: ExcludedFile[];
}

export interface ExcludedFile {
  path: string;
  reason: 'ignored' | 'binary' | 'too_large' | 'symlink' | 'sensitive' | 'error';
}

const DEFAULT_EXCLUDED_PATTERNS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  '.git/**',
  '*.log',
  '**/.env*',
  '**/*.key',
  '**/*.pem',
  '**/*.cert',
  '**/*.crt',
  '**/*.p12',
  '**/*.pfx',
  'coverage/**',
  '.nyc_output/**',
  '.cache/**',
  'tmp/**',
  'temp/**',
  '*.tmp',
  '*.temp',
  '.DS_Store',
  'Thumbs.db',
];

const SENSITIVE_PATTERNS = [
  '**/.env*',
  '**/*.key',
  '**/*.pem',
  '**/*.cert',
  '**/*.crt',
  '**/*.p12',
  '**/*.pfx',
  '**/*.pkcs12',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/id_ecdsa*',
  '**/id_dsa*',
  '**/*.ppk',
  '**/.npmrc',
  '**/.netrc',
  '**/.pypirc',
  '**/.aws/**',
  '**/secrets.*',
  '**/credentials.*',
  '**/*.secret',
];

type ProcessFileResult =
  | { discovered: DiscoveredFile; excluded?: never }
  | { discovered?: never; excluded: ExcludedFile };

export async function scanRepository(rootPath: string, config: IndexingConfig): Promise<ScanResult> {
  const ig = await createIgnoreFilter(rootPath, config);
  const gitFiles = await getGitTrackedFiles(rootPath);
  const untrackedFiles = await getUntrackedFiles(rootPath, ig);

  const allFiles = [...new Set([...gitFiles, ...untrackedFiles])];
  const discoveredFiles: DiscoveredFile[] = [];
  const excluded: ExcludedFile[] = [];

  const batchSize = 25;
  for (let i = 0; i < allFiles.length; i += batchSize) {
    if (discoveredFiles.length >= config.maxTotalFiles) {
      break;
    }
    const batch = allFiles.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (file): Promise<ProcessFileResult> => {
        const normalizedRel = normalizePath(file);
        const fullPath = join(rootPath, file);
        return processFile(fullPath, normalizedRel, rootPath, config, ig);
      }),
    );

    for (const res of results) {
      if (res.discovered) {
        if (discoveredFiles.length < config.maxTotalFiles) {
          discoveredFiles.push(res.discovered);
        } else {
          excluded.push({ path: res.discovered.relativePath, reason: 'too_large' });
        }
      } else if (res.excluded) {
        excluded.push(res.excluded);
      }
    }
  }

  return {
    files: discoveredFiles,
    totalScanned: allFiles.length,
    excluded,
  };
}

async function createIgnoreFilter(rootPath: string, config: IndexingConfig): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();

  ig.add(DEFAULT_EXCLUDED_PATTERNS);

  if (config.excludedPatterns.length > 0) {
    ig.add(config.excludedPatterns);
  }

  ig.add(SENSITIVE_PATTERNS);

  const gitignorePath = join(rootPath, '.gitignore');
  try {
    const content = await readFile(gitignorePath, 'utf-8');
    ig.add(content);
  } catch {
    // No .gitignore, continue
  }

  return ig;
}

async function getGitTrackedFiles(rootPath: string): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'ls-files'], { stdout: 'pipe' });
    return stdout.trim().split('\n').filter(f => f.length > 0);
  } catch {
    return [];
  }
}

async function getUntrackedFiles(rootPath: string, ig: ReturnType<typeof ignore>): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'ls-files', '--others', '--exclude-standard'], { stdout: 'pipe' });
    const files = stdout.trim().split('\n').filter(f => f.length > 0);
    return files.filter(f => !ig.ignores(normalizePath(f)));
  } catch {
    return [];
  }
}

async function processFile(
  fullPath: string,
  relativePath: string,
  _rootPath: string,
  config: IndexingConfig,
  ig: ReturnType<typeof ignore>,
): Promise<ProcessFileResult> {
  if (ig.ignores(relativePath)) {
    return { excluded: { path: relativePath, reason: 'ignored' } };
  }

  try {
    const linkStats = await lstat(fullPath);
    if (linkStats.isSymbolicLink()) {
      return { excluded: { path: relativePath, reason: 'symlink' } };
    }
  } catch {
    return { excluded: { path: relativePath, reason: 'error' } };
  }

  try {
    const stats = await stat(fullPath);
    if (stats.size > config.maxFileSize) {
      return { excluded: { path: relativePath, reason: 'too_large' } };
    }

    if (!isTextFile(fullPath)) {
      return { excluded: { path: relativePath, reason: 'binary' } };
    }

    const hash = await hashFile(fullPath);
    const language = detectLanguage(fullPath);

    return {
      discovered: {
        path: fullPath,
        relativePath,
        language,
        size: stats.size,
        hash,
        lastModified: stats.mtimeMs,
      },
    };
  } catch {
    return { excluded: { path: relativePath, reason: 'error' } };
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    try {
      const buffer = await readFile(filePath);
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
  }
}

import { execa } from 'execa';
import { ignore, Ignore } from 'ignore';
import { readFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { IndexingConfig } from '../../shared/types';
import { RepositoryError } from '../../shared/errors';
import { isTextFile, detectLanguage, hashFile } from '../../shared/utils';

export interface DiscoveredFile {
  path: string;
  relativePath: string;
  language: string;
  size: number;
  hash: string;
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
  '.env*',
  '*.key',
  '*.pem',
  '*.cert',
  '*.crt',
  '*.p12',
  '*.pfx',
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
  '.env',
  '.env.local',
  '.env.*.local',
  '*.key',
  '*.pem',
  '*.cert',
  '*.crt',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_ed25519',
  'id_dsa',
  '*.pem',
  '*.ppk',
  'secrets.*',
  'credentials.*',
  '*.secret',
];

export async function scanRepository(rootPath: string, config: IndexingConfig): Promise<ScanResult> {
  const ig = await createIgnoreFilter(rootPath, config);
  const gitFiles = await getGitTrackedFiles(rootPath);
  const untrackedFiles = await getUntrackedFiles(rootPath, ig);

  const allFiles = [...new Set([...gitFiles, ...untrackedFiles])];
  const discoveredFiles: DiscoveredFile[] = [];
  const excluded: ExcludedFile[] = [];

  for (const file of allFiles) {
    const fullPath = join(rootPath, file);

    try {
      const result = await processFile(fullPath, file, rootPath, config, ig);
      if (result) {
        discoveredFiles.push(result);
      } else {
        excluded.push({ path: file, reason: 'ignored' });
      }
    } catch (error) {
      excluded.push({ path: file, reason: 'error' });
    }
  }

  return {
    files: discoveredFiles,
    totalScanned: discoveredFiles.length,
    excluded,
  };
}

async function createIgnoreFilter(rootPath: string, config: IndexingConfig): Promise<Ignore> {
  const ig = ignore();

  // Add default patterns
  ig.add(DEFAULT_EXCLUDED_PATTERNS);

  // Add user configured patterns
  if (config.excludedPatterns.length > 0) {
    ig.add(config.excludedPatterns);
  }

  // Add sensitive patterns
  ig.add(SENSITIVE_PATTERNS);

  // Read .gitignore files
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

async function getUntrackedFiles(rootPath: string, ig: Ignore): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'ls-files', '--others', '--exclude-standard'], { stdout: 'pipe' });
    const files = stdout.trim().split('\n').filter(f => f.length > 0);
    return files.filter(f => !ig.ignores(f));
  } catch {
    return [];
  }
}

async function processFile(
  fullPath: string,
  relativePath: string,
  rootPath: string,
  config: IndexingConfig,
  ig: Ignore,
): Promise<DiscoveredFile | null> {
  // Check if ignored
  if (ig.ignores(relativePath)) {
    return null;
  }

  // Check if symlink
  try {
    const stats = await import('node:fs/promises').then(fs => fs.lstat(fullPath));
    if (stats.isSymbolicLink()) {
      return null;
    }
  } catch {
    return null;
  }

  // Check file size
  try {
    const stats = await import('node:fs/promises').then(fs => fs.stat(fullPath));
    if (stats.size > config.maxFileSize) {
      return null;
    }
  } catch {
    return null;
  }

  // Check if text file
  if (!isTextFile(fullPath)) {
    return null;
  }

  // Check total file limit
  // This is checked at a higher level

  const hash = await hashFile(fullPath);
  const language = detectLanguage(fullPath);

  return {
    path: fullPath,
    relativePath,
    language,
    size: 0, // Will be filled by stat
    hash,
  };
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    // Try with different encoding or return empty
    try {
      const buffer = await import('node:fs/promises').then(fs => fs.readFile(filePath));
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
  }
}
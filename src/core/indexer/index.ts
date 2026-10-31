import MiniSearch from 'minisearch';
import { readFile, writeFile, mkdir, rm, readdir, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import envPaths from 'env-paths';
import { createHash } from 'node:crypto';
import { execa } from 'execa';
import { IndexingConfig, RepositoryIndex, CodeChunk, FileRecord, GitCommit, SymbolInfo, RetrievalResult } from '../../shared/types';
import { normalizePath } from '../../shared/utils';

const paths = envPaths('reposeance', { suffix: '' });
const CACHE_DIR = join(paths.cache, 'repositories');

export interface SearchIndexes {
  codeIndex: MiniSearch;
  symbolIndex: MiniSearch;
  commitIndex: MiniSearch;
  fileIndex: MiniSearch;
}

const indexCache = new Map<string, { headCommit: string; indexes: SearchIndexes }>();

export function clearSearchIndexCache(repoId?: string): void {
  if (repoId) {
    indexCache.delete(repoId);
  } else {
    indexCache.clear();
  }
}

export function generateRepoId(rootPath: string): string {
  return createHash('sha256').update(normalizePath(rootPath)).digest('hex').substring(0, 16);
}

function getIndexDir(repoId: string): string {
  return join(CACHE_DIR, repoId);
}

function getIndexFilePath(repoId: string): string {
  return join(getIndexDir(repoId), 'index.json');
}

export async function createRepositoryIndex(
  rootPath: string,
  _config: IndexingConfig,
  files: FileRecord[],
  chunks: CodeChunk[],
  symbols: SymbolInfo[],
  commits: GitCommit[],
): Promise<RepositoryIndex> {
  const repoId = generateRepoId(rootPath);
  const headCommit = await getHeadCommit(rootPath);

  const index: RepositoryIndex = {
    metadata: {
      id: repoId,
      rootPath: normalizePath(rootPath),
      name: await getRepoName(rootPath),
      indexedAt: new Date().toISOString(),
      headCommit,
      totalFiles: files.length,
      totalChunks: chunks.length,
      totalSymbols: symbols.length,
      totalCommits: commits.length,
      version: 1,
    },
    files,
    chunks,
    symbols,
    commits,
  };

  await persistIndex(index);
  clearSearchIndexCache(repoId);
  return index;
}

async function getRepoName(rootPath: string): Promise<string> {
  try {
    const { stdout: remoteUrl } = await execa('git', ['-C', rootPath, 'config', '--get', 'remote.origin.url'], { stdout: 'pipe', stderr: 'ignore' });
    if (remoteUrl) {
      const match = remoteUrl.match(/([^/]+?)(?:\.git)?$/);
      if (match && match[1]) return match[1];
    }
  } catch {
    // Ignore
  }
  return rootPath.split(/[\\/]/).pop() ?? 'unknown';
}

async function getHeadCommit(rootPath: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

async function persistIndex(index: RepositoryIndex): Promise<void> {
  const indexDir = getIndexDir(index.metadata.id);
  await mkdir(indexDir, { recursive: true });
  const indexPath = getIndexFilePath(index.metadata.id);
  const tempPath = `${indexPath}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(index, null, 2), 'utf-8');
  await rename(tempPath, indexPath);
}

export async function loadRepositoryIndex(repoId: string): Promise<RepositoryIndex | null> {
  const indexPath = getIndexFilePath(repoId);
  try {
    const content = await readFile(indexPath, 'utf-8');
    return JSON.parse(content) as RepositoryIndex;
  } catch {
    return null;
  }
}

export async function loadRepositoryIndexByRoot(rootPath: string): Promise<RepositoryIndex | null> {
  const repoId = generateRepoId(rootPath);
  return loadRepositoryIndex(repoId);
}

export async function deleteRepositoryIndex(repoId: string): Promise<void> {
  const indexDir = getIndexDir(repoId);
  clearSearchIndexCache(repoId);
  try {
    await rm(indexDir, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

export async function listRepositoryIndexes(): Promise<string[]> {
  try {
    return await readdir(CACHE_DIR);
  } catch {
    return [];
  }
}

export async function buildSearchIndexes(index: RepositoryIndex): Promise<SearchIndexes> {
  const codeIndex = new MiniSearch({
    fields: ['content', 'symbolName', 'symbolType', 'filePath'],
    storeFields: ['id', 'filePath', 'startLine', 'endLine', 'language', 'symbolName', 'symbolType'],
    searchOptions: {
      boost: { content: 1, symbolName: 3, symbolType: 2, filePath: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const symbolIndex = new MiniSearch({
    fields: ['name', 'type', 'filePath', 'signature'],
    storeFields: ['name', 'type', 'filePath', 'startLine', 'endLine', 'signature'],
    searchOptions: {
      boost: { name: 3, signature: 2, type: 1, filePath: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const commitIndex = new MiniSearch({
    fields: ['message', 'author', 'hash', 'changedFiles'],
    storeFields: ['hash', 'shortHash', 'author', 'date', 'message', 'changedFiles'],
    searchOptions: {
      boost: { changedFiles: 3, message: 2, author: 1, hash: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const fileIndex = new MiniSearch({
    fields: ['path', 'language', 'symbols', 'imports'],
    storeFields: ['path', 'language', 'size', 'hash', 'lastModified', 'symbols'],
    searchOptions: {
      boost: { path: 3, symbols: 2, imports: 2, language: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  // Add code chunks
  for (const chunk of index.chunks) {
    codeIndex.add({
      id: chunk.id,
      content: chunk.content,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      language: chunk.language,
      symbolName: chunk.symbolName ?? '',
      symbolType: chunk.symbolType ?? '',
    });
  }

  // Add symbols
  for (const symbol of index.symbols) {
    symbolIndex.add({
      id: `${symbol.name}-${symbol.filePath}-${symbol.startLine}`,
      name: symbol.name,
      type: symbol.type,
      filePath: symbol.filePath ?? '',
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      signature: symbol.signature ?? '',
    });
  }

  // Add commits
  for (const commit of index.commits) {
    commitIndex.add({
      id: commit.hash,
      message: commit.message,
      author: commit.author,
      date: commit.date,
      hash: commit.hash,
      shortHash: commit.shortHash,
      changedFiles: commit.changedFiles.join(' '),
    });
  }

  // Add files
  for (const file of index.files) {
    fileIndex.add({
      id: file.path,
      path: file.path,
      language: file.language,
      size: file.size,
      hash: file.hash,
      lastModified: file.lastModified,
      symbols: file.symbols.map(s => s.name).join(' '),
      imports: file.imports ? file.imports.map(i => i.moduleSpecifier).join(' ') : '',
    });
  }

  return { codeIndex, symbolIndex, commitIndex, fileIndex };
}

export async function getOrBuildSearchIndexes(index: RepositoryIndex): Promise<SearchIndexes> {
  const cached = indexCache.get(index.metadata.id);
  if (cached && cached.headCommit === index.metadata.headCommit) {
    return cached.indexes;
  }
  const indexes = await buildSearchIndexes(index);
  indexCache.set(index.metadata.id, { headCommit: index.metadata.headCommit, indexes });
  return indexes;
}

export async function searchRepository(
  index: RepositoryIndex,
  query: string,
  _config: IndexingConfig,
  options: {
    maxCodeChunks?: number | undefined;
    maxSymbols?: number | undefined;
    maxCommits?: number | undefined;
    maxFiles?: number | undefined;
    scope?: string | undefined;
  } = {},
): Promise<RetrievalResult> {
  const { codeIndex, symbolIndex, commitIndex, fileIndex } = await getOrBuildSearchIndexes(index);

  const maxCodeChunks = options.maxCodeChunks ?? 10;
  const maxSymbols = options.maxSymbols ?? 20;
  const maxCommits = options.maxCommits ?? 10;
  const maxFiles = options.maxFiles ?? 10;
  const normalizedScope = options.scope ? normalizePath(options.scope) : undefined;

  // Search code chunks
  const codeResults = codeIndex.search(query, {
    boost: { content: 1, symbolName: 3, symbolType: 2, filePath: 2 },
    fuzzy: 0.2,
    prefix: true,
  });

  // Search symbols
  const symbolResults = symbolIndex.search(query, {
    boost: { name: 3, type: 1, filePath: 1 },
    fuzzy: 0.2,
    prefix: true,
  });

  // Search commits
  const commitResults = commitIndex.search(query, {
    boost: { message: 2, author: 1, hash: 3 },
    fuzzy: 0.2,
    prefix: true,
  });

  // Search files
  const fileResults = fileIndex.search(query, {
    boost: { path: 3, symbols: 2, language: 1 },
    fuzzy: 0.2,
    prefix: true,
  });

  // Fast map lookups
  const chunksById = new Map<string, CodeChunk>(index.chunks.map(c => [c.id, c]));
  const symbolsByKey = new Map<string, SymbolInfo>();
  for (const s of index.symbols) {
    symbolsByKey.set(`${s.name}-${s.filePath}-${s.startLine}`, s);
    symbolsByKey.set(s.name, s);
  }
  const commitsByHash = new Map<string, GitCommit>(index.commits.map(c => [c.hash, c]));
  const filesByPath = new Map<string, FileRecord>(index.files.map(f => [f.path, f]));

  // Map results back to original objects with optional scope filtering
  let codeChunks: CodeChunk[] = codeResults
    .map(r => chunksById.get(r.id))
    .filter((c): c is CodeChunk => c !== undefined);

  if (normalizedScope) {
    codeChunks = codeChunks.filter(c => c.filePath.startsWith(normalizedScope));
  }
  codeChunks = codeChunks.slice(0, maxCodeChunks);

  let symbols: SymbolInfo[] = symbolResults
    .map(r => symbolsByKey.get(r.id) ?? symbolsByKey.get(r.name))
    .filter((s): s is SymbolInfo => s !== undefined);

  if (normalizedScope) {
    symbols = symbols.filter(s => s.filePath ? s.filePath.startsWith(normalizedScope) : true);
  }
  symbols = symbols.slice(0, maxSymbols);

  const commits: GitCommit[] = commitResults
    .slice(0, maxCommits)
    .map(r => commitsByHash.get(r.id))
    .filter((c): c is GitCommit => c !== undefined);

  let files: FileRecord[] = fileResults
    .map(r => filesByPath.get(r.id))
    .filter((f): f is FileRecord => f !== undefined);

  if (normalizedScope) {
    files = files.filter(f => f.path.startsWith(normalizedScope));
  }
  files = files.slice(0, maxFiles);

  return { codeChunks, symbols, commits, files };
}

export async function checkIndexFreshness(rootPath: string): Promise<{ isFresh: boolean; reason?: string }> {
  const repoId = generateRepoId(rootPath);
  const index = await loadRepositoryIndex(repoId);

  if (!index) {
    return { isFresh: false, reason: 'No index found' };
  }

  try {
    const { stdout: currentHead } = await execa('git', ['-C', rootPath, 'rev-parse', 'HEAD']);

    if (currentHead.trim() !== index.metadata.headCommit) {
      return { isFresh: false, reason: 'Git HEAD has changed' };
    }

    // Check if any indexed files have been modified
    for (const file of index.files) {
      try {
        const fullFilePath = join(rootPath, file.path);
        const stats = await stat(fullFilePath);
        if (stats.mtimeMs > file.lastModified) {
          return { isFresh: false, reason: `File modified: ${file.path}` };
        }
      } catch {
        // File deleted
        return { isFresh: false, reason: `File deleted: ${file.path}` };
      }
    }

    return { isFresh: true };
  } catch {
    return { isFresh: false, reason: 'Error checking freshness' };
  }
}

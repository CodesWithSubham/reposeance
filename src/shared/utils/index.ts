import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}`;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

export function hashFile(filePath: string): Promise<string> {
  return readFile(filePath).then((buffer: Buffer) =>
    createHash('sha256').update(buffer).digest('hex').substring(0, 16),
  );
}

export function getRelativePath(from: string, to: string): string {
  const resolvedFrom = resolve(from);
  const resolvedTo = resolve(to);
  return relative(resolvedFrom, resolvedTo);
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedFile = resolve(filePath);
  const resolvedDir = resolve(directory);
  const relativePath = relative(resolvedDir, resolvedFile);
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    txt: 'text',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    cxx: 'cpp',
    cc: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    clj: 'clojure',
    hs: 'haskell',
    ml: 'ocaml',
    fs: 'fsharp',
    vim: 'vim',
    lua: 'lua',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    bat: 'batch',
    cmd: 'batch',
    dockerfile: 'dockerfile',
    gitignore: 'gitignore',
    gitattributes: 'gitignore',
  };
  return languageMap[ext] || 'text';
}

export function isTextFile(filePath: string): boolean {
  const textExtensions = new Set([
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
    '.cxx',
    '.cc',
    '.c',
    '.h',
    '.hpp',
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
  ]);
  const ext = `.${filePath.toLowerCase().split('.').pop() || ''}`;
  return textExtensions.has(ext);
}

export function chunkText(
  content: string,
  chunkSize: number,
  overlap: number,
  filePath: string,
  language: string,
): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const end = Math.min(i + chunkSize, lines.length);
    const chunkLines = lines.slice(i, end);
    const chunkContent = chunkLines.join('\n');

    if (chunkContent.trim().length === 0) continue;

    chunks.push({
      id: generateId('chunk'),
      filePath,
      startLine: i + 1,
      endLine: end,
      content: chunkContent,
      language,
    });

    if (end === lines.length) break;
  }

  return chunks;
}

interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

export function parseKeyValuePairs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const [key, ...valueParts] = arg.split('=');
    if (key && valueParts.length > 0) {
      result[key] = valueParts.join('=');
    }
  }
  return result;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
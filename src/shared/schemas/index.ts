import { z } from 'zod';

export const RepositoryMetadataSchema = z.object({
  id: z.string(),
  rootPath: z.string(),
  name: z.string(),
  indexedAt: z.string().datetime(),
  headCommit: z.string(),
  totalFiles: z.number().int().nonnegative(),
  totalChunks: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const SymbolInfoSchema = z.object({
  name: z.string(),
  type: z.enum(['function', 'class', 'method', 'interface', 'type', 'variable', 'import', 'export']),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  signature: z.string().optional(),
});

export const ImportInfoSchema = z.object({
  moduleSpecifier: z.string(),
  namedImports: z.array(z.string()),
  defaultImport: z.string().optional(),
  namespaceImport: z.string().optional(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});

export const ExportInfoSchema = z.object({
  name: z.string(),
  type: z.enum(['default', 'named', 'namespace', 'reexport']),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});

export const FileRecordSchema = z.object({
  path: z.string(),
  language: z.string(),
  size: z.number().int().nonnegative(),
  hash: z.string(),
  lastModified: z.number().int().positive(),
  symbols: z.array(SymbolInfoSchema),
  imports: z.array(ImportInfoSchema).default([]),
  exports: z.array(ExportInfoSchema).default([]),
});

export const CodeChunkSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  content: z.string(),
  language: z.string(),
  symbolName: z.string().optional(),
  symbolType: z.string().optional(),
});

export const GitCommitSchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  author: z.string(),
  date: z.string().datetime(),
  message: z.string(),
  changedFiles: z.array(z.string()),
});

export const BlameLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  commitHash: z.string(),
  author: z.string(),
  date: z.string().datetime(),
});

export const GitBlameResultSchema = z.object({
  filePath: z.string(),
  lines: z.array(BlameLineSchema),
});

export const PatchFileSchema = z.object({
  path: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  patch: z.string(),
});

export const CommitPatchSchema = z.object({
  commitHash: z.string(),
  patch: z.string(),
  files: z.array(PatchFileSchema),
});

export const EvidenceReferenceSchema = z.object({
  type: z.enum(['source', 'commit']),
  path: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  commitHash: z.string().optional(),
});

export const SearchResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  type: z.enum(['code', 'symbol', 'commit', 'file']),
  data: z.unknown(),
});

export const RetrievalResultSchema = z.object({
  codeChunks: z.array(CodeChunkSchema),
  symbols: z.array(SymbolInfoSchema),
  commits: z.array(GitCommitSchema),
  files: z.array(FileRecordSchema),
});

export const OllamaConfigSchema = z.object({
  baseUrl: z.string().url().default('http://localhost:11434'),
  model: z.string().default('gemma3:1b'),
  timeout: z.number().int().positive().default(120000),
});

export const IndexingConfigSchema = z.object({
  maxFileSize: z.number().int().positive().default(1024 * 1024),
  maxTotalFiles: z.number().int().positive().default(10000),
  chunkSize: z.number().int().positive().default(80),
  chunkOverlap: z.number().int().nonnegative().default(20),
  excludedPatterns: z.array(z.string()).default([
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
  ]),
  includedExtensions: z.array(z.string()).default([
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
  ]),
}).refine(data => data.chunkSize > data.chunkOverlap, {
  message: 'chunkSize must be greater than chunkOverlap',
  path: ['chunkOverlap'],
});

export const RetrievalConfigSchema = z.object({
  maxCodeChunks: z.number().int().positive().default(10),
  maxSymbols: z.number().int().positive().default(20),
  maxCommits: z.number().int().positive().default(10),
  maxContextTokens: z.number().int().positive().default(8000),
  codeWeight: z.number().positive().default(1.0),
  symbolWeight: z.number().positive().default(1.5),
  commitWeight: z.number().positive().default(0.8),
  fileWeight: z.number().positive().default(0.5),
});

export const CLIConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
  verbose: z.boolean().default(false),
  jsonOutput: z.boolean().default(false),
});

export const ReposeanceConfigSchema = z.object({
  ollama: OllamaConfigSchema,
  indexing: IndexingConfigSchema,
  retrieval: RetrievalConfigSchema,
  cli: CLIConfigSchema,
});

export type RepositoryMetadata = z.infer<typeof RepositoryMetadataSchema>;
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;
export type ImportInfo = z.infer<typeof ImportInfoSchema>;
export type ExportInfo = z.infer<typeof ExportInfoSchema>;
export type FileRecord = z.infer<typeof FileRecordSchema>;
export type CodeChunk = z.infer<typeof CodeChunkSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;
export type BlameLine = z.infer<typeof BlameLineSchema>;
export type GitBlameResult = z.infer<typeof GitBlameResultSchema>;
export type PatchFile = z.infer<typeof PatchFileSchema>;
export type CommitPatch = z.infer<typeof CommitPatchSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;
export type IndexingConfig = z.infer<typeof IndexingConfigSchema>;
export type RetrievalConfig = z.infer<typeof RetrievalConfigSchema>;
export type CLIConfig = z.infer<typeof CLIConfigSchema>;
export type ReposeanceConfig = z.infer<typeof ReposeanceConfigSchema>;
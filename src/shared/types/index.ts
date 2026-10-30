export interface RepositoryMetadata {
  id: string;
  rootPath: string;
  name: string;
  indexedAt: string;
  headCommit: string;
  totalFiles: number;
  totalChunks: number;
  version: number;
}

export interface FileRecord {
  path: string;
  language: string;
  size: number;
  hash: string;
  lastModified: number;
  symbols: SymbolInfo[];
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'import' | 'export';
  startLine: number;
  endLine: number;
  signature?: string;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  symbolName?: string;
  symbolType?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  changedFiles: string[];
}

export interface GitBlameResult {
  filePath: string;
  lines: BlameLine[];
}

export interface BlameLine {
  lineNumber: number;
  commitHash: string;
  author: string;
  date: string;
}

export interface CommitPatch {
  commitHash: string;
  patch: string;
  files: PatchFile[];
}

export interface PatchFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface EvidenceReference {
  type: 'source' | 'commit';
  path?: string;
  startLine?: number;
  endLine?: number;
  commitHash?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  type: 'code' | 'symbol' | 'commit' | 'file';
  data: CodeChunk | SymbolInfo | GitCommit | FileRecord;
}

export interface RetrievalResult {
  codeChunks: CodeChunk[];
  symbols: SymbolInfo[];
  commits: GitCommit[];
  files: FileRecord[];
}

export interface RAGContext {
  question: string;
  evidence: RetrievalResult;
  tokenBudget: number;
}

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  checkModel(model: string): Promise<boolean>;
  listModels(): Promise<string[]>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
}

export interface ReposeanceConfig {
  ollama: OllamaConfig;
  indexing: IndexingConfig;
  retrieval: RetrievalConfig;
  cli: CLIConfig;
}

export interface IndexingConfig {
  maxFileSize: number;
  maxTotalFiles: number;
  chunkSize: number;
  chunkOverlap: number;
  excludedPatterns: string[];
  includedExtensions: string[];
}

export interface RetrievalConfig {
  maxCodeChunks: number;
  maxSymbols: number;
  maxCommits: number;
  maxContextTokens: number;
  codeWeight: number;
  symbolWeight: number;
  commitWeight: number;
  fileWeight: number;
}

export interface CLIConfig {
  theme: 'dark' | 'light' | 'auto';
  verbose: boolean;
  jsonOutput: boolean;
}
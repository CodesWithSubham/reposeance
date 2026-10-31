// Main entry point - exports for programmatic use
export * from './shared/types';
export {
  RepositoryMetadataSchema,
  SymbolInfoSchema,
  ImportInfoSchema,
  ExportInfoSchema,
  FileRecordSchema,
  CodeChunkSchema,
  GitCommitSchema,
  BlameLineSchema,
  GitBlameResultSchema,
  PatchFileSchema,
  CommitPatchSchema,
  EvidenceReferenceSchema,
  SearchResultSchema,
  RetrievalResultSchema,
  OllamaConfigSchema,
  IndexingConfigSchema,
  RetrievalConfigSchema,
  CLIConfigSchema,
  ReposeanceConfigSchema,
} from './shared/schemas';
export * from './shared/errors';
export * from './shared/utils';
export * from './config';

// Core APIs
export { findGitRoot, getRepositoryInfo, getRepositoryMetadata } from './core/repository';
export {
  getCommitHistory,
  getFileHistory,
  getDirectoryHistory,
  getCommitDetails,
  getBlame,
  getCommitPatch,
  getChangedFilesSince,
  getFileAtCommit,
  isMergeCommit,
  getMergeCommitParents,
  getBranchesContainingCommit,
} from './core/git';
export { scanRepository } from './core/scanner';
export { analyzeFile } from './core/analyzer';
export {
  createRepositoryIndex,
  loadRepositoryIndex,
  loadRepositoryIndexByRoot,
  searchRepository,
  checkIndexFreshness,
  buildSearchIndexes,
} from './core/indexer';
export { runRAGPipeline } from './core/rag';
export {
  parseEvidenceReferences,
  validateEvidence,
  formatEvidenceForDisplay,
  extractInlineCitations,
} from './core/evidence';
export { OllamaProvider, createOllamaProvider } from './core/llm/ollama.provider';
export type { LLMProvider, LLMMessage, LLMOptions, LLMResponse, OllamaConfig as LLMOllamaConfig } from './core/llm/llm.provider';

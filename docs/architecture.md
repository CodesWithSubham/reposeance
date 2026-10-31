# RepoSeance Architecture

## Overview

RepoSeance is a local-first AI codebase archaeologist built as a modular TypeScript CLI application. The architecture emphasizes separation of concerns, security, and local-first processing.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Layer                                │
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐   │
│  │  init    │ │ index  │ │  ask   │ │ chat   │ │ history  │   │
│  └──────────┘ └────────┘ └────────┘ └────────┘ └──────────┘   │
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐              │
│  │ status   │ │ doctor │ │ clear  │ │  help   │              │
│  └──────────┘ └────────┘ └────────┘ └──────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Layer                               │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Repository  │ │ Scanner  │ │ Analyzer │ │    Git        │  │
│  └─────────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Indexer    │ │ Retrieval│ │   RAG    │ │  Evidence     │  │
│  └─────────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌─────────────┐                                              │
│  │    LLM      │                                              │
│  └─────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Git     │ │ Ollama   │ │ MiniSearch│ │  File System     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Dependency Rules

**CRITICAL**: The core layer must NEVER import from the CLI layer.

```
CLI Layer ──────► Core Layer ──────► Shared Layer
     │                │                   │
     │                ▼                   ▼
     │          Infrastructure ◄────── External
     │                │                   │
     └────────────────┴───────────────────┘
```

### Allowed Dependencies

| From | To | Allowed |
|------|----|---------|
| CLI | Core | ✅ |
| CLI | Shared | ✅ |
| Core | Shared | ✅ |
| Core | Infrastructure | ✅ |
| Shared | (none) | ✅ |
| Infrastructure | (none) | ✅ |
| Core | CLI | ❌ |
| Shared | Core/CLI | ❌ |
| Infrastructure | Core/CLI/Shared | ❌ |

## Core Modules

### 1. Repository (`core/repository/`)

**Responsibility**: Git repository detection and metadata extraction

- `findGitRoot()` — Walk up directory tree to find `.git`
- `getRepositoryInfo()` — Extract name, root path, Git status
- `getHeadCommit()` — Get current HEAD commit hash
- `getRepositoryMetadata()` — Combine info for indexing

**Key Types**: `RepositoryInfo`, `RepositoryMetadata`

### 2. Scanner (`core/scanner/`)

**Responsibility**: File discovery with Git-aware filtering

- `scanRepository()` — Discover files using `git ls-files` + untracked
- Respects `.gitignore` via `ignore` package
- Excludes: `node_modules`, `dist`, `.git`, binaries, secrets, env files
- Language detection from file extensions
- Returns `DiscoveredFile[]` with path, language, size, hash, lastModified

**Key Types**: `DiscoveredFile`, `ScanResult`, `ExcludedFile`

### 3. Analyzer (`core/analyzer/`)

**Responsibility**: Code structure extraction

- **TypeScript/JavaScript**: Regex-based parsing (functions, classes, interfaces, imports, exports)
- **Other languages**: Generic line-based chunking + TODO/FIXME extraction
- Creates line-addressable chunks (80 lines, 20 overlap)
- Extracts symbols with type, location, signature

**Key Types**: `AnalysisResult`, `SymbolInfo`, `CodeChunk`, `ImportInfo`, `ExportInfo`

### 4. Git (`core/git/`)

**Responsibility**: Git history analysis (read-only)

- `getCommitHistory()` — Recent commits with optional path filter
- `getFileHistory()` / `getDirectoryHistory()` — Path-specific history
- `getBlame()` — Line-by-line blame with commit hash, author, date
- `getCommitDetails()` — Full commit info with changed files
- `getCommitPatch()` — Diff patches for commits
- `isMergeCommit()` / `getMergeCommitParents()` — Merge handling

**Key Types**: `GitCommit`, `GitBlameResult`, `BlameLine`, `CommitPatch`, `PatchFile`

### 5. Indexer (`core/indexer/`)

**Responsibility**: Local persistence and search

- **Storage**: JSON files in `~/.cache/reposeance/repositories/<repo-id>/`
- **Identity**: SHA256 of repository root path
- **Indexes**: MiniSearch instances for code, symbols, commits, files
- **Incremental**: Freshness check via Git HEAD + file mtime
- **Persistence**: `createRepositoryIndex()`, `loadRepositoryIndex()`, `deleteRepositoryIndex()`

**Key Types**: `RepositoryIndex`, `RepositoryIndexMetadata`, `SearchIndexes`

### 6. Retrieval (`core/indexer/searchRepository()`)

**Responsibility**: Multi-index search with ranking

- Searches code chunks, symbols, commits, files
- Field boosting: symbols > functions > classes > content
- Fuzzy matching + prefix matching
- Returns `RetrievalResult` with typed results

### 6. RAG (`core/rag/`)

**Responsibility**: Retrieval-Augmented Generation pipeline

- `runRAGPipeline()` — Question → Retrieval → Context → LLM → Validation
- `buildContextPrompt()` — Formats evidence for LLM
- `truncateContext()` — Token budget management
- System prompt enforces: evidence-only, citations, fact/inference distinction

**Key Types**: `RAGContext`, `RAGResponse`, `RAGPipelineOptions`

### 7. Evidence (`core/evidence/`)

**Responsibility**: Citation validation

- `parseEvidenceReferences()` — Extract `[S1]`, `src/file.ts:10-20`, commit hashes
- `validateEvidence()` — Verify paths, line ranges, commit hashes against index
- `formatEvidenceForDisplay()` — Human-readable evidence summary

**Key Types**: `EvidenceReference`, `ValidatedEvidence`

### 7. LLM (`core/llm/`)

**Responsibility**: LLM provider abstraction

- `LLMProvider` interface — `chat()`, `checkModel()`, `listModels()`
- `OllamaProvider` — HTTP client for Ollama API
- Streaming support with `onToken` callback
- Model availability checking

**Key Types**: `LLMProvider`, `LLMMessage`, `LLMOptions`, `LLMResponse`, `OllamaConfig`

### 8. Config (`core/config/`)

**Responsibility**: Cross-platform configuration management

- Storage: `env-paths` for OS-appropriate config directory
- Schema validation with Zod
- Deep merge for partial updates
- Defaults for all settings

**Key Types**: `ReposeanceConfig`, `OllamaConfig`, `IndexingConfig`, `RetrievalConfig`, `CLIConfig`

### 9. Shared (`shared/`)

**Responsibility**: Shared contracts and utilities

- `types/` — TypeScript interfaces
- `schemas/` — Zod validation schemas
- `errors/` — Custom error classes with exit codes
- `utils/` — Pure utility functions (hashing, chunking, formatting)

## Data Flow

### Indexing Pipeline

```
User: reposeance index
         │
         ▼
┌──────────────────┐
│  Repository      │── findGitRoot()
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Scanner         │── git ls-files + untracked
│                  │── .gitignore filtering
│                  │── size/binary/symlink checks
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Analyzer        │── Regex parsing (TS/JS)
│                  │── Symbol extraction
│                  │── Chunking (80 lines / 20 overlap)
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Git             │── Commit history (200 default)
│                  │── Changed files per commit
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Indexer         │── MiniSearch indexes (4 indexes)
│                  │── Persist to cache directory
└──────────────────┘
```

### Query Pipeline

```
User: reposeance ask "How does auth work?"
         │
         ▼
┌──────────────────┐
│  Load Index      │── Load from cache by repo ID
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Retrieval       │── searchRepository()
│                  │── Code chunks (10)
│                  │── Symbols (20)
│                  │── Commits (10)
│                  │── Files (10)
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Context Assembly│── Truncate to token budget (8000)
│                  │── Prioritize: symbols > code > commits
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  LLM (Ollama)    │── System prompt + evidence + question
│                  │── Streaming response
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Evidence        │── Parse citations [S1], [G1]
│  Validation      │── Verify against index
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Render          │── Answer + Evidence panel + Confidence
└──────────────────┘
```

## Security Model

### Threats Mitigated

| Threat | Mitigation |
|--------|------------|
| Secret leakage | Exclude `.env*`, `*.key`, `*.pem`, etc. |
| Binary files | Detect and skip non-text files |
| Huge repositories | Configurable file count/size limits |
| Prompt injection | Treat repo content as untrusted data |
| Shell injection | Argument-based `execa`, no shell |
| Symlink traversal | Skip symlinks |
| Malicious repo | Never execute scanned code |
| Cache contamination | Repo identity via hash + manifest validation |
| Stale index | Git HEAD + file mtime freshness check |

### Security Principles

1. **Never execute** repository code
2. **Never modify** the user's repository
3. **Never upload** source code to external services
4. **Read-only Git** operations only
5. **Argument-based** process execution (no shell)
6. **Validate all** AI-generated citations
5. **Local-first** by default

## Performance Considerations

### Indexing

- **Incremental**: Only re-process changed files
- **Chunking**: 80 lines with 20 overlap balances granularity/context
- **MiniSearch**: In-memory, no external DB, fast for <100k docs
- **File size limit**: 1MB default prevents huge file processing

### Query

- **Token budget**: 8000 tokens default (configurable)
- **Prioritization**: Symbols > Code chunks > Commits > Files
- **Result limits**: 10 code chunks, 20 symbols, 10 commits, 10 files
- **Streaming**: Ollama streaming for responsive UX

### Storage

- **JSON format**: Human-readable, portable
- **Cache location**: OS-appropriate cache directory
- **Repo identity**: SHA256 of absolute path (stable across moves)
- **Versioning**: Index schema version for migrations

## Extensibility Points

### Adding LLM Providers

Implement `LLMProvider` interface:

```typescript
interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  checkModel(model: string): Promise<boolean>;
  listModels(): Promise<string[]>;
  getDefaultModel(): string;
}
```

### Adding Language Support

1. Add extension to `includedExtensions` in config
2. Add language detection in `detectLanguage()`
3. Add parser in `analyzeFile()` for structural analysis
4. Update `isTextFile()` if needed

### Adding Search Fields

Modify `buildSearchIndexes()` to add new MiniSearch indexes or fields.

## Testing Strategy

### Unit Tests

- Pure functions: `shared/utils/`, `core/evidence/`, `core/rag/truncateContext()`
- Mock external: `execa`, `fetch`, `fs`

### Integration Tests

- Temporary Git repos via `tmp-promise`
- Mock Ollama server for RAG tests
- Full CLI command execution

### Test Fixtures

```
tests/fixtures/
├── ts-project/       # TypeScript project
├── js-project/       # JavaScript project
├── mixed-project/    # Multi-language
├── with-gitignore/   # .gitignore test
├── with-secrets/     # Secret exclusion test
└── large-files/      # Size limit test
```

## Deployment

### Build

```bash
pnpm build  # Outputs to dist/ as ESM
```

### Package

```json
{
  "bin": { "reposeance": "./dist/cli/program.js" },
  "type": "module"
}
```

### CI/CD

GitHub Actions workflow:
1. Matrix: Ubuntu, macOS, Windows
2. Node 20, 22
3. Steps: install → typecheck → lint → test → build
4. Release: tag push → publish to npm

## Future Considerations

### v1.1 — Semantic Memory
- Local embeddings (ONNX/transformers.js)
- Hybrid lexical + semantic search
- Better code relationship analysis

### v1.2 — Historical Intelligence
- Git blame investigations
- Feature lifecycle reconstruction
- Architectural decision reports
- Abandoned feature detection

### v2.0 — Developer Archaeology Agent
- Investigation workflows
- Reusable reports
- Optional agent tools
- IDE integration (VS Code extension)
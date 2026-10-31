# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of RepoSeance
- Local-first AI codebase archaeologist CLI
- Repository indexing with MiniSearch
- Git history analysis (commits, blame, patches)
- RAG pipeline with Ollama integration
- Evidence validation for AI responses
- Interactive chat mode
- Comprehensive doctor diagnostics
- Configuration management with Zod validation
- Cross-platform support (Windows, macOS, Linux)

### Security
- Local-first architecture (no external requests by default)
- Secret file exclusion (.env, keys, certs)
- Binary file detection and exclusion
- Read-only Git operations
- Argument-based process execution (no shell injection)
- Symlink traversal prevention

## [1.0.0] - 2026-10-31

### Added
- Initial release

### Features
- **Repository Indexing**: Scan TypeScript/JavaScript projects, extract symbols, imports, exports
- **Git Archaeology**: Commit history, file blame, directory history, commit patches
- **Local AI**: Ollama integration with Gemma models, configurable models
- **RAG Pipeline**: Retrieval-augmented generation with evidence validation
- **Evidence Validation**: Citation verification against indexed repository
- **Interactive Chat**: Session-based conversation with history
- **Doctor Diagnostics**: System, Git, Ollama, index, and config checks
- **Status/Index Management**: Index status, freshness checks, clear command

### Commands
- `reposeance init` — Initialize configuration with Ollama connectivity check
- `reposeance index` — Full repository indexing with freshness detection
- `reposeance ask` — Single question with evidence-backed answers
- `reposeance chat` — Interactive chat with session history
- `reposeance history` — Git history investigation with blame support
- `reposeance status` — Index and model status
- `reposeance doctor` — Comprehensive system diagnostics
- `reposeance clear` — Remove local index with confirmation

### Configuration
- Local-first config with Zod validation
- Cross-platform config directory support
- Ollama URL, model, timeout settings
- Indexing/retrieval tuning parameters
- CLI theme and output options

### Documentation
- Comprehensive README with usage examples
- Architecture documentation with data flow diagrams
- Privacy and security documentation
- Contributing guide
- MIT License
- Code of Conduct
- Issue templates (bug, feature, security)
- GitHub Actions CI/CD workflow

### Testing
- 55 unit tests passing
- Integration tests for CLI commands
- TypeScript strict mode with exactOptionalPropertyTypes
- ESLint/Oxlint for code quality
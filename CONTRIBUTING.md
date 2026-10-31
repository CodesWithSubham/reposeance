# Contributing to RepoSeance

Thank you for your interest in contributing to RepoSeance! 👻

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check existing [issues](https://github.com/CodesWithSubham/reposeance/issues) to avoid duplicates
2. Use the bug report template
3. Include:
   - RepoSeance version (`reposeance --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs/output

### Suggesting Features

1. Check existing [discussions](https://github.com/CodesWithSubham/reposeance/discussions)
2. Open a feature request with:
   - Clear description of the feature
   - Use cases and motivation
   - Possible implementation approach
   - Alternatives considered

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure tests pass: `pnpm test && pnpm typecheck && pnpm lint`
5. Commit with conventional commits: `feat: add amazing feature`
6. Push and open a PR

## Development Setup

```bash
# Clone and install
git clone https://github.com/CodesWithSubham/reposeance.git
cd reposeance
pnpm install

# Build
pnpm build

# Development mode (watch mode)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Coding Standards

### TypeScript

- Strict mode enabled
- No `any` types
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- Prefer explicit types over `any`

### Code Style

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- Semicolons required
- Max line length: 100 characters

### Testing

- Write unit tests for new functionality
- Integration tests for CLI commands
- Mock external dependencies (Ollama, Git)
- Aim for >80% coverage on new code

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Examples:
```
feat(cli): add --json flag to ask command
fix(indexer): handle missing index gracefully
docs(readme): update installation instructions
test(rag): add evidence validation tests
```

## Architecture Overview

```
src/
├── cli/              # CLI interface
│   ├── commands/     # Command implementations
│   └── ui/           # Terminal UI
├── core/             # Core business logic
│   ├── repository/   # Git repo detection
│   ├── scanner/      # File discovery
│   ├── analyzer/     # Code analysis
│   ├── git/          # Git history
│   ├── indexer/      # MiniSearch indexing
│   ├── rag/          # RAG pipeline
│   ├── evidence/     # Evidence validation
│   └── llm/          # LLM providers
├── config/           # Configuration
└── shared/           # Shared types, schemas, errors, utils
```

### Key Principles

1. **Core independence** — Core modules never import from CLI
2. **Explicit dependencies** — Use dependency injection
3. **Security first** — No code execution, read-only Git, no external requests
4. **Local-first** — Everything works offline after initial setup

## Testing Guidelines

### Unit Tests

- Test pure functions in isolation
- Mock external dependencies
- Test edge cases and error conditions

### Integration Tests

- Test full CLI command flows
- Use temporary Git repositories
- Mock Ollama server for RAG tests

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── fixtures/       # Test fixtures (sample repos)
```

## Documentation

- Update README.md for user-facing changes
- Update architecture.md for architectural changes
- Add JSDoc comments for public APIs
- Update CHANGELOG.md for releases

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag: `git tag v1.x.x`
4. Push tag: `git push origin v1.x.x`
5. GitHub Actions builds and publishes to npm

## Questions?

Open a [discussion](https://github.com/CodesWithSubham/reposeance/discussions) or [issue](https://github.com/CodesWithSubham/reposeance/issues).

---

Thank you for contributing to RepoSeance! 👻
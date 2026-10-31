# RepoSeance Privacy & Security Documentation

## Privacy Promise

**RepoSeance is local-first by design.** Your source code never leaves your machine unless you explicitly configure it to do so.

## What Data Stays Local

| Data | Location | Leaves Machine? |
|------|----------|-----------------|
| Source code | Your repository | ❌ Never |
| Git history | Your repository | ❌ Never |
| Repository index | `~/.cache/reposeance/` | ❌ Never |
| Configuration | OS config directory | ❌ Never |
| Questions/queries | Local Ollama instance | ❌ Never* |
| AI responses | Terminal only | ❌ Never |

*Unless you configure a remote Ollama instance or use a cloud LLM provider (not supported in core).

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR MACHINE                                │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  Repository  │───►│   RepoSeance     │───►│   Ollama     │  │
│  │  (source)    │    │   (index + RAG)  │    │  (local LLM) │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
│         │                    │                    │              │
│         │                    ▼                    │              │
│         │            ┌──────────────────┐        │              │
│         │            │  Local Index     │        │              │
│         │            │  (~/.cache/)     │        │              │
│         │            └──────────────────┘        │              │
│         │                                         │              │
│         └─────────────────────────────────────────┘              │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────┐                            │
│                     │  Terminal    │                            │
│                     │  (output)    │                            │
│                     └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

**No data leaves this boundary.**

## What We Collect

### Nothing

RepoSeance does not collect:
- ❌ Usage analytics
- ❌ Error reports (unless you manually report)
- ❌ Repository metadata
- ❌ Query history
- ❌ Performance metrics
- ❌ Feature usage

### Optional: Crash Reports

If you choose to report an issue, you may voluntarily share:
- Error stack traces (sanitized of paths)
- RepoSeance version
- Node.js version
- Operating system
- Steps to reproduce

## Configuration Storage

Configuration is stored in your OS-appropriate config directory:

| OS | Location |
|----|----------|
| Linux | `~/.config/reposeance/config.json` |
| macOS | `~/Library/Application Support/reposeance/config.json` |
| Windows | `%APPDATA%\reposeance\config.json` |

Contents: Ollama URL, default model, indexing/retrieval settings, CLI preferences.

## Index Storage

Repository indexes are stored in your user cache directory:

| OS | Location |
|----|----------|
| Linux | `~/.cache/reposeance/repositories/<repo-hash>/` |
| macOS | `~/Library/Caches/reposeance/repositories/<repo-hash>/` |
| Windows | `%LOCALAPPDATA%\reposeance\repositories\<repo-hash>\` |

Each repository gets a unique hash based on its absolute path. The index contains:
- File metadata (path, language, size, hash, timestamps)
- Code chunks (content, line ranges, symbols)
- Symbol table (names, types, locations)
- Git commits (hash, author, date, message, changed files)

**Indexes are never shared or uploaded.**

## Network Activity

### Required: Ollama

RepoSeance communicates with a local Ollama instance (default: `http://localhost:11434`):

| Request | Purpose |
|---------|---------|
| `GET /api/tags` | List available models |
| `POST /api/chat` | Generate AI responses |

**All traffic stays on localhost.** No external network requests are made.

### Optional: Remote Ollama

You *can* configure a remote Ollama instance:

```bash
reposeance init --ollama-url http://remote-server:11434
```

**Warning**: This sends your repository context (code chunks, commit history) to the remote server. Only use trusted infrastructure.

## Security Measures

### Secrets Exclusion

The scanner automatically excludes:
- `.env`, `.env.local`, `.env.*.local`
- `*.key`, `*.pem`, `*.cert`, `*.crt`, `*.p12`, `*.pfx`
- SSH keys (`id_rsa`, `id_ed25519`, `id_dsa`)
- `secrets.*`, `credentials.*`, `*.secret`

### Binary Detection

Files are checked for text content. Binary files are skipped entirely.

### Size Limits

Default limits prevent resource exhaustion:
- Max file size: 1 MB
- Max total files: 10,000
- Chunk size: 80 lines (20 overlap)

### Git Safety

- **Read-only operations only** — `git log`, `git blame`, `git show`, `git diff`
- **No modifications** — No `git commit`, `git push`, `git reset --hard`
- **Argument-based execution** — `execa` with array arguments, no shell

### Process Isolation

- No `eval()` or dynamic code execution
- No `require()` of repository code
- Repository content treated as untrusted data

## Data Retention

| Data | Retention |
|------|-----------|
| Source code | Forever (your repo) |
| Git history | Forever (your repo) |
| Local index | Until `reposeance clear` |
| Configuration | Until changed/deleted |
| Chat history | Current session only |

### Clearing Data

```bash
# Clear repository index only
reposeance clear

# Clear all RepoSeance data
rm -rf ~/.cache/reposeance  # Linux/macOS
rm -rf %LOCALAPPDATA%\reposeance  # Windows
```

## Compliance

### GDPR

- No personal data collected
- No data processing agreements needed
- Right to erasure: `reposeance clear` or delete cache directory

### SOC 2 / ISO 27001

- No third-party data processors
- All processing on user-controlled infrastructure
- Encryption at rest: depends on your filesystem
- Encryption in transit: localhost only (or your TLS for remote Ollama)

## Third-Party Dependencies

### Runtime Dependencies

| Package | Purpose | Data Access |
|---------|---------|-------------|
| `commander` | CLI parsing | CLI args only |
| `chalk` | Terminal colors | None |
| `ora` | Spinners | None |
| `@clack/prompts` | Interactive prompts | User input only |
| `zod` | Config validation | Config file only |
| `env-paths` | Config paths | OS env only |
| `simple-git` | Git operations | Your repo (read-only) |
| `fast-glob` | File patterns | Your repo |
| `ignore` | .gitignore parsing | Your repo |
| `minisearch` | Local search | Index data only |
| `ollama` (fetch) | LLM API | Localhost only |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tsup` | Bundling |
| `vitest` | Testing |
| `oxlint` | Linting |

All dependencies are open-source and auditable.

## Audit Trail

You can verify what RepoSeance does:

1. **Source code**: Fully open source at `github.com/CodesWithSubham/reposeance`
2. **Build**: Reproducible via `pnpm build`
3. **Runtime**: Run with `NODE_DEBUG=*` to trace filesystem/network calls
4. **Network**: Monitor with `netstat` or `wireshark` — only localhost:11434

## Incident Response

If you suspect a privacy issue:

1. Stop using RepoSeance
2. Clear index: `reposeance clear`
3. Review network traffic
4. Report issue at [GitHub Issues](https://github.com/CodesWithSubham/reposeance/issues)

## Contact

For privacy questions: Open a [GitHub Discussion](https://github.com/CodesWithSubham/reposeance/discussions) or [Issue](https://github.com/CodesWithSubham/reposeance/issues).

---

**Last updated**: 2026-10-31
**Version**: 1.0.0
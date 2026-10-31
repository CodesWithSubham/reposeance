# 👻 RepoSeance

### Talk to the ghosts of your codebase.

RepoSeance is an open-source, local-first AI codebase archaeologist that helps developers understand unfamiliar repositories, investigate forgotten implementation decisions, and reconstruct software history.

Powered by local open-weight language models through Ollama, RepoSeance combines source-code analysis, Git archaeology, and retrieval-augmented generation to answer questions with verifiable evidence.

**Your codebase has a story. Let's uncover it.**

---

## ✨ Features

- 🔍 **Repository structure and source-code analysis** — Scan TypeScript/JavaScript projects, extract symbols, imports, and exports
- 🕰️ **Git history and implementation archaeology** — Investigate commit history, blame, and implementation evolution
- 🧠 **Local AI-powered codebase question answering** — Ask questions about your codebase using local LLMs
- 📚 **Evidence-backed answers with file and line references** — Every answer cites actual source code
- 💬 **Interactive terminal conversations** — Chat with your repository in a natural way
- 🔒 **Local-first processing and privacy** — Your code never leaves your machine
- ⚡ **Lightweight CLI with no cloud AI dependency** — Runs entirely locally

---

## 🛠️ Built With

- TypeScript and Node.js
- Ollama and Gemma
- MiniSearch
- Git
- Commander.js

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Git
- [Ollama](https://ollama.com/) installed and running

### Installation

```bash
# Install globally via npm
npm install -g reposeance

# Or use npx
npx reposeance
```

### Setup

```bash
# Initialize RepoSeance in your project
cd your-project
reposeance init

# Index your repository
reposeance index

# Start asking questions!
reposeance ask "What does this repository do?"

# Or start an interactive chat
reposeance chat
```

---

## 📖 Usage

### Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize RepoSeance configuration |
| `index` | Scan and index the repository |
| `ask` | Ask a single question about the repository |
| `chat` | Start an interactive chat session |
| `history` | Investigate Git history |
| `status` | Show index and model status |
| `doctor` | Diagnose dependencies and configuration |
| `clear` | Clear the local repository index |

### Examples

```bash
# Initialize with custom Ollama URL and model
reposeance init --ollama-url http://localhost:11434 --model gemma3:4b

# Index the current repository
reposeance index

# Force a fresh index
reposeance index --force

# Ask a question
reposeance ask "How does authentication work?"

# Ask with a specific model
reposeance ask "Explain the database layer" --model gemma3:4b

# Investigate Git history
reposeance history src/features/auth

# Show blame for a file
reposeance history src/auth/session.ts --blame

# Start interactive chat
reposeance chat

# Check system health
reposeance doctor

# Show status
reposeance status

# Clear index
reposeance clear
```

### Interactive Chat Commands

During a chat session:
- Type your question and press Enter
- `exit` / `quit` — Exit the chat
- `clear` — Clear conversation history
- `help` — Show help
- `Ctrl+C` — Exit gracefully

---

## ⚙️ Configuration

RepoSeance stores configuration in your system's config directory:

- **Linux/macOS**: `~/.config/reposeance/config.json`
- **Windows**: `%APPDATA%\reposeance\config.json`

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "gemma3:1b",
    "timeout": 120000
  },
  "indexing": {
    "maxFileSize": 1048576,
    "maxTotalFiles": 10000,
    "chunkSize": 80,
    "chunkOverlap": 20
  },
  "retrieval": {
    "maxCodeChunks": 10,
    "maxSymbols": 20,
    "maxCommits": 10,
    "maxContextTokens": 8000
  },
  "cli": {
    "theme": "auto",
    "verbose": false,
    "jsonOutput": false
  }
}
```

### Environment Variables

- `REPOSEANCE_OLLAMA_URL` — Override Ollama base URL
- `REPOSEANCE_MODEL` — Override default model
- `REPOSEANCE_VERBOSE` — Enable verbose output (true/false)

---

## 🔒 Privacy & Security

RepoSeance is designed with privacy as a core principle:

- **No external network requests** — All AI inference happens locally via Ollama
- **No code uploads** — Your source code never leaves your machine
- **No telemetry** — No usage data is collected
- **Local index storage** — Repository indexes stored in your user cache directory
- **No code execution** — RepoSeance never executes scanned code
- **Git read-only** — Never modifies your repository

### Index Location

Indexes are stored in your user cache directory:
- **Linux/macOS**: `~/.cache/reposeance/repositories/<repo-hash>/`
- **Windows**: `%LOCALAPPDATA%\reposeance\repositories\<repo-hash>\`

---

## 🏗️ Architecture

RepoSeance follows a modular architecture:

```
src/
├── cli/              # CLI interface (Commander.js)
│   ├── commands/     # Individual command implementations
│   └── ui/           # Terminal UI components
├── core/             # Core business logic
│   ├── repository/   # Git repository detection
│   ├── scanner/      # File discovery and filtering
│   ├── analyzer/     # Code analysis (TS/JS)
│   ├── git/          # Git history analysis
│   ├── indexer/      # MiniSearch indexing
│   ├── rag/          # RAG pipeline
│   ├── evidence/     # Evidence validation
│   └── llm/          # LLM provider abstraction
├── config/           # Configuration management
└── shared/           # Shared types, schemas, errors, utils
```

### Data Flow

1. **Indexing**: `reposeance index`
   - Git repo detection → File discovery → Code analysis → Git history → Indexing → Persistence
2. **Querying**: `reposeance ask` / `reposeance chat`
   - Question → Retrieval (code + Git) → Context assembly → LLM → Evidence validation → Response

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run type checks
pnpm typecheck

# Lint
pnpm lint
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/CodesWithSubham/reposeance.git
cd reposeance

# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Ollama](https://ollama.com/) for local LLM inference
- [Gemma](https://github.com/google/gemma) for open-weight models
- [MiniSearch](https://github.com/lucaong/minisearch) for lightweight search
- [Commander.js](https://github.com/tj/commander.js) for CLI framework
- [TypeScript](https://www.typescriptlang.org/) for type safety

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/CodesWithSubham/reposeance/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CodesWithSubham/reposeance/discussions)

---

**RepoSeance** — Because every codebase has a story worth uncovering. 👻
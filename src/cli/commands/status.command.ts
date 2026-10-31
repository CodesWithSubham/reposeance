import { Command } from 'commander';
import { loadConfig } from '../../config';
import { renderStatus, printSection, renderJson } from '../ui/renderer';
import { findGitRoot } from '../../core/repository';
import { loadRepositoryIndexByRoot } from '../../core/indexer';
import { createOllamaProvider } from '../../core/llm/ollama.provider';

export const statusCommand = new Command('status')
  .description('Show index and model status')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }, command: any) => {
    const isJson = options.json || command?.parent?.opts()?.json || false;

    if (!isJson) {
      printSection('Status');
    }

    const config = await loadConfig();
    const rootPath = await findGitRoot();

    // Check Ollama status
    let ollamaConnected = false;
    let modelAvailable = false;
    try {
      const ollamaProvider = createOllamaProvider(config.ollama);
      const models = await ollamaProvider.listModels();
      ollamaConnected = true;
      const modelPrefix = config.ollama.model.split(':')[0] ?? '';
      modelAvailable = models.some(m => m === config.ollama.model || m.startsWith(modelPrefix));
    } catch {
      ollamaConnected = false;
      modelAvailable = false;
    }

    if (!rootPath) {
      const statusData = {
        indexed: false,
        ollamaConnected,
        modelAvailable,
        currentModel: config.ollama.model,
      };
      if (isJson) {
        renderJson(statusData);
      } else {
        renderStatus(statusData);
      }
      return;
    }

    const index = await loadRepositoryIndexByRoot(rootPath);

    const statusData = index
      ? {
          indexed: true,
          repository: index.metadata.name,
          lastIndexed: index.metadata.indexedAt,
          totalFiles: index.metadata.totalFiles,
          totalChunks: index.metadata.totalChunks,
          headCommit: index.metadata.headCommit,
          ollamaConnected,
          modelAvailable,
          currentModel: config.ollama.model,
        }
      : {
          indexed: false,
          ollamaConnected,
          modelAvailable,
          currentModel: config.ollama.model,
        };

    if (isJson) {
      renderJson(statusData);
    } else {
      renderStatus(statusData);
    }
  });

statusCommand.addHelpText('after', `
Examples:
  $ reposeance status
  $ reposeance status --json
`);

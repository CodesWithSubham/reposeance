import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { renderError, renderInfo, renderAnswer, renderChatPrompt, printSection } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { loadConfig } from '../../config';
import { findGitRoot } from '../../core/repository';
import { loadRepositoryIndexByRoot } from '../../core/indexer';
import { createOllamaProvider } from '../../core/llm/ollama.provider';
import { runRAGPipeline } from '../../core/rag';
import ora from 'ora';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  evidence?: {
    sourceReferences: Array<{ type: 'source'; path: string; startLine?: number | undefined; endLine?: number | undefined }>;
    commitReferences: Array<{ type: 'commit'; commitHash: string }>;
    validCount: number;
    invalidCount: number;
  };
}

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session with the repository')
  .option('-m, --model <model>', 'Override default model')
  .option('-s, --scope <path>', 'Limit scope to specific directory')
  .action(async (options: { model?: string; scope?: string }) => {
    printSection('Interactive Chat');

    try {
      const config = await loadConfig();
      const rootPath = await findGitRoot();
      if (!rootPath) {
        throw new RepositoryError('Not inside a Git repository', ['Run "git init" to initialize a repository']);
      }

      // Load index
      const spinner = ora('Loading repository index...').start();
      let index = await loadRepositoryIndexByRoot(rootPath);

      if (!index) {
        spinner.fail('No index found');
        throw new RepositoryError('Repository not indexed', [
          'Run "reposeance index" to create an index',
        ]);
      }

      spinner.succeed(`Loaded index for ${index.metadata.name} (${index.metadata.totalChunks} chunks)`);

      // Verify model
      const ollamaProvider = createOllamaProvider(config.ollama);
      const modelToCheck = options.model ?? config.ollama.model;
      const modelAvailable = await ollamaProvider.checkModel(modelToCheck);
      if (!modelAvailable) {
        spinner.fail(`Model "${modelToCheck}" not found`);
        throw new RepositoryError('Model not available', [
          `Run: ollama pull ${modelToCheck}`,
        ]);
      }

      spinner.succeed('Ready to chat');

      // Chat loop
      const history: ChatMessage[] = [];
      let running = true;

      console.log();
      renderInfo('Type your questions. Press Ctrl+C to exit.');
      console.log();

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      try {
        while (running) {
          let question: string;
          try {
            question = await rl.question(renderChatPrompt());
          } catch {
            break;
          }

          const trimmed = question.trim();
          if (!trimmed) {
            continue;
          }

          if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
            running = false;
            break;
          }

          if (trimmed.toLowerCase() === 'clear') {
            history.length = 0;
            renderInfo('Conversation history cleared.');
            continue;
          }

          if (trimmed.toLowerCase() === 'help') {
            renderInfo('Commands:');
            renderInfo('  exit/quit - Exit chat');
            renderInfo('  clear - Clear conversation history');
            renderInfo('  help - Show this help');
            continue;
          }

          // Add user message to history
          history.push({ role: 'user', content: trimmed });

          // Run RAG
          const askSpinner = ora('Thinking...').start();

          try {
            const ragOptions = {
              temperature: 0.1,
              maxTokens: 2048,
              maxContextTokens: config.retrieval.maxContextTokens,
              scope: options.scope,
              history: history.slice(-6).map(h => ({ role: h.role, content: h.content })),
              ...(options.model ? { model: options.model } : {}),
            };

            const response = await runRAGPipeline(ollamaProvider, index, trimmed, ragOptions);

            askSpinner.succeed('Answer ready');

            renderAnswer(response.answer, [
              ...response.evidence.sourceReferences
                .filter(r => r.path !== undefined)
                .map(r => ({
                  type: 'source' as const,
                  path: r.path!,
                  startLine: r.startLine,
                  endLine: r.endLine,
                })),
              ...response.evidence.commitReferences
                .filter(r => r.commitHash !== undefined)
                .map(r => ({
                  type: 'commit' as const,
                  commitHash: r.commitHash!,
                })),
            ], response.confidence);

            // Add to history
            history.push({
              role: 'assistant',
              content: response.answer,
              evidence: {
                sourceReferences: response.evidence.sourceReferences
                  .filter(r => r.path !== undefined)
                  .map(r => ({
                    type: 'source' as const,
                    path: r.path!,
                    startLine: r.startLine,
                    endLine: r.endLine,
                  })),
                commitReferences: response.evidence.commitReferences
                  .filter(r => r.commitHash !== undefined)
                  .map(r => ({
                    type: 'commit' as const,
                    commitHash: r.commitHash!,
                  })),
                validCount: response.evidence.validCount,
                invalidCount: response.evidence.invalidCount,
              },
            });

          } catch (error) {
            askSpinner.fail('Failed to get answer');
            renderError(`Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } finally {
        rl.close();
      }

      renderInfo('\nGoodbye! 👻');
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      renderError(`Chat failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new RepositoryError('Chat failed', ['Check the error above for details']);
    }
  });

chatCommand.addHelpText('after', `
Examples:
  $ reposeance chat
  $ reposeance chat --model gemma3:4b
  $ reposeance chat --scope src/features/auth

Commands in chat:
  exit/quit - Exit chat session
  clear - Clear conversation history
  help - Show help
`);
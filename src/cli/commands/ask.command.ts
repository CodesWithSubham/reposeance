import { Command } from 'commander';
import { renderError, renderInfo, renderAnswer, printSection, renderJson } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { loadConfig } from '../../config';
import { findGitRoot } from '../../core/repository';
import { loadRepositoryIndexByRoot, checkIndexFreshness, createRepositoryIndex, buildSearchIndexes } from '../../core/indexer';
import { scanRepository } from '../../core/scanner';
import { analyzeFile } from '../../core/analyzer';
import { getCommitHistory } from '../../core/git';
import { createOllamaProvider } from '../../core/llm/ollama.provider';
import { runRAGPipeline } from '../../core/rag';
import ora from 'ora';

export const askCommand = new Command('ask')
  .description('Ask a single question about the repository')
  .argument('<question>', 'Question to ask')
  .option('-m, --model <model>', 'Override default model')
  .option('-s, --scope <path>', 'Limit scope to specific directory')
  .option('-v, --verbose', 'Show retrieval details')
  .option('--json', 'Output as JSON')
  .action(async (question: string, options: { model?: string; scope?: string; verbose?: boolean; json?: boolean }) => {
    if (!options.json) {
      printSection('Ask the Ghost');
    }

    try {
      const config = await loadConfig();
      const rootPath = await findGitRoot();
      if (!rootPath) {
        throw new RepositoryError('Not inside a Git repository', ['Run "git init" to initialize a repository']);
      }

      // Load or create index
      const spinner = options.json ? null : ora('Loading repository index...').start();
      let index = await loadRepositoryIndexByRoot(rootPath);

      if (!index) {
        if (spinner) {
          spinner.text = 'No index found. Indexing repository...';
        }
        const scanResult = await scanRepository(rootPath, config.indexing);
        const allSymbols: any[] = [];
        const allChunks: any[] = [];
        const fileRecords: any[] = [];

        for (const file of scanResult.files) {
          const analysis = await analyzeFile(file, config.indexing);
          fileRecords.push({
            path: file.relativePath,
            language: file.language,
            size: file.size,
            hash: file.hash,
            lastModified: file.lastModified,
            symbols: analysis.symbols,
            imports: analysis.imports,
            exports: analysis.exports,
          });
          allSymbols.push(...analysis.symbols);
          allChunks.push(...analysis.chunks);
        }

        const commits = await getCommitHistory(rootPath, 500);
        index = await createRepositoryIndex(
          rootPath,
          config.indexing,
          fileRecords,
          allChunks,
          allSymbols,
          commits,
        );
        await buildSearchIndexes(index);

        if (spinner) {
          spinner.succeed(`Created index for ${index.metadata.name} (${index.metadata.totalChunks} chunks)`);
        }
      } else {
        if (spinner) {
          spinner.succeed(`Loaded index for ${index.metadata.name} (${index.metadata.totalChunks} chunks)`);
        }

        // Check index freshness
        const freshness = await checkIndexFreshness(rootPath);
        if (!freshness.isFresh && spinner) {
          spinner.warn(`Index may be stale (${freshness.reason}). Consider running "reposeance index"`);
        }
      }

      const ollamaProvider = createOllamaProvider(config.ollama);

      // Verify model availability
      const modelToCheck = options.model ?? config.ollama.model;
      const modelAvailable = await ollamaProvider.checkModel(modelToCheck);
      if (!modelAvailable) {
        if (spinner) spinner.fail(`Model "${modelToCheck}" not found in Ollama`);
        throw new RepositoryError('Model not available', [
          `Run: ollama pull ${modelToCheck}`,
          'Or specify a different model with --model',
        ]);
      }

      if (spinner) {
        spinner.succeed('Model available');
      }

      // Run RAG pipeline
      if (spinner) {
        spinner.text = 'Querying repository...';
        spinner.start();
      }

      const ragOptions = {
        temperature: 0.1,
        maxTokens: 2048,
        maxContextTokens: config.retrieval.maxContextTokens,
        scope: options.scope,
        ...(options.model ? { model: options.model } : {}),
      };

      const response = await runRAGPipeline(ollamaProvider, index, question, ragOptions);

      if (spinner) {
        spinner.succeed('Answer ready');
      }

      // Output
      if (options.json) {
        renderJson({
          question,
          answer: response.answer,
          confidence: response.confidence,
          evidence: {
            sourceReferences: response.evidence.sourceReferences,
            commitReferences: response.evidence.commitReferences,
            validCount: response.evidence.validCount,
            invalidCount: response.evidence.invalidCount,
          },
        });
      } else {
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
      }

      if (options.verbose && !options.json) {
        renderInfo('\n--- Retrieval Details ---');
        renderInfo(`Question: ${question}`);
        renderInfo(`Model: ${options.model || config.ollama.model}`);
        renderInfo(`Confidence: ${response.confidence}`);
        renderInfo(`Valid evidence: ${response.evidence.validCount}`);
        renderInfo(`Invalid evidence: ${response.evidence.invalidCount}`);
      }
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      renderError(`Ask failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new RepositoryError('Ask failed', ['Check the error above for details']);
    }
  });

askCommand.addHelpText('after', `
Examples:
  $ reposeance ask "Why does the authentication module exist?"
  $ reposeance ask "How does authentication work?" --scope src/features/auth
  $ reposeance ask "Explain the database layer" --model gemma3:4b
  $ reposeance ask "What changed recently?" --verbose --json
`);
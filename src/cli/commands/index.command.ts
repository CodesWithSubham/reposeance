import { Command } from 'commander';
import { renderInfo, renderError, renderSuccess, renderIndexSummary, printSection } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { loadConfig } from '../../config';
import { findGitRoot, getRepositoryInfo, getRepositoryMetadata } from '../../core/repository';
import { scanRepository } from '../../core/scanner';
import { analyzeFile } from '../../core/analyzer';
import { IndexingConfig } from '../../shared/types';
import ora from 'ora';

export const indexCommand = new Command('index')
  .description('Scan and index the current repository')
  .option('-f, --force', 'Force a fresh index, ignoring cached data')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (options: { force?: boolean; verbose?: boolean }) => {
    printSection('Repository Indexing');

    try {
      const config = await loadConfig();
      const indexingConfig: IndexingConfig = config.indexing;

      // Step 1: Find Git repository
      const spinner = ora('Finding Git repository...').start();
      const rootPath = await findGitRoot();
      if (!rootPath) {
        spinner.fail('Not inside a Git repository');
        throw new RepositoryError('Not inside a Git repository', ['Run "git init" to initialize a repository']);
      }
      spinner.succeed(`Found repository at ${rootPath}`);

      // Step 2: Get repository info
      spinner.text = 'Reading repository metadata...';
      spinner.start();
      const repoInfo = await getRepositoryInfo(rootPath);
      const metadata = await getRepositoryMetadata(rootPath);
      spinner.succeed(`Repository: ${repoInfo.name}`);

      // Step 3: Scan files
      spinner.text = 'Scanning files...';
      spinner.start();
      const scanResult = await scanRepository(rootPath, indexingConfig);
      spinner.succeed(`Scanned ${scanResult.totalScanned} files (${scanResult.excluded.length} excluded)`);

      // Step 4: Analyze files
      spinner.text = 'Analyzing source code...';
      spinner.start();
      let totalSymbols = 0;
      let totalChunks = 0;
      const languages = new Set<string>();

      for (const file of scanResult.files) {
        languages.add(file.language);
        const analysis = await analyzeFile(file);
        totalSymbols += analysis.symbols.length;
        totalChunks += analysis.chunks.length;

        if (options.verbose) {
          renderInfo(`  ${file.relativePath}: ${analysis.symbols.length} symbols, ${analysis.chunks.length} chunks`);
        }
      }
      spinner.succeed(`Analyzed ${scanResult.files.length} files: ${totalSymbols} symbols, ${totalChunks} chunks`);

      // Step 5: Git history (placeholder for Milestone 3)
      spinner.text = 'Git history analysis not yet implemented (Milestone 3)';
      spinner.start();
      const commitsAnalyzed = 0;
      spinner.warn('Skipped (Milestone 3)');

      // Step 6: Indexing (placeholder for Milestone 4)
      spinner.text = 'Indexing not yet implemented (Milestone 4)';
      spinner.start();
      spinner.warn('Skipped (Milestone 4)');

      // Summary
      renderIndexSummary({
        repository: repoInfo.name,
        filesScanned: scanResult.files.length + scanResult.excluded.length,
        filesIndexed: scanResult.files.length,
        languages: Array.from(languages),
        commitsAnalyzed,
      });

      renderSuccess('Repository scanning complete! Next steps:');
      renderInfo('  • Milestone 3: Implement Git history analysis');
      renderInfo('  • Milestone 4: Implement local index and search');
      renderInfo('  • Milestone 5: Implement Ollama integration and RAG');
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      renderError(`Indexing failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new RepositoryError('Indexing failed', ['Check the error above for details']);
    }
  });

indexCommand.addHelpText('after', `
Examples:
  $ reposeance index
  $ reposeance index --force
  $ reposeance index --verbose
`);
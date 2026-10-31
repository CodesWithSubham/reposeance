import { Command } from 'commander';
import { renderInfo, renderError, renderSuccess, renderIndexSummary, printSection } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { loadConfig } from '../../config';
import { findGitRoot, getRepositoryInfo, getRepositoryMetadata } from '../../core/repository';
import { scanRepository } from '../../core/scanner';
import { analyzeFile } from '../../core/analyzer';
import { createRepositoryIndex, checkIndexFreshness, buildSearchIndexes } from '../../core/indexer';
import { getCommitHistory } from '../../core/git';
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
      await getRepositoryMetadata(rootPath);
      spinner.succeed(`Repository: ${repoInfo.name}`);

      // Step 3: Check if index is fresh (unless --force)
      if (!options.force) {
        spinner.text = 'Checking index freshness...';
        spinner.start();
        const freshness = await checkIndexFreshness(rootPath);
        if (freshness.isFresh) {
          spinner.succeed('Index is up to date');
          renderInfo('Use --force to re-index');
          return;
        } else {
          spinner.warn(`Index stale: ${freshness.reason}. Re-indexing...`);
        }
      } else {
        spinner.text = 'Force re-index requested...';
        spinner.start();
        spinner.succeed('Force re-index requested');
      }

      // Step 4: Scan files
      spinner.text = 'Scanning files...';
      spinner.start();
      const scanResult = await scanRepository(rootPath, indexingConfig);
      spinner.succeed(`Scanned ${scanResult.totalScanned} files (${scanResult.excluded.length} excluded)`);

      // Step 5: Analyze files
      spinner.text = 'Analyzing source code...';
      spinner.start();
      let totalSymbols = 0;
      let totalChunks = 0;
      const languages = new Set<string>();
      const analyzedFiles: Array<{
        file: typeof scanResult.files[0];
        analysis: { symbols: any[]; chunks: any[]; imports: any[]; exports: any[] };
      }> = [];

      for (const file of scanResult.files) {
        languages.add(file.language);
        const analysis = await analyzeFile(file, indexingConfig);
        totalSymbols += analysis.symbols.length;
        totalChunks += analysis.chunks.length;
        analyzedFiles.push({ file, analysis });

        if (options.verbose) {
          renderInfo(`  ${file.relativePath}: ${analysis.symbols.length} symbols, ${analysis.chunks.length} chunks`);
        }
      }
      spinner.succeed(`Analyzed ${scanResult.files.length} files: ${totalSymbols} symbols, ${totalChunks} chunks`);

      // Step 6: Git history
      spinner.text = 'Analyzing Git history...';
      spinner.start();
      const commits = await getCommitHistory(rootPath, 500);
      const commitsAnalyzed = commits.length;
      spinner.succeed(`Analyzed ${commitsAnalyzed} commits`);

      // Step 7: Prepare data for indexing
      spinner.text = 'Preparing index data...';
      spinner.start();

      // Collect all symbols from all files
      const allSymbols: any[] = [];
      const allChunks: any[] = [];
      const fileRecords: any[] = [];

      for (const { file, analysis } of analyzedFiles) {
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
      spinner.succeed(`Prepared ${allChunks.length} chunks, ${allSymbols.length} symbols for indexing`);

      // Step 8: Create and persist index
      spinner.text = 'Building search index...';
      spinner.start();

      const index = await createRepositoryIndex(
        rootPath,
        indexingConfig,
        fileRecords,
        allChunks,
        allSymbols,
        commits,
      );

      // Warm search indexes
      await buildSearchIndexes(index);
      const totalIndexed = allChunks.length;
      spinner.succeed(`Indexed ${totalIndexed} code chunks, ${allSymbols.length} symbols, ${index.commits.length} commits`);

      // Step 9: Summary
      renderIndexSummary({
        repository: repoInfo.name,
        filesScanned: scanResult.files.length + scanResult.excluded.length,
        filesIndexed: scanResult.files.length,
        languages: Array.from(languages),
        commitsAnalyzed,
      });

      renderSuccess('Repository indexed successfully!');
      renderInfo('Next steps:');
      renderInfo('  • Run "reposeance ask <question>" to query the repository');
      renderInfo('  • Run "reposeance chat" for interactive session');
      renderInfo('  • Run "reposeance status" to see index info');
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
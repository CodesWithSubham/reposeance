import { Command } from 'commander';
import { renderError, renderInfo, renderSuccess, printSection } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { findGitRoot } from '../../core/repository';
import { deleteRepositoryIndex, loadRepositoryIndexByRoot } from '../../core/indexer';
import { confirm, isCancel } from '@clack/prompts';

export const clearCommand = new Command('clear')
  .description('Clear the local repository index')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options: { force?: boolean }) => {
    printSection('Clear Index');

    const rootPath = await findGitRoot();
    if (!rootPath) {
      throw new RepositoryError('Not inside a Git repository', ['Run "git init" to initialize a repository']);
    }

    const index = await loadRepositoryIndexByRoot(rootPath);
    if (!index) {
      renderInfo('No index found for this repository.');
      return;
    }

    renderInfo(`Repository: ${index.metadata.name}`);
    renderInfo(`Indexed at: ${index.metadata.indexedAt}`);
    renderInfo(`Files: ${index.metadata.totalFiles}`);
    renderInfo(`Chunks: ${index.metadata.totalChunks}`);
    renderInfo(`Symbols: ${index.metadata.totalSymbols}`);
    renderInfo('');

    if (!options.force) {
      const confirmed = await confirm({
        message: 'Are you sure you want to delete this index?',
        initialValue: false,
      });

      if (isCancel(confirmed) || !confirmed) {
        renderInfo('Cancelled.');
        return;
      }
    }

    try {
      await deleteRepositoryIndex(index.metadata.id);
      renderSuccess('Index deleted successfully.');
    } catch (error) {
      renderError(`Failed to delete index: ${error instanceof Error ? error.message : String(error)}`);
      throw new RepositoryError('Clear failed', ['Check the error above for details']);
    }
  });

clearCommand.addHelpText('after', `
Examples:
  $ reposeance clear
  $ reposeance clear --force
`);
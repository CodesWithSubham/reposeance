import { Command } from 'commander';
import { isAbsolute, resolve } from 'node:path';
import { renderError, renderInfo, renderSuccess, renderHistory, printSection } from '../ui/renderer';
import { printSubsection } from '../ui/banner';
import { RepositoryError } from '../../shared/errors';
import { loadConfig } from '../../config';
import { findGitRoot } from '../../core/repository';
import { getCommitHistory, getFileHistory, getDirectoryHistory, getBlame, getCommitDetails } from '../../core/git';
import ora from 'ora';

export const historyCommand = new Command('history')
  .description('Investigate Git history for a file or directory')
  .argument('[path]', 'File or directory path to investigate')
  .option('-n, --limit <number>', 'Maximum number of commits to show', '20')
  .option('-v, --verbose', 'Show commit details and patches')
  .option('--json', 'Output as JSON')
  .option('--blame', 'Show git blame for a file')
  .action(async (path: string, options: { limit: string; verbose: boolean; json: boolean; blame: boolean }, command: any) => {
    const isJson = options.json || command?.parent?.opts()?.json || false;

    if (!isJson) {
      printSection('Git History');
    }

    try {
      await loadConfig();
      const rootPath = await findGitRoot();
      if (!rootPath) {
        throw new RepositoryError('Not inside a Git repository', ['Run "git init" to initialize a repository']);
      }

      const limit = parseInt(options.limit, 10);
      const spinner = isJson ? null : ora('Loading Git history...').start();

      if (options.blame && !path) {
        throw new RepositoryError('Missing file path for blame', [
          'Please specify a file path to blame: reposeance history <file> --blame',
        ]);
      }

      let commits;
      if (options.blame && path) {
        if (spinner) { spinner.text = `Getting blame for ${path}...`; spinner.start(); }
        const blame = await getBlame(rootPath, path);
        if (spinner) { spinner.succeed(`Blame for ${path}`); }
        if (isJson) {
          console.log(JSON.stringify(blame, null, 2));
          return;
        }
        renderBlame(blame);
        return;
      } else if (path) {
        // Check if it's a file or directory
        const fs = await import('node:fs/promises');
        const targetPath = isAbsolute(path) ? path : resolve(rootPath, path);
        try {
          const stats = await fs.stat(targetPath);
          if (stats.isFile()) {
            if (spinner) { spinner.text = `Loading history for file ${path}...`; }
            commits = await getFileHistory(rootPath, path, limit);
          } else {
            if (spinner) { spinner.text = `Loading history for directory ${path}...`; }
            commits = await getDirectoryHistory(rootPath, path, limit);
          }
        } catch {
          // Path might be a deleted file or git-tracked path not on disk
          if (spinner) { spinner.text = `Loading history for ${path}...`; }
          commits = await getFileHistory(rootPath, path, limit);
        }
      } else {
        if (spinner) { spinner.text = 'Loading repository history...'; }
        commits = await getCommitHistory(rootPath, limit);
      }

      if (spinner) { spinner.succeed(`Found ${commits.length} commits`); }

      if (isJson) {
        console.log(JSON.stringify(commits, null, 2));
        return;
      }

      if (commits.length === 0) {
        renderInfo('No commits found.');
        return;
      }

      renderHistory(commits);

      if (options.verbose && commits.length > 0) {
        printSubsection('Commit Details');
        for (const commit of commits.slice(0, 5)) {
          const details = await getCommitDetails(rootPath, commit.hash);
          renderInfo(`  ${commit.shortHash} ${commit.message} (${commit.date})`);
          if (details.changedFiles.length > 0) {
            renderInfo(`    Changed files: ${details.changedFiles.join(', ')}`);
          }
        }
        if (commits.length > 5) {
          renderInfo(`  ... and ${commits.length - 5} more commits`);
        }
      }

      renderSuccess(`\nRun "reposeance history <path> --blame" to see line-by-line blame for a file.`);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      renderError(`History failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new RepositoryError('History command failed', ['Check the error above for details']);
    }
  });

function renderBlame(blame: { filePath: string; lines: Array<{ lineNumber: number; commitHash: string; author: string; date: string }> }): void {
  console.log();
  console.log(`Blame for ${blame.filePath}:`);
  console.log();
  for (const line of blame.lines) {
    const shortHash = line.commitHash.substring(0, 7);
    const shortDate = line.date.split('T')[0];
    console.log(`  ${shortHash} (${line.author}, ${shortDate})  ${line.lineNumber.toString().padStart(4)}`);
  }
  console.log();
}

historyCommand.addHelpText('after', `
Examples:
  $ reposeance history
  $ reposeance history src/features/auth
  $ reposeance history src/auth/session.ts --limit 10
  $ reposeance history src/auth/session.ts --blame
  $ reposeance history --verbose --json
`);
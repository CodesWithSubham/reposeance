import { Command } from 'commander';
import { renderError, renderInfo, printSection } from '../ui/renderer';

export const historyCommand = new Command('history')
  .description('Investigate Git history for a file or directory')
  .argument('[path]', 'File or directory path to investigate')
  .option('-n, --limit <number>', 'Maximum number of commits to show', '20')
  .option('-v, --verbose', 'Show commit details and patches')
  .option('--json', 'Output as JSON')
  .action(async (_path: string, _options: Record<string, unknown>) => {
    printSection('Git History');

    // TODO: Implement actual history logic
    // For now, show placeholder output
    renderError('History not yet implemented. This is Milestone 3 work.');
    renderInfo('');
    renderInfo('Planned functionality:');
    renderInfo('  • Retrieve commit history for path');
    renderInfo('  • Show commit messages, authors, dates');
    renderInfo('  • Display changed files per commit');
    renderInfo('  • Support file-specific and directory-specific history');
    renderInfo('  • Implement git blame lookup');
    renderInfo('  • Retrieve commit patches on demand');
  });

historyCommand.addHelpText('after', `
Examples:
  $ reposeance history
  $ reposeance history src/features/auth
  $ reposeance history src/auth/session.ts --limit 10
  $ reposeance history --verbose --json
`);
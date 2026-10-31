import { Command } from 'commander';
import { printBanner, getMiniBanner } from './ui/banner';
import { handleError } from '../shared/errors';
import { initCommand } from './commands/init.command';
import { indexCommand } from './commands/index.command';
import { askCommand } from './commands/ask.command';
import { chatCommand } from './commands/chat.command';
import { historyCommand } from './commands/history.command';
import { statusCommand } from './commands/status.command';
import { doctorCommand } from './commands/doctor.command';
import { clearCommand } from './commands/clear.command';
import { loadConfig } from '../config';

const program = new Command();

program
  .name('reposeance')
  .description('An open-source, local-first AI codebase archaeologist. Talk to the ghosts of your codebase.')
  .version('1.0.0')
  .hook('preAction', async () => {
    // Load config early for commands that need it
    await loadConfig();
  });

// Global options
program
  .option('-v, --verbose', 'Enable verbose output')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colored output');

// Register commands
program.addCommand(initCommand);
program.addCommand(indexCommand);
program.addCommand(askCommand);
program.addCommand(chatCommand);
program.addCommand(historyCommand);
program.addCommand(statusCommand);
program.addCommand(doctorCommand);
program.addCommand(clearCommand);

// Custom help
program.addHelpText('before', `
${getMiniBanner()}
`);

program.addHelpText('after', `
Commands:
  init       Initialize RepoSeance configuration
  index      Scan and index repository
  ask        Ask a single question
  chat       Interactive chat session
  history    Investigate Git history
  status     Show index and model status
  doctor     Diagnose dependencies
  clear      Clear local index

Global Options:
  -v, --verbose     Enable verbose output
  --json            Output as JSON
  --no-color        Disable colored output
  -h, --help        Display help
  -V, --version     Display version

Examples:
  $ reposeance init
  $ reposeance index
  $ reposeance ask "Why does auth exist?"
  $ reposeance chat
  $ reposeance history src/auth
  $ reposeance doctor

For more information, visit: https://github.com/CodesWithSubham/reposeance
`);

// Handle unknown commands
program.on('command:*', () => {
  console.error('Error: Unknown command');
  program.help();
  process.exit(1);
});

// Parse arguments
async function main(): Promise<void> {
  try {
    // Show banner for main commands (not help/version)
    const args = process.argv.slice(2);
    const isHelp = args.includes('-h') || args.includes('--help');
    const isVersion = args.includes('-V') || args.includes('--version');
    const isJson = args.includes('--json');
    const isSubcommand = args.length > 0 && args[0] !== undefined && !args[0].startsWith('-');

    if (!isHelp && !isVersion && !isJson && isSubcommand) {
      printBanner();
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

main();
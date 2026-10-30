import { Command } from 'commander';
import { renderError, renderInfo, printSection } from '../ui/renderer';

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session with the repository')
  .option('-m, --model <model>', 'Override default model')
  .option('-s, --scope <path>', 'Limit scope to specific directory')
  .action(async (_options: Record<string, unknown>) => {
    printSection('Interactive Chat');

    // TODO: Implement actual chat logic
    // For now, show placeholder output
    renderError('Chat not yet implemented. This is Milestone 6 work.');
    renderInfo('');
    renderInfo('Planned functionality:');
    renderInfo('  • Interactive REPL with session memory');
    renderInfo('  • Conversational context across questions');
    renderInfo('  • Graceful Ctrl+C handling');
    renderInfo('  • History navigation (up/down arrows)');
    renderInfo('  • Same retrieval and validation as ask command');
  });

chatCommand.addHelpText('after', `
Examples:
  $ reposeance chat
  $ reposeance chat --model gemma3:4b
  $ reposeance chat --scope src/features/auth
`);
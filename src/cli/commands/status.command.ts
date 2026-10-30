import { Command } from 'commander';
import { loadConfig } from '../../config';
import { renderStatus, printSection } from '../ui/renderer';

export const statusCommand = new Command('status')
  .description('Show index and model status')
  .option('--json', 'Output as JSON')
  .action(async (_options: Record<string, unknown>) => {
    printSection('Status');

    const config = await loadConfig();

    // TODO: Implement actual status check
    // For now, show placeholder output
    renderStatus({
      indexed: false,
      ollamaConnected: false,
      modelAvailable: false,
      currentModel: config.ollama.model,
    });
  });

statusCommand.addHelpText('after', `
Examples:
  $ reposeance status
  $ reposeance status --json
`);
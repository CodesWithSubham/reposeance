import { Command } from 'commander';
import { renderError, renderInfo, printSection } from '../ui/renderer';

export const askCommand = new Command('ask')
  .description('Ask a single question about the repository')
  .argument('<question>', 'Question to ask')
  .option('-m, --model <model>', 'Override default model')
  .option('-s, --scope <path>', 'Limit scope to specific directory')
  .option('-v, --verbose', 'Show retrieval details')
  .option('--json', 'Output as JSON')
  .action(async (_question: string, _options: Record<string, unknown>) => {
    printSection('Ask the Ghost');

    // TODO: Implement actual ask logic
    // For now, show placeholder output
    renderError('Ask not yet implemented. This is Milestone 5 work.');
    renderInfo('');
    renderInfo('Planned functionality:');
    renderInfo('  • Auto-index if no valid index exists');
    renderInfo('  • Retrieve relevant code chunks and Git history');
    renderInfo('  • Build context for LLM');
    renderInfo('  • Query Ollama with evidence-aware prompt');
    renderInfo('  • Validate citations against index');
    renderInfo('  • Render answer with evidence references');
  });

askCommand.addHelpText('after', `
Examples:
  $ reposeance ask "Why does the authentication module exist?"
  $ reposeance ask "How does authentication work?" --scope src/features/auth
  $ reposeance ask "Explain the database layer" --model gemma3:4b
  $ reposeance ask "What changed recently?" --verbose --json
`);
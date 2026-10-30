import { Command } from 'commander';
import { loadConfig, saveConfig, getConfigPath } from '../../config';
import { renderSuccess, renderInfo, printSection } from '../ui/renderer';

export const initCommand = new Command('init')
  .description('Initialize RepoSeance configuration')
  .option('--force', 'Overwrite existing configuration')
  .option('--ollama-url <url>', 'Ollama base URL')
  .option('--model <model>', 'Default model to use')
  .action(async (options) => {
    const config = await loadConfig();

    if (options.ollamaUrl) {
      config.ollama.baseUrl = options.ollamaUrl;
    }
    if (options.model) {
      config.ollama.model = options.model;
    }

    await saveConfig(config);

    printSection('Configuration Initialized');
    renderSuccess(`Configuration saved to: ${getConfigPath()}`);
    renderInfo(`Ollama URL: ${config.ollama.baseUrl}`);
    renderInfo(`Default model: ${config.ollama.model}`);
    renderInfo('');
    renderInfo('Next steps:');
    renderInfo('  1. Ensure Ollama is running: ollama serve');
    renderInfo(`  2. Pull the model: ollama pull ${config.ollama.model}`);
    renderInfo('  3. Run: reposeance index');
  });

initCommand.addHelpText('after', `
Examples:
  $ reposeance init
  $ reposeance init --ollama-url http://localhost:11434 --model gemma3:4b
  $ reposeance init --force
`);
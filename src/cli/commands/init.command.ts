import { Command } from 'commander';
import { loadConfig, saveConfig, getConfigPath } from '../../config';
import { renderSuccess, renderInfo, printSection } from '../ui/renderer';
import { createOllamaProvider } from '../../core/llm/ollama.provider';
import ora from 'ora';

export const initCommand = new Command('init')
  .description('Initialize RepoSeance configuration')
  .option('--force', 'Overwrite existing configuration')
  .option('--ollama-url <url>', 'Ollama base URL')
  .option('--model <model>', 'Default model to use')
  .option('--skip-ollama-check', 'Skip Ollama connectivity check')
  .action(async (options) => {
    printSection('Configuration Initialization');

    const config = await loadConfig();
    let hasChanges = false;

    if (options.ollamaUrl) {
      config.ollama.baseUrl = options.ollamaUrl;
      hasChanges = true;
    }
    if (options.model) {
      config.ollama.model = options.model;
      hasChanges = true;
    }

    if (!hasChanges && !options.force) {
      // Check if config already exists
      try {
        const fs = await import('node:fs/promises');
        const configPath = getConfigPath();
        await fs.access(configPath);
        renderInfo('Configuration already exists. Use --force to overwrite.');
        return;
      } catch {
        // Config doesn't exist, proceed
      }
    }

    // Validate Ollama connectivity
    if (!options.skipOllamaCheck) {
      const spinner = ora('Checking Ollama connectivity...').start();
      try {
        const ollamaProvider = createOllamaProvider(config.ollama);
        const modelAvailable = await ollamaProvider.checkModel(config.ollama.model);
        if (!modelAvailable) {
          spinner.warn(`Model "${config.ollama.model}" not found in Ollama`);
          renderInfo(`Run: ollama pull ${config.ollama.model}`);
        } else {
          spinner.succeed('Ollama connected and model available');
        }
      } catch {
        spinner.warn('Could not connect to Ollama');
        renderInfo('Start Ollama with: ollama serve');
      }
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
  $ reposeance init --skip-ollama-check
`);
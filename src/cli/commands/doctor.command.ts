import { Command } from 'commander';
import { loadConfig } from '../../config';
import { renderDoctorCheck, printSection, renderInfo, renderError } from '../ui/renderer';
import { RepositoryError } from '../../shared/errors';
import { execa } from 'execa';

export const doctorCommand = new Command('doctor')
  .description('Diagnose dependencies and configuration')
  .option('--json', 'Output as JSON')
  .action(async (_options: Record<string, unknown>) => {
    printSection('Doctor Diagnostics');

    const config = await loadConfig();
    const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const versionParts = nodeVersion.slice(1).split('.');
    const nodeMajor = parseInt(versionParts[0] ?? '0', 10);
    checks.push({
      name: 'Node.js version',
      passed: nodeMajor >= 20,
      details: `Found ${nodeVersion}, requires >= 20.0.0`,
    });

    // Check Git
    try {
      const { stdout: gitVersion } = await execa('git', ['--version']);
      checks.push({
        name: 'Git',
        passed: true,
        details: gitVersion,
      });
    } catch {
      checks.push({
        name: 'Git',
        passed: false,
        details: 'Git not found in PATH',
      });
    }

    // Check Ollama connection
    try {
      const response = await fetch(`${config.ollama.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json() as { models: Array<{ name: string }> };
        const modelNames = data.models.map(m => m.name);
        const ollamaModel = config.ollama.model as string;
        const modelPrefix = ollamaModel.split(':')[0] ?? '';
        const modelAvailable = modelNames.some(m => m === ollamaModel || m.startsWith(modelPrefix));
        checks.push({
          name: 'Ollama connection',
          passed: true,
          details: `Connected to ${config.ollama.baseUrl}`,
        });
        checks.push({
          name: `Model "${config.ollama.model!}"`,
          passed: modelAvailable,
          details: modelAvailable
            ? 'Model is available'
            : `Model not found. Available: ${modelNames.join(', ') || 'none'}`,
        });
      } else {
        checks.push({
          name: 'Ollama connection',
          passed: false,
          details: `HTTP ${response.status}`,
        });
        checks.push({
          name: `Model "${config.ollama.model!}"`,
          passed: false,
          details: 'Could not check model availability',
        });
      }
    } catch {
      checks.push({
        name: 'Ollama connection',
        passed: false,
        details: `Cannot connect to ${config.ollama.baseUrl}. Is Ollama running?`,
      });
      checks.push({
        name: `Model "${config.ollama.model!}"`,
        passed: false,
        details: 'Ollama not reachable',
      });
    }

    // Check if in a Git repository
    try {
      await execa('git', ['rev-parse', '--git-dir']);
      checks.push({
        name: 'Git repository',
        passed: true,
        details: 'Inside a Git repository',
      });
    } catch {
      checks.push({
        name: 'Git repository',
        passed: false,
        details: 'Not inside a Git repository',
      });
    }

    // Check configuration file
    checks.push({
      name: 'Configuration',
      passed: true,
      details: 'Configuration loaded',
    });

    // Print results
    for (const check of checks) {
      renderDoctorCheck(check.name, check.passed, check.details);
    }

    console.log();

    const failed = checks.filter(c => !c.passed).length;
    if (failed > 0) {
      renderError(`${failed} check(s) failed. See details above.`);
      throw new RepositoryError('Doctor checks failed', [
        'Fix the failing checks above',
        'Run "reposeance doctor" again after fixing',
      ]);
    } else {
      renderInfo('All checks passed! ✓');
    }
  });

doctorCommand.addHelpText('after', `
Examples:
  $ reposeance doctor
  $ reposeance doctor --json
`);
import { Command } from 'commander';
import { loadConfig } from '../../config';
import { renderDoctorCheck, printSection, renderInfo, renderWarning } from '../ui/renderer';
import { execa } from 'execa';
import { findGitRoot } from '../../core/repository';
import { loadRepositoryIndexByRoot, checkIndexFreshness } from '../../core/indexer';
import { createOllamaProvider } from '../../core/llm/ollama.provider';
import { stat, writeFile, unlink, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

export const doctorCommand = new Command('doctor')
  .description('Diagnose dependencies and configuration')
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options: { json?: boolean; verbose?: boolean }, command: any) => {
    const isJson = options.json || command?.parent?.opts()?.json || false;
    const isVerbose = options.verbose || command?.parent?.opts()?.verbose || false;

    if (!isJson) {
      printSection('Doctor Diagnostics');
    }

    const config = await loadConfig();
    const checks: Array<{ name: string; passed: boolean; details?: string; category: string; critical?: boolean }> = [];

    // === System Checks ===
    const nodeVersion = process.version;
    const versionParts = nodeVersion.slice(1).split('.');
    const nodeMajor = parseInt(versionParts[0] ?? '0', 10);
    checks.push({
      name: 'Node.js version',
      passed: nodeMajor >= 20,
      details: `Found ${nodeVersion}, requires >= 20.0.0`,
      category: 'System',
      critical: true,
    });

    // Git
    try {
      const { stdout: gitVersion } = await execa('git', ['--version']);
      checks.push({
        name: 'Git',
        passed: true,
        details: gitVersion.trim(),
        category: 'System',
        critical: true,
      });
    } catch {
      checks.push({
        name: 'Git',
        passed: false,
        details: 'Git not found in PATH',
        category: 'System',
        critical: true,
      });
    }

    // Disk space (cross-platform)
    try {
      if (typeof statfs === 'function') {
        const stats = await statfs('.');
        const freeGB = Math.round((Number(stats.bavail) * Number(stats.bsize)) / (1024 * 1024 * 1024) * 10) / 10;
        const totalGB = Math.round((Number(stats.blocks) * Number(stats.bsize)) / (1024 * 1024 * 1024) * 10) / 10;
        checks.push({
          name: 'Disk space',
          passed: freeGB > 0.5,
          details: `${freeGB}GB available of ${totalGB}GB total`,
          category: 'System',
        });
      } else {
        checks.push({
          name: 'Disk space',
          passed: true,
          details: 'Storage accessible',
          category: 'System',
        });
      }
    } catch {
      checks.push({
        name: 'Disk space',
        passed: true,
        details: 'Storage accessible',
        category: 'System',
      });
    }

    // Memory
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10;
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
    checks.push({
      name: 'Memory',
      passed: totalMem >= 4,
      details: `${freeMem}GB free of ${totalMem}GB total`,
      category: 'System',
    });

    // === Git Repository Checks ===
    let rootPath: string | null = null;
    try {
      rootPath = await findGitRoot();
      if (rootPath) {
        checks.push({
          name: 'Git repository',
          passed: true,
          details: `Repository root: ${rootPath}`,
          category: 'Repository',
          critical: true,
        });

        // Git config
        let userName = '';
        let userEmail = '';
        try {
          const resName = await execa('git', ['config', 'user.name']);
          userName = resName.stdout.trim();
        } catch { /* unconfigured */ }
        try {
          const resEmail = await execa('git', ['config', 'user.email']);
          userEmail = resEmail.stdout.trim();
        } catch { /* unconfigured */ }

        checks.push({
          name: 'Git user config',
          passed: !!userName && !!userEmail,
          details: userName && userEmail ? `${userName} <${userEmail}>` : 'Not configured (optional)',
          category: 'Repository',
        });

        // Remote URL
        try {
          const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url']);
          checks.push({
            name: 'Remote origin',
            passed: true,
            details: remoteUrl.trim(),
            category: 'Repository',
          });
        } catch {
          checks.push({
            name: 'Remote origin',
            passed: true,
            details: 'Local repository (no remote origin configured)',
            category: 'Repository',
          });
        }

        // Index status
        try {
          const index = await loadRepositoryIndexByRoot(rootPath);
          if (index) {
            const freshness = await checkIndexFreshness(rootPath);
            checks.push({
              name: 'Repository index',
              passed: freshness.isFresh,
              details: freshness.isFresh
                ? `Indexed ${index.metadata.totalFiles} files, ${index.metadata.totalChunks} chunks at ${index.metadata.indexedAt}`
                : `Stale: ${freshness.reason}. Last indexed: ${index.metadata.indexedAt}`,
              category: 'Repository',
            });
          } else {
            checks.push({
              name: 'Repository index',
              passed: false,
              details: 'No index found. Run "reposeance index" to index this repository',
              category: 'Repository',
            });
          }
        } catch {
          checks.push({
            name: 'Repository index',
            passed: false,
            details: 'Could not check index status',
            category: 'Repository',
          });
        }
      } else {
        checks.push({
          name: 'Git repository',
          passed: false,
          details: 'Not inside a Git repository',
          category: 'Repository',
          critical: true,
        });
      }
    } catch {
      checks.push({
        name: 'Git repository',
        passed: false,
        details: 'Not inside a Git repository',
        category: 'Repository',
        critical: true,
      });
    }

    // === Ollama Checks ===
    try {
      const ollamaProvider = createOllamaProvider(config.ollama);
      const models = await ollamaProvider.listModels();
      checks.push({
        name: 'Ollama connection',
        passed: true,
        details: `Connected to ${config.ollama.baseUrl}`,
        category: 'Ollama',
      });

      const ollamaModel = config.ollama.model as string;
      const modelPrefix = ollamaModel.split(':')[0] ?? '';
      const compatibleModels = models.filter(m => m.startsWith(modelPrefix) || m === ollamaModel);
      if (compatibleModels.length > 0) {
        checks.push({
          name: `Model "${config.ollama.model}"`,
          passed: true,
          details: `Available (${compatibleModels.join(', ')})`,
          category: 'Ollama',
        });
      } else {
        checks.push({
          name: `Model "${config.ollama.model}"`,
          passed: false,
          details: `Model not downloaded. Run: ollama pull ${config.ollama.model}`,
          category: 'Ollama',
        });
      }
    } catch {
      checks.push({
        name: 'Ollama connection',
        passed: false,
        details: `Cannot connect to ${config.ollama.baseUrl}. Is Ollama running? (ollama serve)`,
        category: 'Ollama',
      });
      checks.push({
        name: `Model "${config.ollama.model}"`,
        passed: false,
        details: 'Ollama not reachable',
        category: 'Ollama',
      });
    }

    // === Configuration Checks ===
    try {
      const configPath = (await import('../../config')).getConfigPath();
      await stat(configPath);
      checks.push({
        name: 'Configuration file',
        passed: true,
        details: `Found at ${configPath}`,
        category: 'Configuration',
      });
    } catch {
      checks.push({
        name: 'Configuration file',
        passed: true,
        details: 'Using default configuration (run "reposeance init" to customize)',
        category: 'Configuration',
      });
    }

    // Config validation
    const validModels = ['gemma3:1b', 'gemma3:4b', 'gemma3:12b', 'gemma3:27b', 'llama3:8b', 'llama3:70b', 'mistral:7b', 'codellama:7b', 'codellama:13b'];
    const isKnownModel = validModels.includes(config.ollama.model) || config.ollama.model.startsWith('gemma') || config.ollama.model.startsWith('llama') || config.ollama.model.startsWith('mistral');
    checks.push({
      name: 'Model configuration',
      passed: isKnownModel,
      details: isKnownModel ? `Configured for ${config.ollama.model}` : `Custom model: ${config.ollama.model}`,
      category: 'Configuration',
    });

    // === File System Permissions ===
    try {
      const testFile = join(os.tmpdir(), `reposeance-write-test-${Date.now()}.tmp`);
      await writeFile(testFile, 'test');
      await unlink(testFile);
      checks.push({
        name: 'File system write',
        passed: true,
        details: `Write access verified (${os.tmpdir()})`,
        category: 'File System',
      });
    } catch {
      checks.push({
        name: 'File system write',
        passed: false,
        details: 'Cannot write to temp directory',
        category: 'File System',
      });
    }

    // === Print Results ===
    if (isJson) {
      console.log(JSON.stringify(checks, null, 2));
      return;
    }

    const categories = [...new Set(checks.map(c => c.category))];
    for (const category of categories) {
      const categoryChecks = checks.filter(c => c.category === category);
      renderInfo(`\n${category}:`);
      for (const check of categoryChecks) {
        if (isVerbose || !check.passed) {
          renderDoctorCheck(check.name, check.passed, check.details);
        }
      }
    }

    console.log();

    const failed = checks.filter(c => !c.passed).length;
    const passed = checks.filter(c => c.passed).length;
    const criticalFailed = checks.filter(c => !c.passed && c.critical).length;

    if (criticalFailed > 0) {
      renderWarning(`${failed} check(s) flagged, ${passed} passed. Critical dependencies missing.`);
    } else if (failed > 0) {
      renderInfo(`${failed} check(s) flagged, ${passed} passed. Run "reposeance doctor --verbose" for details.`);
    } else {
      renderInfo(`All ${passed} checks passed! ✓`);
    }
  });

doctorCommand.addHelpText('after', `
Examples:
  $ reposeance doctor
  $ reposeance doctor --verbose
  $ reposeance doctor --json
`);

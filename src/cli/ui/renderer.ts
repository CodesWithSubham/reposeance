import ora, { Ora } from 'ora';
import {
  styleGhost,
  styleCommit,
  styleFile,
  styleLine,
  styleEvidence,
  styleWarning,
  styleError,
  styleSuccess,
  styleInfo,
  styleMuted,
  styleBold,
} from './theme';

export interface SpinnerOptions {
  text?: string;
  color?: 'yellow' | 'green' | 'blue' | 'red' | 'cyan' | 'magenta';
}

export function createSpinner(options: SpinnerOptions = {}): Ora {
  const spinner = ora({
    text: options.text || 'Working...',
    color: options.color || 'cyan',
    spinner: 'dots',
  });
  return spinner;
}

export function printSection(title: string): void {
  console.log();
  console.log(styleBold(`═══ ${title} ═══`));
  console.log();
}

export function renderAnswer(
  answer: string,
  evidence: Array<{ type: 'source' | 'commit'; path?: string; startLine?: number | undefined; endLine?: number | undefined; commitHash?: string }>,
  confidence: 'high' | 'medium' | 'low',
): void {
  console.log();
  console.log(styleGhost('👻  THE GHOST REMEMBERS...'));
  console.log();

  const lines = answer.split('\n');
  for (const line of lines) {
    console.log(`  ${line}`);
  }

  console.log();
  console.log(styleBold('EVIDENCE:'));
  console.log();

  if (evidence.length === 0) {
    console.log(`  ${styleMuted('No evidence references found in response.')}`);
  } else {
    for (const ref of evidence) {
      if (ref.type === 'source' && ref.path) {
        const lineRange = ref.startLine && ref.endLine
          ? `:${styleLine(String(ref.startLine))}-${styleLine(String(ref.endLine))}`
          : '';
        console.log(`  ${styleEvidence('📄')} ${styleFile(ref.path)}${lineRange}`);
      } else if (ref.type === 'commit' && ref.commitHash) {
        console.log(`  ${styleEvidence('🔀')} ${styleCommit(ref.commitHash.substring(0, 7))}`);
      }
    }
  }

  console.log();
  const confidenceColor = confidence === 'high' ? styleSuccess : confidence === 'medium' ? styleWarning : styleError;
  console.log(`  ${styleBold('CONFIDENCE:')} ${confidenceColor(confidence.toUpperCase())}`);
  console.log();
}

export function renderChatPrompt(prefix: string = 'You'): string {
  return `${styleBold(styleGhost('👻'))} ${styleBold(prefix)}: `;
}

export function renderGhostPrefix(): string {
  return `${styleGhost('👻')} ${styleBold('Ghost')}: `;
}

export function renderProgress(current: number, total: number, label: string): void {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r  ${styleInfo(bar)} ${percentage}% ${label}`);
  if (current === total) {
    process.stdout.write('\n');
  }
}

export function renderIndexSummary(stats: {
  repository: string;
  filesScanned: number;
  filesIndexed: number;
  languages: string[];
  commitsAnalyzed: number;
}): void {
  console.log();
  console.log(styleGhost('        REPOSEANCE'));
  console.log(styleMuted('  The repository remembers...'));
  console.log();
  console.log(`  ${styleBold('Repository:')} ${stats.repository}`);
  console.log(`  ${styleBold('Files scanned:')} ${stats.filesScanned}`);
  console.log(`  ${styleBold('Files indexed:')} ${stats.filesIndexed}`);
  console.log(`  ${styleBold('Languages:')} ${stats.languages.join(', ')}`);
  console.log(`  ${styleBold('Git commits analyzed:')} ${stats.commitsAnalyzed}`);
  console.log();
  console.log(`  ${styleSuccess('[OK]')} Repository structure discovered`);
  console.log(`  ${styleSuccess('[OK]')} Source code indexed`);
  console.log(`  ${styleSuccess('[OK]')} Git history indexed`);
  console.log();
  console.log(`  ${styleInfo('Your repository is ready for questioning.')}`);
  console.log();
}

export function renderHistory(commits: Array<{
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  changedFiles: string[];
}>): void {
  console.log();
  console.log(styleGhost('  THE GHOSTS OF HISTORY'));
  console.log();
  console.log(`  ${commits.length} commits discovered`);
  console.log();

  for (const commit of commits) {
    console.log(`  ${styleCommit(commit.shortHash)}  ${commit.message}`);
    console.log(`  ${styleMuted(commit.date)}`);
    console.log();
  }
}

export function renderStatus(status: {
  indexed: boolean;
  repository?: string;
  lastIndexed?: string;
  totalFiles?: number;
  totalChunks?: number;
  headCommit?: string;
  ollamaConnected?: boolean;
  modelAvailable?: boolean;
  currentModel?: string;
}): void {
  console.log();
  console.log(styleGhost('  REPOSEANCE STATUS'));
  console.log();

  if (status.indexed && status.repository) {
    console.log(`  ${styleSuccess('✓')} Indexed: ${styleBold(status.repository)}`);
    console.log(`  ${styleInfo('Last indexed:')} ${status.lastIndexed}`);
    console.log(`  ${styleInfo('Files:')} ${status.totalFiles}`);
    console.log(`  ${styleInfo('Chunks:')} ${status.totalChunks}`);
    console.log(`  ${styleInfo('HEAD:')} ${status.headCommit?.substring(0, 7)}`);
  } else {
    console.log(`  ${styleWarning('✗')} No repository indexed`);
    console.log(`  ${styleMuted('Run "reposeance index" to get started')}`);
  }

  console.log();
  console.log(styleBold('  Ollama:'));
  if (status.ollamaConnected) {
    console.log(`  ${styleSuccess('✓')} Connected`);
    if (status.modelAvailable) {
      console.log(`  ${styleSuccess('✓')} Model available: ${status.currentModel}`);
    } else {
      console.log(`  ${styleError('✗')} Model not found: ${status.currentModel}`);
      console.log(`  ${styleMuted('Run: ollama pull ' + status.currentModel)}`);
    }
  } else {
    console.log(`  ${styleError('✗')} Not connected`);
    console.log(`  ${styleMuted('Start Ollama: ollama serve')}`);
  }
  console.log();
}

export function renderDoctorCheck(name: string, passed: boolean, details?: string): void {
  const icon = passed ? styleSuccess('✓') : styleError('✗');
  const status = passed ? styleSuccess('PASS') : styleError('FAIL');
  console.log(`  ${icon} ${name} ${styleMuted(`[${status}]`)}`);
  if (details) {
    console.log(`      ${styleMuted(details)}`);
  }
}

export function renderJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function renderError(message: string): void {
  console.error(styleError(`Error: ${message}`));
}

export function renderWarning(message: string): void {
  console.warn(styleWarning(`Warning: ${message}`));
}

export function renderInfo(message: string): void {
  console.log(styleInfo(message));
}

export function renderSuccess(message: string): void {
  console.log(styleSuccess(message));
}

export function renderMuted(message: string): void {
  console.log(styleMuted(message));
}

export function renderVerbose(label: string, value: unknown): void {
  console.log(`  ${styleMuted(label)}: ${styleInfo(String(value))}`);
}
import { execa } from 'execa';
import { GitCommit, GitBlameResult, BlameLine, CommitPatch, PatchFile } from '../../shared/types';
import { RepositoryError } from '../../shared/errors';

export async function getCommitHistory(
  rootPath: string,
  limit: number = 100,
  pathFilter?: string,
): Promise<GitCommit[]> {
  try {
    const args = [
      '-C', rootPath,
      'log',
      `--max-count=${limit}`,
      '--pretty=format:COMMIT:%H|%h|%an|%ai|%s|%b',
      '--name-only',
    ];
    if (pathFilter) {
      args.push('--', pathFilter);
    }

    const { stdout } = await execa('git', args, { stdout: 'pipe' });

    if (!stdout.trim()) {
      return [];
    }

    const commits: GitCommit[] = [];
    const blocks = stdout.split('\nCOMMIT:');

    for (let i = 0; i < blocks.length; i++) {
      const rawBlock = blocks[i]!;
      const block = (i === 0 && rawBlock.startsWith('COMMIT:'))
        ? rawBlock.substring(7)
        : rawBlock;

      if (!block.trim()) continue;

      const lines = block.split('\n');
      const header = lines[0] ?? '';
      const parts = header.split('|');
      const hash = parts[0]?.trim() ?? '';
      const shortHash = parts[1]?.trim() ?? '';
      const author = parts[2]?.trim() ?? '';
      const date = parts[3]?.trim() ?? '';
      const subject = parts[4]?.trim() ?? '';
      const body = parts.slice(5).join('|').trim();
      const message = body ? `${subject}\n\n${body}` : subject;

      const changedFiles = lines
        .slice(1)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (hash) {
        commits.push({
          hash,
          shortHash,
          author,
          date,
          message,
          changedFiles,
        });
      }
    }

    return commits;
  } catch {
    throw new RepositoryError('Failed to get commit history', [
      'Ensure you are in a valid Git repository',
      'Check Git is installed and accessible',
    ]);
  }
}

export async function getCommitDetails(rootPath: string, commitHash: string): Promise<GitCommit> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'show',
      '--pretty=format:%H|%h|%an|%ai|%s|%b',
      '--no-patch',
      '--',
      commitHash,
    ], { stdout: 'pipe' });

    const parts = stdout.trim().split('|');
    const hash = parts[0]?.trim() ?? '';
    const shortHash = parts[1]?.trim() ?? '';
    const author = parts[2]?.trim() ?? '';
    const date = parts[3]?.trim() ?? '';
    const subject = parts[4]?.trim() ?? '';
    const body = parts.slice(5).join('|').trim();
    const message = body ? `${subject}\n\n${body}` : subject;

    // Get changed files for this commit
    const { stdout: filesOutput } = await execa('git', [
      '-C', rootPath,
      'show',
      '--pretty=format:',
      '--name-only',
      '--',
      commitHash,
    ], { stdout: 'pipe' });

    const changedFiles = filesOutput.trim().split('\n').filter(f => f.length > 0);

    return {
      hash,
      shortHash,
      author,
      date,
      message,
      changedFiles,
    };
  } catch {
    throw new RepositoryError(`Failed to get commit details for ${commitHash}`, [
      'Ensure the commit hash exists',
      'Check Git is installed and accessible',
    ]);
  }
}

export async function getFileHistory(
  rootPath: string,
  filePath: string,
  limit: number = 50,
): Promise<GitCommit[]> {
  return getCommitHistory(rootPath, limit, filePath);
}

export async function getDirectoryHistory(
  rootPath: string,
  dirPath: string,
  limit: number = 50,
): Promise<GitCommit[]> {
  return getCommitHistory(rootPath, limit, dirPath);
}

export async function getBlame(
  rootPath: string,
  filePath: string,
  startLine?: number,
  endLine?: number,
): Promise<GitBlameResult> {
  try {
    const args = ['-C', rootPath, 'blame', '-w', '--line-porcelain'];
    if (startLine && endLine) {
      args.push(`-L${startLine},${endLine}`);
    }
    args.push('--', filePath);

    const { stdout } = await execa('git', args, { stdout: 'pipe' });

    const lines: BlameLine[] = [];
    const outputLines = stdout.trim().split('\n');

    let currentCommitHash = '';
    let currentAuthor = '';
    let currentDate = '';
    let currentLineNumber = 0;

    for (let i = 0; i < outputLines.length; i++) {
      const line = outputLines[i];
      if (!line) continue;

      // New commit entry starts with a commit hash and line numbers
      // Format: <40-char-hash> <original-line> <final-line> <num-lines>
      const commitMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)/);
      if (commitMatch && commitMatch[1] && commitMatch[3]) {
        // Save previous entry if complete
        if (currentLineNumber > 0 && currentCommitHash) {
          lines.push({
            lineNumber: currentLineNumber,
            commitHash: currentCommitHash,
            author: currentAuthor,
            date: currentDate,
          });
        }

        // Start new entry - the line number in the current file is commitMatch[3]
        currentCommitHash = commitMatch[1];
        currentLineNumber = parseInt(commitMatch[3], 10);
        currentAuthor = '';
        currentDate = '';
        continue;
      }

      if (line.startsWith('author ')) {
        currentAuthor = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12), 10);
        currentDate = new Date(timestamp * 1000).toISOString();
      }
      // Source lines (prefixed with tab) don't need special handling
      // The line number is already captured from the commit header
    }

    // Don't forget the last entry
    if (currentLineNumber > 0 && currentCommitHash) {
      lines.push({
        lineNumber: currentLineNumber,
        commitHash: currentCommitHash,
        author: currentAuthor,
        date: currentDate,
      });
    }

    return {
      filePath,
      lines: lines.sort((a, b) => a.lineNumber - b.lineNumber),
    };
  } catch {
    throw new RepositoryError(`Failed to get blame for ${filePath}`, [
      'Ensure the file exists in the repository',
      'Check Git is installed and accessible',
    ]);
  }
}

export async function getCommitPatch(
  rootPath: string,
  commitHash: string,
  maxSize: number = 50000,
): Promise<CommitPatch> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'show',
      '--patch',
      '--',
      commitHash,
    ], { stdout: 'pipe', maxBuffer: maxSize + 10000 });

    const files: PatchFile[] = [];
    const lines = stdout.split('\n');
    let currentFile = '';
    let currentPatch = '';
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          files.push({
            path: currentFile,
            additions,
            deletions,
            patch: currentPatch,
          });
        }
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match && match[1]) {
          currentFile = match[1];
        }
        currentPatch = line + '\n';
        additions = 0;
        deletions = 0;
      } else {
        currentPatch += line + '\n';
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }
    }

    if (currentFile) {
      files.push({
        path: currentFile,
        additions,
        deletions,
        patch: currentPatch,
      });
    }

    return {
      commitHash,
      patch: stdout,
      files,
    };
  } catch {
    throw new RepositoryError(`Failed to get patch for ${commitHash}`, [
      'Ensure the commit hash exists',
      'Check Git is installed and accessible',
    ]);
  }
}

export async function getChangedFilesSince(rootPath: string, sinceCommit: string, untilCommit: string = 'HEAD'): Promise<string[]> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'diff',
      '--name-only',
      `${sinceCommit}..${untilCommit}`,
    ], { stdout: 'pipe' });

    return stdout.trim().split('\n').filter(f => f.length > 0);
  } catch {
    throw new RepositoryError(`Failed to get changed files between ${sinceCommit} and ${untilCommit}`, [
      'Ensure both commits exist',
      'Check Git is installed and accessible',
    ]);
  }
}

export async function getFileAtCommit(rootPath: string, filePath: string, commitHash: string): Promise<string> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'show',
      `${commitHash}:${filePath}`,
    ], { stdout: 'pipe' });
    return stdout;
  } catch {
    return '';
  }
}

export async function isMergeCommit(rootPath: string, commitHash: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'cat-file', '-p', commitHash,
    ], { stdout: 'pipe' });

    const lines = stdout.split('\n');
    let parentCount = 0;
    for (const line of lines) {
      if (line.startsWith('parent ')) parentCount++;
      if (line === '') break; // End of header
    }
    return parentCount > 1;
  } catch {
    return false;
  }
}

export async function getMergeCommitParents(rootPath: string, commitHash: string): Promise<string[]> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'cat-file', '-p', commitHash,
    ], { stdout: 'pipe' });

    const lines = stdout.split('\n');
    const parents: string[] = [];
    for (const line of lines) {
      if (line.startsWith('parent ')) {
        parents.push(line.substring(7));
      }
      if (line === '') break;
    }
    return parents;
  } catch {
    return [];
  }
}

export async function getBranchesContainingCommit(rootPath: string, commitHash: string): Promise<string[]> {
  try {
    const { stdout } = await execa('git', [
      '-C', rootPath,
      'branch', '-a', '--contains', commitHash,
    ], { stdout: 'pipe' });

    return stdout.trim().split('\n')
      .map(b => b.trim().replace(/^\*?\s*/, ''))
      .filter(b => b.length > 0);
  } catch {
    return [];
  }
}
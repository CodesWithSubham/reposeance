import { execa } from 'execa';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { RepositoryError } from '../../shared/errors';
import { RepositoryMetadata } from '../../shared/types';

export interface RepositoryInfo {
  rootPath: string;
  name: string;
  isGitRepo: boolean;
}

export async function findGitRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = resolve(startPath);

  while (true) {
    try {
      await execa('git', ['-C', currentPath, 'rev-parse', '--git-dir'], { stdout: 'ignore', stderr: 'ignore' });
      return currentPath;
    } catch {
      const parentPath = resolve(currentPath, '..');
      if (parentPath === currentPath) {
        return null;
      }
      currentPath = parentPath;
    }
  }
}

export async function getRepositoryInfo(path: string = process.cwd()): Promise<RepositoryInfo> {
  const gitRoot = await findGitRoot(path);

  if (!gitRoot) {
    return {
      rootPath: resolve(path),
      name: basename(resolve(path)),
      isGitRepo: false,
    };
  }

  try {
    const { stdout: remoteUrl } = await execa('git', ['-C', gitRoot, 'config', '--get', 'remote.origin.url'], { stdout: 'pipe', stderr: 'ignore' });
    let name = basename(gitRoot);
    if (remoteUrl) {
      const match = remoteUrl.match(/([^/]+?)(?:\.git)?$/);
      if (match) name = match[1];
    }

    return {
      rootPath: gitRoot,
      name,
      isGitRepo: true,
    };
  } catch {
    return {
      rootPath: gitRoot,
      name: basename(gitRoot),
      isGitRepo: true,
    };
  }
}

export async function getHeadCommit(rootPath: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    throw new RepositoryError('Failed to get HEAD commit', ['Ensure you are in a valid Git repository']);
  }
}

export async function isRepositoryClean(rootPath: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['-C', rootPath, 'status', '--porcelain']);
    return stdout.trim() === '';
  } catch {
    return false;
  }
}

export async function getRepositoryMetadata(rootPath: string): Promise<Partial<RepositoryMetadata>> {
  const headCommit = await getHeadCommit(rootPath);
  const info = await getRepositoryInfo(rootPath);

  return {
    id: generateRepoId(rootPath),
    rootPath: info.rootPath,
    name: info.name,
    headCommit,
    version: 1,
  };
}

function generateRepoId(rootPath: string): string {
  return createHash('sha256').update(rootPath).digest('hex').substring(0, 16);
}
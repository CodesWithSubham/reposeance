import { RepositoryIndex, CodeChunk, GitCommit } from '../../shared/types';
import { normalizePath } from '../../shared/utils';

export interface EvidenceReference {
  type: 'source' | 'commit';
  path?: string;
  startLine?: number;
  endLine?: number;
  commitHash?: string;
  valid: boolean;
  originalText?: string;
}

export interface ValidatedEvidence {
  sourceReferences: EvidenceReference[];
  commitReferences: EvidenceReference[];
  validCount: number;
  invalidCount: number;
}

export function parseEvidenceReferences(
  text: string,
  context?: { codeChunks?: CodeChunk[]; commits?: GitCommit[] },
): EvidenceReference[] {
  const references: EvidenceReference[] = [];
  const seenSources = new Set<string>();
  const seenCommits = new Set<string>();

  // 1. Match [S1], [S2] citations if context is available
  if (context?.codeChunks && context.codeChunks.length > 0) {
    const sRegex = /\[S(\d+)\]/gi;
    let match;
    while ((match = sRegex.exec(text)) !== null) {
      const idx = parseInt(match[1]!, 10) - 1;
      const chunk = context.codeChunks[idx];
      if (chunk) {
        const key = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
        if (!seenSources.has(key)) {
          seenSources.add(key);
          references.push({
            type: 'source',
            path: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            valid: true,
            originalText: match[0],
          });
        }
      }
    }
  }

  // 2. Match [G1], [G2] citations if context is available
  if (context?.commits && context.commits.length > 0) {
    const gRegex = /\[G(\d+)\]/gi;
    let match;
    while ((match = gRegex.exec(text)) !== null) {
      const idx = parseInt(match[1]!, 10) - 1;
      const commit = context.commits[idx];
      if (commit) {
        const key = commit.shortHash || commit.hash;
        if (!seenCommits.has(key)) {
          seenCommits.add(key);
          references.push({
            type: 'commit',
            commitHash: commit.hash,
            valid: true,
            originalText: match[0],
          });
        }
      }
    }
  }

  // 3. Match file references like: src/file.ts:10-20 or src/file.ts
  const fileRefRegex = /([a-zA-Z0-9_\-./]+\.(?:ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|cs|php|rb|swift|kt|scala|md|txt|json|yml|yaml|toml))(?::(\d+)(?:-(\d+))?)?/g;
  let match;
  while ((match = fileRefRegex.exec(text)) !== null) {
    const rawPath = match[1] as string;
    const path = normalizePath(rawPath);
    const startLine = match[2] ? parseInt(match[2], 10) : undefined;
    const endLine = match[3] ? parseInt(match[3], 10) : undefined;
    const key = `${path}:${startLine ?? ''}-${endLine ?? ''}`;

    if (!seenSources.has(key)) {
      seenSources.add(key);
      const ref: EvidenceReference = {
        type: 'source',
        path,
        valid: false,
        originalText: match[0],
      };
      if (startLine) ref.startLine = startLine;
      if (endLine) ref.endLine = endLine;
      references.push(ref);
    }
  }

  // 4. Match commit references like: abc1234 or abc1234567890abcdef
  const commitRefRegex = /\b([0-9a-f]{7,40})\b/g;
  while ((match = commitRefRegex.exec(text)) !== null) {
    const hash = match[1] as string;
    const before = text.substring(Math.max(0, match.index - 10), match.index);
    const after = text.substring(match.index + hash.length, match.index + hash.length + 10);
    // Ignore if part of a file path (e.g. dir/a1b2c3d) or followed by a file extension (e.g. a1b2c3d.ts)
    if (!before.match(/[./\\]$/) && !after.match(/^\.[a-zA-Z0-9]/) && !after.match(/^[/\\]/)) {
      if (!seenCommits.has(hash)) {
        seenCommits.add(hash);
        references.push({
          type: 'commit',
          commitHash: hash,
          valid: false,
          originalText: hash,
        });
      }
    }
  }

  return references;
}

export function validateEvidence(
  references: EvidenceReference[],
  index: RepositoryIndex,
): ValidatedEvidence {
  const validated: EvidenceReference[] = [];

  for (const ref of references) {
    if (ref.type === 'source' && ref.path) {
      validated.push(validateSourceReference(ref, index));
    } else if (ref.type === 'commit' && ref.commitHash) {
      validated.push(validateCommitReference(ref, index));
    }
  }

  const validCount = validated.filter(r => r.valid).length;
  const invalidCount = validated.filter(r => !r.valid).length;

  return {
    sourceReferences: validated.filter(r => r.type === 'source'),
    commitReferences: validated.filter(r => r.type === 'commit'),
    validCount,
    invalidCount,
  };
}

function validateSourceReference(ref: EvidenceReference, index: RepositoryIndex): EvidenceReference {
  const targetPath = normalizePath(ref.path!);
  const file = index.files.find(f => {
    const norm = normalizePath(f.path);
    return norm === targetPath || norm.endsWith('/' + targetPath);
  });

  if (!file) {
    return { ...ref, valid: false };
  }

  // Check if line numbers are valid for this file
  if (ref.startLine !== undefined) {
    const chunks = index.chunks.filter(c => {
      const norm = normalizePath(c.filePath);
      return norm === normalizePath(file.path) || norm.endsWith('/' + targetPath);
    });
    if (chunks.length > 0) {
      const maxLine = Math.max(...chunks.map(c => c.endLine), 0);
      if (ref.startLine > maxLine) {
        return { ...ref, valid: false };
      }
      if (ref.endLine !== undefined && ref.endLine > maxLine) {
        return { ...ref, valid: false };
      }
    }
  }

  return { ...ref, valid: true };
}

function validateCommitReference(ref: EvidenceReference, index: RepositoryIndex): EvidenceReference {
  if (!ref.commitHash) return { ...ref, valid: false };

  const targetHash = ref.commitHash.toLowerCase();
  const commit = index.commits.find(c => {
    const full = c.hash.toLowerCase();
    const short = c.shortHash.toLowerCase();
    return full === targetHash || full.startsWith(targetHash) || short === targetHash;
  });

  return { ...ref, valid: !!commit };
}

export function formatEvidenceForDisplay(validation: ValidatedEvidence): string {
  const lines: string[] = [];

  if (validation.sourceReferences.length > 0) {
    lines.push('Source References:');
    for (const ref of validation.sourceReferences) {
      const status = ref.valid ? '✓' : '✗';
      const lineInfo = ref.startLine
        ? ref.endLine && ref.endLine !== ref.startLine
          ? `:${ref.startLine}-${ref.endLine}`
          : `:${ref.startLine}`
        : '';
      lines.push(`  ${status} ${ref.path}${lineInfo}`);
    }
  }

  if (validation.commitReferences.length > 0) {
    lines.push('Commit References:');
    for (const ref of validation.commitReferences) {
      const status = ref.valid ? '✓' : '✗';
      const shortHash = ref.commitHash?.substring(0, 7);
      lines.push(`  ${status} ${shortHash}`);
    }
  }

  lines.push('');
  lines.push(`Valid: ${validation.validCount} | Invalid: ${validation.invalidCount}`);

  return lines.join('\n');
}

export function extractInlineCitations(text: string): string[] {
  const citationRegex = /\[([SG]\d+)\]/g;
  const citations: string[] = [];
  let match;
  while ((match = citationRegex.exec(text)) !== null) {
    const citation = match[1];
    if (citation) citations.push(citation);
  }
  return citations;
}

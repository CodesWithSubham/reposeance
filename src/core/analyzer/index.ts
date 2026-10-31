import { readFile } from 'node:fs/promises';
import { DiscoveredFile } from '../scanner';
import { SymbolInfo, CodeChunk, IndexingConfig } from '../../shared/types';
import { chunkText, normalizePath } from '../../shared/utils';

export interface AnalysisResult {
  symbols: SymbolInfo[];
  chunks: CodeChunk[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface ImportInfo {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
  startLine: number;
  endLine: number;
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'namespace' | 'reexport';
  startLine: number;
  endLine: number;
}

class LineNumberLookup {
  private lineStarts: number[];

  constructor(content: string) {
    this.lineStarts = [0];
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) {
        this.lineStarts.push(i + 1);
      }
    }
  }

  getLineNumber(index: number): number {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.lineStarts[mid]! <= index) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }
}

export async function analyzeFile(
  file: DiscoveredFile,
  config?: Partial<IndexingConfig>,
): Promise<AnalysisResult> {
  const content = await readFile(file.path, 'utf-8');
  const relativePath = normalizePath(file.relativePath);
  const chunkSize = config?.chunkSize ?? 80;
  const chunkOverlap = config?.chunkOverlap ?? 20;

  switch (file.language) {
    case 'typescript':
    case 'javascript':
      return analyzeTypeScript(content, relativePath, file.language, chunkSize, chunkOverlap);
    case 'python':
      return analyzePython(content, relativePath, chunkSize, chunkOverlap);
    case 'go':
      return analyzeGo(content, relativePath, chunkSize, chunkOverlap);
    case 'rust':
      return analyzeRust(content, relativePath, chunkSize, chunkOverlap);
    default:
      return analyzeGeneric(content, relativePath, file.language, chunkSize, chunkOverlap);
  }
}

function analyzeTypeScript(
  content: string,
  filePath: string,
  language: string,
  chunkSize: number,
  chunkOverlap: number,
): AnalysisResult {
  const lines = content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineLookup = new LineNumberLookup(content);

  // Regex patterns for TypeScript/JavaScript
  const functionRegex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
  const arrowFunctionRegex = /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*(?::\s*[^=]+)?=>/gm;
  const classRegex = /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/gm;
  const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/gm;
  const typeAliasRegex = /^(?:export\s+)?type\s+(\w+)\s*=/gm;
  const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/gm;
  const variableRegex = /^(?:export\s+)?(?:const|let|var)\s+(\w+)/gm;
  const importRegex = /^import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\}\s*)?from\s+['"]([^'"]+)['"]/gm;
  const exportRegex = /^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/gm;
  const reexportRegex = /^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm;

  // Find functions
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'function',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 10),
      signature: extractSignature(content, match.index),
    });
  }

  // Find arrow functions
  while ((match = arrowFunctionRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'function',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 10),
      signature: lines[lineNum - 1]?.trim() ?? '',
    });
  }

  // Find classes
  while ((match = classRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'class',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 20),
      signature: extractSignature(content, match.index),
    });
  }

  // Find interfaces
  while ((match = interfaceRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'interface',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 10),
      signature: extractSignature(content, match.index),
    });
  }

  // Find type aliases
  while ((match = typeAliasRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'type',
      filePath,
      startLine: lineNum,
      endLine: lineNum,
      signature: extractTypeSignature(content, match.index),
    });
  }

  // Find methods (inside classes)
  while ((match = methodRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const beforeMatch = content.substring(Math.max(0, match.index - 20), match.index);
    if (!beforeMatch.includes('function') && !beforeMatch.includes('=>') && !beforeMatch.includes('if') && !beforeMatch.includes('for') && !beforeMatch.includes('while')) {
      const name = match[1] ?? 'anonymous';
      symbols.push({
        name,
        type: 'method',
        filePath,
        startLine: lineNum,
        endLine: findEndOfBlock(content, match.index, lineLookup, 10),
        signature: extractSignature(content, match.index),
      });
    }
  }

  // Find variables (skip if already matched as arrow function)
  const fnNames = new Set(symbols.map(s => s.name));
  while ((match = variableRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    if (!fnNames.has(name)) {
      symbols.push({
        name,
        type: 'variable',
        filePath,
        startLine: lineNum,
        endLine: lineNum,
      });
    }
  }

  // Find imports
  while ((match = importRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const defaultImport = match[1] ?? '';
    const namedImportsStr = match[2] ?? '';
    const moduleSpecifier = match[3] ?? '';

    const namedImports = namedImportsStr
      ? namedImportsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s)
      : [];

    imports.push({
      moduleSpecifier,
      namedImports,
      ...(defaultImport ? { defaultImport } : {}),
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // Find exports
  while ((match = exportRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    exports.push({
      name,
      type: 'named',
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // Find reexports
  while ((match = reexportRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    exports.push({
      name,
      type: 'reexport',
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // Find TODO/FIXME comments
  collectTodoComments(content, filePath, lineLookup, lines, symbols);

  const chunks = chunkText(content, chunkSize, chunkOverlap, filePath, language);

  return { symbols, chunks, imports, exports };
}

function analyzePython(
  content: string,
  filePath: string,
  chunkSize: number,
  chunkOverlap: number,
): AnalysisResult {
  const lines = content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineLookup = new LineNumberLookup(content);

  // Python functions and methods: def func_name(args):
  const pyFuncRegex = /^(?:[ \t]*)(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/gm;
  let match;
  while ((match = pyFuncRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    const isMethod = match[0].startsWith(' ') || match[0].startsWith('\t');
    symbols.push({
      name,
      type: isMethod ? 'method' : 'function',
      filePath,
      startLine: lineNum,
      endLine: lineNum + 5,
      signature: lines[lineNum - 1]?.trim() ?? '',
    });
  }

  // Python classes: class ClassName(Base):
  const pyClassRegex = /^class\s+([a-zA-Z0-9_]+)(?:\([^)]*\))?:/gm;
  while ((match = pyClassRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'class',
      filePath,
      startLine: lineNum,
      endLine: lineNum + 10,
      signature: lines[lineNum - 1]?.trim() ?? '',
    });
  }

  // Python imports
  const pyImportRegex = /^(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([^\n]+)|import\s+([a-zA-Z0-9_.]+))/gm;
  while ((match = pyImportRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const moduleSpecifier = match[1] || match[3] || '';
    const namedStr = match[2] || '';
    const namedImports = namedStr.split(',').map(s => s.trim()).filter(Boolean);
    imports.push({
      moduleSpecifier,
      namedImports,
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  collectTodoComments(content, filePath, lineLookup, lines, symbols);
  const chunks = chunkText(content, chunkSize, chunkOverlap, filePath, 'python');
  return { symbols, chunks, imports, exports };
}

function analyzeGo(
  content: string,
  filePath: string,
  chunkSize: number,
  chunkOverlap: number,
): AnalysisResult {
  const lines = content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineLookup = new LineNumberLookup(content);

  // Go functions and methods: func (r *Receiver) Method() or func Function()
  const goFuncRegex = /^func\s+(?:\((?:[^)]+)\)\s+)?([a-zA-Z0-9_]+)\s*\(/gm;
  let match;
  while ((match = goFuncRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    const isMethod = match[0].includes('(') && match[0].indexOf('(') < match[0].indexOf(name);
    symbols.push({
      name,
      type: isMethod ? 'method' : 'function',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 10),
      signature: extractSignature(content, match.index),
    });
    // Capitalized symbols in Go are exported
    if (name[0] && name[0] === name[0].toUpperCase()) {
      exports.push({ name, type: 'named', startLine: lineNum, endLine: lineNum });
    }
  }

  // Go struct / interface types: type Server struct
  const goTypeRegex = /^type\s+([a-zA-Z0-9_]+)\s+(struct|interface)\b/gm;
  while ((match = goTypeRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    const kind = match[2] === 'interface' ? 'interface' : 'class';
    symbols.push({
      name,
      type: kind,
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 15),
      signature: lines[lineNum - 1]?.trim() ?? '',
    });
    if (name[0] && name[0] === name[0].toUpperCase()) {
      exports.push({ name, type: 'named', startLine: lineNum, endLine: lineNum });
    }
  }

  collectTodoComments(content, filePath, lineLookup, lines, symbols);
  const chunks = chunkText(content, chunkSize, chunkOverlap, filePath, 'go');
  return { symbols, chunks, imports, exports };
}

function analyzeRust(
  content: string,
  filePath: string,
  chunkSize: number,
  chunkOverlap: number,
): AnalysisResult {
  const lines = content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineLookup = new LineNumberLookup(content);

  // Rust functions: fn func_name(...)
  const rustFnRegex = /^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/gm;
  let match;
  while ((match = rustFnRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'anonymous';
    symbols.push({
      name,
      type: 'function',
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 10),
      signature: extractSignature(content, match.index),
    });
    if (match[0].startsWith('pub')) {
      exports.push({ name, type: 'named', startLine: lineNum, endLine: lineNum });
    }
  }

  // Rust struct, enum, trait: struct Name, enum Name, trait Name
  const rustTypeRegex = /^(?:pub(?:\([^)]+\))?\s+)?(struct|enum|trait)\s+([a-zA-Z0-9_]+)/gm;
  while ((match = rustTypeRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const kind = match[1] === 'trait' ? 'interface' : 'class';
    const name = match[2] ?? 'anonymous';
    symbols.push({
      name,
      type: kind,
      filePath,
      startLine: lineNum,
      endLine: findEndOfBlock(content, match.index, lineLookup, 15),
      signature: lines[lineNum - 1]?.trim() ?? '',
    });
    if (match[0].startsWith('pub')) {
      exports.push({ name, type: 'named', startLine: lineNum, endLine: lineNum });
    }
  }

  collectTodoComments(content, filePath, lineLookup, lines, symbols);
  const chunks = chunkText(content, chunkSize, chunkOverlap, filePath, 'rust');
  return { symbols, chunks, imports, exports };
}

function collectTodoComments(
  content: string,
  filePath: string,
  lineLookup: LineNumberLookup,
  lines: string[],
  symbols: SymbolInfo[],
): void {
  const todoRegex = /\b(TODO|FIXME|DEPRECATED|HACK|XXX)\b/g;
  let match;
  while ((match = todoRegex.exec(content)) !== null) {
    const lineNum = lineLookup.getLineNumber(match.index);
    const name = match[1] ?? 'TODO';
    const signature = lines[lineNum - 1]?.trim() ?? '';
    symbols.push({
      name,
      type: 'variable',
      filePath,
      startLine: lineNum,
      endLine: lineNum,
      signature,
    });
  }
}

function findEndOfBlock(
  content: string,
  startIndex: number,
  lineLookup: LineNumberLookup,
  fallbackLines: number,
): number {
  let braceCount = 0;
  let inBlock = false;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      inBlock = true;
    } else if (content[i] === '}') {
      braceCount--;
      if (inBlock && braceCount === 0) {
        return lineLookup.getLineNumber(i);
      }
    }
  }
  return lineLookup.getLineNumber(startIndex) + fallbackLines;
}

function extractSignature(content: string, index: number): string {
  const end = content.indexOf('{', index);
  if (end > index) {
    return content.substring(index, end).trim() + ' {';
  }
  return '';
}

function extractTypeSignature(content: string, index: number): string {
  const end = content.indexOf(';', index);
  if (end > index) {
    return content.substring(index, end).trim();
  }
  return '';
}

function analyzeGeneric(
  content: string,
  filePath: string,
  language: string,
  chunkSize: number,
  chunkOverlap: number,
): AnalysisResult {
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineLookup = new LineNumberLookup(content);
  const lines = content.split('\n');

  collectTodoComments(content, filePath, lineLookup, lines, symbols);
  const chunks = chunkText(content, chunkSize, chunkOverlap, filePath, language);

  return { symbols, chunks, imports, exports };
}

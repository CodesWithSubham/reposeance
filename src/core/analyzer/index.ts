import * as ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { DiscoveredFile } from '../scanner';
import { SymbolInfo, CodeChunk } from '../../shared/types';
import { chunkText, generateId } from '../../shared/utils';

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

export async function analyzeFile(file: DiscoveredFile): Promise<AnalysisResult> {
  const content = await readFile(file.path, 'utf-8');

  if (file.language === 'typescript' || file.language === 'javascript') {
    return analyzeTypeScript(content, file.path, file.language);
  }

  return analyzeGeneric(content, file.path, file.language);
}

function analyzeTypeScript(content: string, filePath: string, language: string): AnalysisResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );

  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push(createSymbol(node, 'function', filePath));
    } else if (ts.isClassDeclaration(node) && node.name) {
      symbols.push(createSymbol(node, 'class', filePath));
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push(createSymbol(node, 'method', filePath));
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push(createSymbol(node, 'interface', filePath));
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push(createSymbol(node, 'type', filePath));
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push(createSymbol(node, 'variable', filePath));
    } else if (ts.isImportDeclaration(node)) {
      imports.push(createImport(node, filePath));
    } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      exports.push(...createExports(node, filePath));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const chunks = createChunks(content, filePath, language, symbols);

  return { symbols, chunks, imports, exports };
}

function createSymbol(node: ts.Node, type: SymbolInfo['type'], filePath: string): SymbolInfo {
  const startLine = getLineNumber(node.getStart(), node.getSourceFile().text);
  const endLine = getLineNumber(node.getEnd(), node.getSourceFile().text);
  const name = getNodeName(node);

  return {
    name,
    type,
    startLine,
    endLine,
    signature: getSignature(node),
  };
}

function createImport(node: ts.ImportDeclaration, filePath: string): ImportInfo {
  const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
  const startLine = getLineNumber(node.getStart(), node.getSourceFile().text);
  const endLine = getLineNumber(node.getEnd(), node.getSourceFile().text);

  const namedImports: string[] = [];
  let defaultImport: string | undefined;
  let namespaceImport: string | undefined;

  if (node.importClause) {
    if (node.importClause.name) {
      defaultImport = node.importClause.name.text;
    }
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        namespaceImport = node.importClause.namedBindings.name.text;
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          namedImports.push(element.name.text);
        }
      }
    }
  }

  return { moduleSpecifier, namedImports, defaultImport, namespaceImport, startLine, endLine };
}

function createExports(node: ts.Node, filePath: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const startLine = getLineNumber(node.getStart(), node.getSourceFile().text);
  const endLine = getLineNumber(node.getEnd(), node.getSourceFile().text);

  if (ts.isExportDeclaration(node)) {
    if (node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            type: 'named',
            startLine,
            endLine,
          });
        }
      }
    } else if (node.moduleSpecifier) {
      exports.push({
        name: (node.moduleSpecifier as ts.StringLiteral).text,
        type: 'reexport',
        startLine,
        endLine,
      });
    }
  } else if (ts.isExportAssignment(node)) {
    exports.push({
      name: 'default',
      type: 'default',
      startLine,
      endLine,
    });
  }

  return exports;
}

function getNodeName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if (ts.isClassDeclaration(node) && node.name) return node.name.text;
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isInterfaceDeclaration(node) && node.name) return node.name.text;
  if (ts.isTypeAliasDeclaration(node) && node.name) return node.name.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return 'anonymous';
}

function getSignature(node: ts.Node): string | undefined {
  try {
    if (ts.isFunctionLike(node)) {
      const params = node.parameters.map(p => p.name.getText()).join(', ');
      return `(${params})`;
    }
    if (ts.isClassDeclaration(node)) {
      const heritage = node.heritageClauses?.map(c => c.getText()).join(' ') ?? '';
      return heritage ? `extends ${heritage}` : undefined;
    }
    if (ts.isInterfaceDeclaration(node)) {
      const heritage = node.heritageClauses?.map(c => c.getText()).join(' ') ?? '';
      return heritage ? `extends ${heritage}` : undefined;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return node.type.getText();
    }
  } catch {
    // Ignore
  }
  return undefined;
}

function getLineNumber(position: number, text: string): number {
  return text.substring(0, position).split('\n').length;
}

function createChunks(content: string, filePath: string, language: string, symbols: SymbolInfo[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  const chunkSize = 80;
  const overlap = 20;

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const end = Math.min(i + chunkSize, lines.length);
    const chunkLines = lines.slice(i, end);
    const chunkContent = chunkLines.join('\n');

    if (chunkContent.trim().length === 0) continue;

    // Find symbol in this chunk
    let symbolName: string | undefined;
    let symbolType: string | undefined;

    for (const symbol of symbols) {
      if (symbol.startLine >= i + 1 && symbol.startLine <= end) {
        symbolName = symbol.name;
        symbolType = symbol.type;
        break;
      }
    }

    chunks.push({
      id: generateId('chunk'),
      filePath,
      startLine: i + 1,
      endLine: end,
      content: chunkContent,
      language,
      symbolName,
      symbolType,
    });

    if (end === lines.length) break;
  }

  return chunks;
}

function analyzeGeneric(content: string, filePath: string, language: string): AnalysisResult {
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  // Extract TODO/FIXME comments
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const todoMatch = line.match(/\b(TODO|FIXME|DEPRECATED|HACK|XXX)\b/);
    if (todoMatch) {
      symbols.push({
        name: todoMatch[1],
        type: 'variable',
        startLine: i + 1,
        endLine: i + 1,
        signature: line.trim(),
      });
    }
  }

  const chunks = chunkText(content, 80, 20, filePath, language);

  return { symbols, chunks, imports, exports };
}
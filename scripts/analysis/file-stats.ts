#!/usr/bin/env npx tsx
/**
 * file-stats.ts - Analyze TypeScript file metrics
 *
 * Outputs JSON with per-file stats:
 * - lineCount
 * - exportCount (named + default)
 * - functionCount (function declarations + arrow functions assigned to const)
 * - classCount
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

interface FileStats {
  path: string;
  lineCount: number;
  namedExports: number;
  defaultExports: number;
  totalExports: number;
  functionDeclarations: number;
  arrowFunctions: number;
  totalFunctions: number;
  classCount: number;
}

interface AnalysisResult {
  timestamp: string;
  rootDir: string;
  files: FileStats[];
  summary: {
    totalFiles: number;
    totalLines: number;
    totalExports: number;
    totalFunctions: number;
    totalClasses: number;
  };
}

function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function analyzeFile(filePath: string, rootDir: string): FileStats {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Count named exports: export const, export function, export class, export interface, export type, export enum
  // Also count re-exports: export { ... } and export * from
  const namedExportPatterns = [
    /^export\s+(const|let|var|function|class|interface|type|enum)\s+/m,
    /^export\s+\{/m,
    /^export\s+\*\s+from/m,
  ];

  let namedExports = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export ') && !trimmed.startsWith('export default')) {
      namedExports++;
    }
  }

  // Count default exports
  const defaultExports = (content.match(/^export\s+default\s+/gm) || []).length;

  // Count function declarations: function foo() or async function foo()
  const functionDeclarations = (content.match(/^(?:export\s+)?(?:async\s+)?function\s+\w+/gm) || []).length;

  // Count arrow functions assigned to const (rough heuristic)
  // Matches: const foo = (...) => or const foo = async (...) =>
  // Also matches: const foo: Type = (...) =>
  const arrowFunctionPattern = /^(?:export\s+)?const\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/gm;
  const arrowFunctions = (content.match(arrowFunctionPattern) || []).length;

  // Count class declarations
  const classCount = (content.match(/^(?:export\s+)?(?:abstract\s+)?class\s+\w+/gm) || []).length;

  return {
    path: relative(rootDir, filePath),
    lineCount: lines.length,
    namedExports,
    defaultExports,
    totalExports: namedExports + defaultExports,
    functionDeclarations,
    arrowFunctions,
    totalFunctions: functionDeclarations + arrowFunctions,
    classCount,
  };
}

function main() {
  const args = process.argv.slice(2);
  const rootDir = args[0] || 'src';
  const absoluteRoot = join(process.cwd(), rootDir);

  const tsFiles = findTsFiles(absoluteRoot);
  const fileStats = tsFiles.map(f => analyzeFile(f, absoluteRoot));

  const result: AnalysisResult = {
    timestamp: new Date().toISOString(),
    rootDir,
    files: fileStats.sort((a, b) => a.path.localeCompare(b.path)),
    summary: {
      totalFiles: fileStats.length,
      totalLines: fileStats.reduce((sum, f) => sum + f.lineCount, 0),
      totalExports: fileStats.reduce((sum, f) => sum + f.totalExports, 0),
      totalFunctions: fileStats.reduce((sum, f) => sum + f.totalFunctions, 0),
      totalClasses: fileStats.reduce((sum, f) => sum + f.classCount, 0),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main();

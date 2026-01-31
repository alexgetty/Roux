/**
 * File operations for DocStore
 *
 * Generic file I/O utilities extracted from DocStore for reuse
 * by FormatReader implementations.
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { EXCLUDED_DIRS } from './constants.js';

/**
 * Get file modification time in milliseconds
 */
export async function getFileMtime(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.mtimeMs;
}

/**
 * Validate that an ID resolves within the source root.
 * Throws if path traversal is detected.
 */
export function validatePathWithinSource(sourceRoot: string, id: string): void {
  const resolvedPath = resolve(sourceRoot, id);
  const resolvedRoot = resolve(sourceRoot);

  if (!resolvedPath.startsWith(resolvedRoot + '/')) {
    throw new Error(`Path traversal detected: ${id} resolves outside source root`);
  }
}

/**
 * Recursively collect files matching given extensions.
 *
 * @param dir - Directory to search
 * @param extensions - Set of extensions to match (e.g., new Set(['.md', '.markdown']))
 * @returns Array of absolute file paths
 */
export async function collectFiles(
  dir: string,
  extensions: ReadonlySet<string>
): Promise<string[]> {
  // Empty extension set = no files to collect
  if (extensions.size === 0) {
    return [];
  }

  const results: string[] = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await collectFiles(fullPath, extensions);
      results.push(...nested);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      // Skip files with no extension (README, .gitignore, etc.)
      if (ext && extensions.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Read file content as UTF-8 string
 */
export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

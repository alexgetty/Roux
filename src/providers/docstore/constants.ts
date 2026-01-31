/**
 * Directories excluded from file scanning and watching.
 * Hidden directories (starting with .) and common non-content folders.
 */
export const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  '.roux',
  'node_modules',
  '.git',
  '.obsidian',
]);

/**
 * Normalization utilities for file paths and wikilink targets.
 *
 * Single source of truth for path normalization in DocStore.
 */

/**
 * Check if a path has a file extension.
 * Extension must be 1-4 chars and contain at least one letter
 * (excludes numeric-only like .2024, .123).
 */
export function hasFileExtension(path: string): boolean {
  const match = path.match(/\.([a-z0-9]{1,4})$/i);
  if (!match?.[1]) return false;
  return /[a-z]/i.test(match[1]);
}

/**
 * Normalize a file path: lowercase, forward slashes.
 * Use for file system paths and node IDs.
 */
export function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\/g, '/');
}

/**
 * Normalize a wikilink target to a node ID.
 * Lowercases, converts backslashes, appends .md if no extension.
 * Use for resolving [[wikilinks]] to node IDs.
 */
export function normalizeLinkTarget(target: string): string {
  let normalized = target.trim().toLowerCase().replace(/\\/g, '/');

  if (!hasFileExtension(normalized)) {
    normalized += '.md';
  }

  return normalized;
}

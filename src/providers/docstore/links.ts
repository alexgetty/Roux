/**
 * Pure functions for wiki-link resolution.
 * Extracted from DocStore to reduce file size and improve testability.
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
 * Normalize a wiki-link target to an ID.
 * - Lowercase
 * - Backslashes to forward slashes
 * - Add .md if no file extension present
 */
export function normalizeWikiLink(target: string): string {
  let normalized = target.toLowerCase().replace(/\\/g, '/');

  if (!hasFileExtension(normalized)) {
    normalized += '.md';
  }

  return normalized;
}

/**
 * Build an index mapping basenames to full node IDs.
 * Used for resolving bare wiki-links like [[note]] to their full paths.
 */
export function buildFilenameIndex(
  nodes: Iterable<{ id: string }>
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const node of nodes) {
    const basename = node.id.split('/').pop()!;
    const existing = index.get(basename) ?? [];
    existing.push(node.id);
    index.set(basename, existing);
  }

  // Sort each array alphabetically for deterministic first-match
  for (const paths of index.values()) {
    paths.sort();
  }

  return index;
}

/**
 * Resolve an array of outgoing links to their full node IDs.
 * Pure function - returns resolved links without mutating anything.
 *
 * Resolution rules:
 * 1. If link already matches a valid node ID, keep it
 * 2. If link contains '/', keep it as-is (partial paths don't resolve)
 * 3. For bare filenames, look up in the filename index
 * 4. If no match found, keep original link
 */
export function resolveLinks(
  outgoingLinks: string[],
  filenameIndex: Map<string, string[]>,
  validNodeIds: Set<string>
): string[] {
  return outgoingLinks.map((link) => {
    // If link already exists as a valid node ID, keep it
    if (validNodeIds.has(link)) {
      return link;
    }

    // Only resolve bare filenames (no path separators)
    // Partial paths like "folder/target.md" stay literal
    if (link.includes('/')) {
      return link;
    }

    // Try basename lookup for bare filenames
    const matches = filenameIndex.get(link);
    if (matches && matches.length > 0) {
      return matches[0]!;
    }

    return link;
  });
}

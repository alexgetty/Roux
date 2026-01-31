/**
 * Pure functions for wiki-link resolution.
 * Extracted from DocStore to reduce file size and improve testability.
 */

import {
  hasFileExtension as hasFileExtensionImpl,
  normalizeLinkTarget,
} from './normalize.js';

/**
 * Check if a path has a file extension.
 * @deprecated Use hasFileExtension from './normalize.js' directly.
 */
export const hasFileExtension = hasFileExtensionImpl;

/**
 * Normalize a wiki-link target to an ID.
 * @deprecated Use normalizeLinkTarget from './normalize.js' directly.
 */
export const normalizeWikiLink = normalizeLinkTarget;

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

    // Fallback: try space↔dash variant
    const variant = spaceDashVariant(link);
    if (variant) {
      const variantMatches = filenameIndex.get(variant);
      if (variantMatches && variantMatches.length > 0) {
        return variantMatches[0]!;
      }
    }

    return link;
  });
}

/**
 * Generate the space↔dash variant of a filename.
 * Returns null if the filename has both or neither spaces and dashes.
 */
export function spaceDashVariant(filename: string): string | null {
  const hasSpace = filename.includes(' ');
  const hasDash = filename.includes('-');

  if (hasSpace && !hasDash) {
    return filename.replace(/ /g, '-');
  }
  if (hasDash && !hasSpace) {
    return filename.replace(/-/g, ' ');
  }
  return null;
}

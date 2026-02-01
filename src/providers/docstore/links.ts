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
 * Node shape for building filename index.
 * Uses stable nanoid-based IDs with title and optional sourceRef.
 */
interface IndexableNode {
  id: string;
  title: string;
  sourceRef?: { path?: string };
}

/**
 * Build an index mapping titles and filenames to node IDs.
 * Used for resolving wiki-links like [[My Note]] to their stable IDs.
 *
 * Resolution priority:
 * 1. Title (primary) - always indexed if non-empty
 * 2. Filename from sourceRef.path (fallback) - indexed if different from title
 */
export function buildFilenameIndex(
  nodes: Iterable<IndexableNode>
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const node of nodes) {
    const path = node.sourceRef?.path ?? '';
    const titleKey = node.title.toLowerCase();

    // Warn if completely unindexable
    if (!titleKey && !path) {
      console.warn(
        `Node ${node.id} has no title or path — link resolution will fail`
      );
    }

    // Index by title (skip if empty)
    if (titleKey) {
      const existing = index.get(titleKey) ?? [];
      existing.push(node.id);
      index.set(titleKey, existing);
    }

    // Index by filename from path (if different from title)
    if (path) {
      const filename = path
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '')
        .toLowerCase();
      if (filename && filename !== titleKey) {
        const existing = index.get(filename) ?? [];
        existing.push(node.id);
        index.set(filename, existing);
      }
    }
  }

  // Sort alphabetically for deterministic collision resolution
  for (const ids of index.values()) {
    ids.sort();
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
 * 3. Strip fragment (e.g., #Section) before resolution
 * 4. For bare filenames, look up in the filename index (after stripping .md)
 * 5. If no match found, try space/dash variant
 * 6. If still no match, keep original link
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

    // Strip fragment before resolution (e.g., [[Note#Section]] -> Note)
    const [linkWithoutFragment] = link.split('#');

    // Strip .md extension for index lookup (titles are indexed without extension)
    const lookupKey = linkWithoutFragment!.replace(/\.md$/i, '').toLowerCase();

    // Try title/filename lookup
    const matches = filenameIndex.get(lookupKey);
    if (matches && matches.length > 0) {
      // Fix #1: Warn about ambiguous resolution
      if (matches.length > 1) {
        console.warn(
          `Ambiguous wikilink "${link}" matches ${matches.length} nodes. Using "${matches[0]}".`
        );
      }
      return matches[0]!;
    }

    // Fallback: try space/dash variant
    const variant = spaceDashVariant(lookupKey);
    if (variant) {
      const variantMatches = filenameIndex.get(variant);
      if (variantMatches && variantMatches.length > 0) {
        // Fix #1: Warn about ambiguous resolution for variant matches too
        if (variantMatches.length > 1) {
          console.warn(
            `Ambiguous wikilink "${link}" matches ${variantMatches.length} nodes. Using "${variantMatches[0]}".`
          );
        }
        return variantMatches[0]!;
      }
    }

    return link;
  });
}

/**
 * Generate the space/dash variant of a filename.
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

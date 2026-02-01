import matter from 'gray-matter';

/** Reserved frontmatter keys that are extracted to dedicated fields */
export const RESERVED_FRONTMATTER_KEYS = ['id', 'title', 'tags'] as const;

export interface ParsedMarkdown {
  /** Stable frontmatter ID (12-char nanoid) */
  id?: string;
  title: string | undefined;
  tags: string[];
  properties: Record<string, unknown>;
  content: string;
  /** Raw wiki-link targets before normalization (e.g., ["Other Note", "folder/file"]) */
  rawLinks: string[];
}

/** Set of reserved keys for O(1) lookup */
const RESERVED_KEYS_SET = new Set<string>(RESERVED_FRONTMATTER_KEYS);

/**
 * Parse markdown with YAML frontmatter.
 * Handles missing/malformed frontmatter gracefully.
 */
export function parseMarkdown(raw: string): ParsedMarkdown {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    // Malformed frontmatter - return content as-is
    return {
      title: undefined,
      tags: [],
      properties: {},
      content: raw,
      rawLinks: extractWikiLinks(raw),
    };
  }

  const data = parsed.data as Record<string, unknown>;

  // Extract id - must be a string
  const id = typeof data['id'] === 'string' ? data['id'] : undefined;

  // Extract title
  const title = typeof data['title'] === 'string' ? data['title'] : undefined;

  // Extract tags - must be an array of strings
  let tags: string[] = [];
  if (Array.isArray(data['tags'])) {
    tags = data['tags'].filter((t): t is string => typeof t === 'string');
  }

  // Extract other properties (excluding all reserved keys)
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!RESERVED_KEYS_SET.has(key)) {
      properties[key] = value;
    }
  }

  const content = parsed.content.trim();

  const result: ParsedMarkdown = {
    title,
    tags,
    properties,
    content,
    rawLinks: extractWikiLinks(content),
  };

  // Only include id if it's a string (exactOptionalPropertyTypes)
  if (id !== undefined) {
    result.id = id;
  }

  return result;
}

/**
 * Extract wiki-link targets from markdown content.
 * Ignores links inside code blocks and inline code.
 * Deduplicates results.
 */
export function extractWikiLinks(content: string): string[] {
  // Remove code blocks first
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');

  // Match wiki links: [[target]] or [[target|display]]
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const seen = new Set<string>();
  const links: string[] = [];

  let match;
  while ((match = linkRegex.exec(withoutInlineCode)) !== null) {
    const target = match[1]?.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }

  return links;
}

import { normalizePath } from './normalize.js';

/**
 * Normalize a file path to a consistent ID format.
 * @deprecated Use normalizePath from './normalize.js' directly.
 */
export const normalizeId = normalizePath;

/**
 * Derive a human-readable title from a file path.
 * - Removes directory prefix
 * - Removes extension
 * - Replaces hyphens/underscores with spaces
 * - Title-cases words
 */
export function titleFromPath(path: string): string {
  // Get filename without directory
  const parts = path.split(/[/\\]/);
  // parts is always non-empty (even '' splits to [''])
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const filename = parts.at(-1)!;

  // Remove extension
  const withoutExt = filename.replace(/\.[^.]+$/, '');

  // Replace hyphens and underscores with spaces, collapse multiples
  const spaced = withoutExt.replace(/[-_]+/g, ' ').toLowerCase();

  // Title-case each word
  return spaced
    .split(' ')
    .filter((w) => w.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Serialize parsed markdown back to a string with YAML frontmatter.
 * Omits frontmatter if no metadata is present.
 * Places id FIRST in frontmatter for consistency.
 */
export function serializeToMarkdown(parsed: ParsedMarkdown): string {
  const hasFrontmatter =
    parsed.id !== undefined ||
    parsed.title !== undefined ||
    parsed.tags.length > 0 ||
    Object.keys(parsed.properties).length > 0;

  if (!hasFrontmatter) {
    return parsed.content;
  }

  // Build frontmatter object with id FIRST
  // Using insertion order which is preserved in modern JS
  const frontmatter: Record<string, unknown> = {};

  if (parsed.id !== undefined) {
    frontmatter['id'] = parsed.id;
  }

  if (parsed.title !== undefined) {
    frontmatter['title'] = parsed.title;
  }

  if (parsed.tags.length > 0) {
    frontmatter['tags'] = parsed.tags;
  }

  // Add other properties
  for (const [key, value] of Object.entries(parsed.properties)) {
    frontmatter[key] = value;
  }

  // Use gray-matter to stringify
  return matter.stringify(parsed.content, frontmatter);
}

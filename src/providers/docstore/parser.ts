import matter from 'gray-matter';

export interface ParsedMarkdown {
  title: string | undefined;
  tags: string[];
  properties: Record<string, unknown>;
  content: string;
}

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
    };
  }

  const data = parsed.data as Record<string, unknown>;

  // Extract title
  const title = typeof data['title'] === 'string' ? data['title'] : undefined;

  // Extract tags - must be an array of strings
  let tags: string[] = [];
  if (Array.isArray(data['tags'])) {
    tags = data['tags'].filter((t): t is string => typeof t === 'string');
  }

  // Extract other properties (excluding title and tags)
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'title' && key !== 'tags') {
      properties[key] = value;
    }
  }

  return {
    title,
    tags,
    properties,
    content: parsed.content.trim(),
  };
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

/**
 * Normalize a file path to a consistent ID format.
 * - Lowercased
 * - Forward slashes only
 * - Preserves extension
 */
export function normalizeId(path: string): string {
  return path.toLowerCase().replace(/\\/g, '/');
}

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
 */
export function serializeToMarkdown(parsed: ParsedMarkdown): string {
  const hasFrontmatter =
    parsed.title !== undefined ||
    parsed.tags.length > 0 ||
    Object.keys(parsed.properties).length > 0;

  if (!hasFrontmatter) {
    return parsed.content;
  }

  // Build frontmatter object
  const frontmatter: Record<string, unknown> = {};

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

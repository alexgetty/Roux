import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';

/** Pattern for valid nanoid: exactly 12 URL-safe characters */
const NANOID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

/** Prefix for ghost node IDs */
const GHOST_PREFIX = 'ghost_';

/**
 * Check if a string is a valid frontmatter ID (12-char nanoid).
 */
export const isValidId = (id: string): boolean => NANOID_PATTERN.test(id);

/**
 * Generate a new frontmatter ID (12-char nanoid).
 */
export const generateId = (): string => nanoid(12);

/**
 * Generate a deterministic ghost ID from a title.
 * Ghost IDs are for placeholder nodes created from unresolved wikilinks.
 *
 * - Case-insensitive (normalized to lowercase)
 * - Whitespace-normalized (trimmed)
 * - Deterministic: same title always produces same ID
 */
export function ghostId(title: string): string {
  const normalized = title.toLowerCase().trim();
  const hash = createHash('sha256')
    .update(normalized)
    .digest('base64url')
    .slice(0, 12);
  return `${GHOST_PREFIX}${hash}`;
}

/**
 * Check if an ID is a ghost node ID (starts with ghost_ prefix).
 */
export function isGhostId(id: string): boolean {
  return id.startsWith(GHOST_PREFIX);
}

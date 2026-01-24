/** Content truncation limits by context. */
export const TRUNCATION_LIMITS = {
  /** Primary node (get_node, single result) */
  primary: 10_000,
  /** List results (search, neighbors) */
  list: 500,
  /** Neighbor nodes in context */
  neighbor: 200,
} as const;

export type TruncationContext = keyof typeof TRUNCATION_LIMITS;

const TRUNCATION_SUFFIX = '... [truncated]';

/**
 * Truncate content to limit, appending suffix if truncated.
 * Returns original content if within limit.
 */
export function truncateContent(
  content: string,
  context: TruncationContext
): string {
  const limit = TRUNCATION_LIMITS[context];

  if (content.length <= limit) {
    return content;
  }

  // Account for suffix length when truncating, guard against negative
  const truncatedLength = Math.max(0, limit - TRUNCATION_SUFFIX.length);
  return content.slice(0, truncatedLength) + TRUNCATION_SUFFIX;
}

/**
 * Check if content was truncated (ends with truncation suffix).
 */
export function isTruncated(content: string): boolean {
  return content.endsWith(TRUNCATION_SUFFIX);
}

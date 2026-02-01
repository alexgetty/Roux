import { nanoid } from 'nanoid';

/** Pattern for valid nanoid: exactly 12 URL-safe characters */
const NANOID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

/**
 * Check if a string is a valid frontmatter ID (12-char nanoid).
 */
export const isValidId = (id: string): boolean => NANOID_PATTERN.test(id);

/**
 * Generate a new frontmatter ID (12-char nanoid).
 */
export const generateId = (): string => nanoid(12);

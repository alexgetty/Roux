import { McpError } from './types.js';

export function coerceInt(
  value: unknown,
  defaultValue: number,
  minValue: number,
  fieldName: string
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < minValue) {
    throw new McpError('INVALID_PARAMS', `${fieldName} must be at least ${minValue}`);
  }
  return floored;
}

export function coerceLimit(value: unknown, defaultValue: number): number {
  return coerceInt(value, defaultValue, 1, 'limit');
}

export function coerceOffset(value: unknown, defaultValue: number): number {
  return coerceInt(value, defaultValue, 0, 'offset');
}

export function coerceDepth(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return num >= 1 ? 1 : 0;
}

/**
 * Validate that value is an array of strings.
 * Allows empty arrays — callers should check length if non-empty is required.
 */
export function validateStringArray(
  value: unknown,
  fieldName: string
): string[] {
  if (!Array.isArray(value)) {
    throw new McpError('INVALID_PARAMS', `${fieldName} is required and must be an array`);
  }
  if (!value.every((item) => typeof item === 'string')) {
    throw new McpError('INVALID_PARAMS', `${fieldName} must contain only strings`);
  }
  return value;
}

export function validateRequiredString(
  value: unknown,
  fieldName: string
): string {
  if (value === undefined || value === null || typeof value !== 'string') {
    throw new McpError('INVALID_PARAMS', `${fieldName} is required and must be a string`);
  }
  return value;
}

export function validateEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  fieldName: string,
  defaultValue: T
): T {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (!validValues.includes(value as T)) {
    throw new McpError(
      'INVALID_PARAMS',
      `${fieldName} must be one of: ${validValues.join(', ')}`
    );
  }
  return value as T;
}

/**
 * Validate optional tags array.
 * Returns undefined if not provided, validated array otherwise.
 */
export function validateOptionalTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
  }
  if (!value.every((t) => typeof t === 'string')) {
    throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
  }
  return value;
}

/**
 * Validate required non-empty tags array.
 */
export function validateRequiredTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new McpError('INVALID_PARAMS', 'tags is required and must be a non-empty array');
  }
  if (!value.every((t) => typeof t === 'string')) {
    throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
  }
  return value;
}

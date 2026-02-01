import { describe, it, expect } from 'vitest';
import { generateId, isValidId } from '../../../src/providers/docstore/id.js';

describe('generateId', () => {
  it('returns a 12-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(12);
  });

  it('returns string matching nanoid pattern', () => {
    const id = generateId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('generates unique IDs on each call', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('isValidId', () => {
  it('accepts valid nanoid', () => {
    expect(isValidId('n7x2k9m4abcd')).toBe(true);
  });

  it('accepts nanoid with allowed special characters', () => {
    expect(isValidId('abc-123_XYZ9')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidId('')).toBe(false);
  });

  it('rejects string that is too short', () => {
    expect(isValidId('abc123')).toBe(false);
  });

  it('rejects string that is too long', () => {
    expect(isValidId('n7x2k9m4abcdef')).toBe(false);
  });

  it('rejects file paths', () => {
    expect(isValidId('notes/foo.md')).toBe(false);
  });

  it('rejects strings with spaces', () => {
    expect(isValidId('has spaces12')).toBe(false);
  });

  it('rejects strings with invalid characters', () => {
    expect(isValidId('abc@123#def!')).toBe(false);
  });
});

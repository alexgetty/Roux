import { describe, it, expect } from 'vitest';
import { generateId, isValidId, ghostId, isGhostId } from '../../../src/providers/docstore/id.js';

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

describe('ghostId', () => {
  it('is deterministic: same title produces same ID', () => {
    const id1 = ghostId('Missing Page');
    const id2 = ghostId('Missing Page');
    expect(id1).toBe(id2);
  });

  it('is case-insensitive: API and api produce same ID', () => {
    const upper = ghostId('API');
    const lower = ghostId('api');
    const mixed = ghostId('Api');
    expect(upper).toBe(lower);
    expect(upper).toBe(mixed);
  });

  it('normalizes whitespace: leading/trailing/multiple spaces produce same ID', () => {
    const normal = ghostId('Note');
    const padded = ghostId('  Note  ');
    const multiSpace = ghostId('  Note');
    expect(normal).toBe(padded);
    expect(normal).toBe(multiSpace);
  });

  it('produces different IDs for different titles', () => {
    const id1 = ghostId('First Note');
    const id2 = ghostId('Second Note');
    expect(id1).not.toBe(id2);
  });

  it('starts with ghost_ prefix', () => {
    const id = ghostId('Any Title');
    expect(id.startsWith('ghost_')).toBe(true);
  });

  it('produces URL-safe IDs (base64url)', () => {
    const id = ghostId('Test');
    // ghost_ prefix + 12 char hash
    expect(id).toMatch(/^ghost_[A-Za-z0-9_-]{12}$/);
  });

  it('cannot collide with nanoid format', () => {
    // Ghost IDs have a prefix, so they're always longer than 12 chars
    // and can never pass isValidId (which expects exactly 12 url-safe chars)
    const titles = ['Test', 'API', 'a', 'Meeting Notes', '日本語'];
    for (const title of titles) {
      const gid = ghostId(title);
      expect(isValidId(gid)).toBe(false);
    }
  });

  it('handles empty string (produces consistent hash)', () => {
    // Edge case: empty wikilinks shouldn't exist, but behavior should be consistent
    const id1 = ghostId('');
    const id2 = ghostId('');
    expect(id1).toBe(id2);
    expect(id1.startsWith('ghost_')).toBe(true);
  });

  it('handles whitespace-only string (normalizes to empty)', () => {
    // Whitespace-only normalizes to same as empty string
    const empty = ghostId('');
    const spaces = ghostId('   ');
    const tabs = ghostId('\t\t');
    expect(spaces).toBe(empty);
    expect(tabs).toBe(empty);
  });
});

describe('isGhostId', () => {
  it('returns true for ghost IDs', () => {
    const id = ghostId('Test Title');
    expect(isGhostId(id)).toBe(true);
  });

  it('returns false for nanoid IDs', () => {
    const id = generateId();
    expect(isGhostId(id)).toBe(false);
  });

  it('returns false for arbitrary strings', () => {
    expect(isGhostId('random-string')).toBe(false);
    expect(isGhostId('notes/test.md')).toBe(false);
  });

  it('returns true for strings starting with ghost_', () => {
    expect(isGhostId('ghost_abc123xyz789')).toBe(true);
  });
});

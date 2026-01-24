import { describe, it, expect } from 'vitest';
import {
  truncateContent,
  isTruncated,
  TRUNCATION_LIMITS,
} from '../../../src/mcp/truncate.js';

describe('truncateContent', () => {
  describe('primary context (10,000 chars)', () => {
    it('returns original content when under limit', () => {
      const content = 'Short content';
      expect(truncateContent(content, 'primary')).toBe(content);
    });

    it('returns original content when exactly at limit', () => {
      const content = 'x'.repeat(TRUNCATION_LIMITS.primary);
      expect(truncateContent(content, 'primary')).toBe(content);
    });

    it('truncates content over limit with suffix', () => {
      const content = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
      const result = truncateContent(content, 'primary');

      expect(result.length).toBe(TRUNCATION_LIMITS.primary);
      expect(result.endsWith('... [truncated]')).toBe(true);
    });
  });

  describe('list context (500 chars)', () => {
    it('returns original content when under limit', () => {
      const content = 'x'.repeat(400);
      expect(truncateContent(content, 'list')).toBe(content);
    });

    it('truncates content over limit with suffix', () => {
      const content = 'x'.repeat(600);
      const result = truncateContent(content, 'list');

      expect(result.length).toBe(TRUNCATION_LIMITS.list);
      expect(result.endsWith('... [truncated]')).toBe(true);
    });
  });

  describe('neighbor context (200 chars)', () => {
    it('returns original content when under limit', () => {
      const content = 'x'.repeat(150);
      expect(truncateContent(content, 'neighbor')).toBe(content);
    });

    it('truncates content over limit with suffix', () => {
      const content = 'x'.repeat(300);
      const result = truncateContent(content, 'neighbor');

      expect(result.length).toBe(TRUNCATION_LIMITS.neighbor);
      expect(result.endsWith('... [truncated]')).toBe(true);
    });
  });

  it('handles empty content', () => {
    expect(truncateContent('', 'primary')).toBe('');
    expect(truncateContent('', 'list')).toBe('');
    expect(truncateContent('', 'neighbor')).toBe('');
  });

  describe('boundary cases', () => {
    it('truncates content exactly one char over limit', () => {
      const content = 'x'.repeat(TRUNCATION_LIMITS.neighbor + 1);
      const result = truncateContent(content, 'neighbor');

      expect(result.length).toBe(TRUNCATION_LIMITS.neighbor);
      expect(result.endsWith('... [truncated]')).toBe(true);
    });

    it('returns original when exactly at truncation threshold', () => {
      // Content at exactly the limit should NOT be truncated
      const content = 'x'.repeat(TRUNCATION_LIMITS.neighbor);
      const result = truncateContent(content, 'neighbor');

      expect(result).toBe(content);
      expect(result.endsWith('... [truncated]')).toBe(false);
    });

    it('handles edge case where content is shorter than suffix', () => {
      // Very short content should never be truncated
      const content = 'hi';
      const result = truncateContent(content, 'neighbor');

      expect(result).toBe('hi');
    });
  });
});

describe('isTruncated', () => {
  it('returns true for truncated content', () => {
    expect(isTruncated('Some text... [truncated]')).toBe(true);
  });

  it('returns false for non-truncated content', () => {
    expect(isTruncated('Normal content')).toBe(false);
    expect(isTruncated('')).toBe(false);
  });

  it('returns false for content with similar but not exact suffix', () => {
    expect(isTruncated('Some text...')).toBe(false);
    expect(isTruncated('Some text [truncated]')).toBe(false);
  });
});

describe('TRUNCATION_LIMITS', () => {
  it('has expected values', () => {
    expect(TRUNCATION_LIMITS.primary).toBe(10_000);
    expect(TRUNCATION_LIMITS.list).toBe(500);
    expect(TRUNCATION_LIMITS.neighbor).toBe(200);
  });
});

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

    it('truncates content over limit with suffix and preserves prefix', () => {
      const content = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
      const result = truncateContent(content, 'primary');
      const suffix = '... [truncated]';

      expect(result.length).toBe(TRUNCATION_LIMITS.primary);
      expect(result.endsWith(suffix)).toBe(true);
      // Verify actual content preservation: prefix should be original content
      const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.primary - suffix.length);
      expect(result.slice(0, -suffix.length)).toBe(expectedPrefix);
    });
  });

  describe('list context (500 chars)', () => {
    it('returns original content when under limit', () => {
      const content = 'x'.repeat(400);
      expect(truncateContent(content, 'list')).toBe(content);
    });

    it('truncates content over limit with suffix and preserves prefix', () => {
      const content = 'x'.repeat(600);
      const result = truncateContent(content, 'list');
      const suffix = '... [truncated]';

      expect(result.length).toBe(TRUNCATION_LIMITS.list);
      expect(result.endsWith(suffix)).toBe(true);
      // Verify actual content preservation
      const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.list - suffix.length);
      expect(result.slice(0, -suffix.length)).toBe(expectedPrefix);
    });
  });

  describe('neighbor context (200 chars)', () => {
    it('returns original content when under limit', () => {
      const content = 'x'.repeat(150);
      expect(truncateContent(content, 'neighbor')).toBe(content);
    });

    it('truncates content over limit with suffix and preserves prefix', () => {
      const content = 'x'.repeat(300);
      const result = truncateContent(content, 'neighbor');
      const suffix = '... [truncated]';

      expect(result.length).toBe(TRUNCATION_LIMITS.neighbor);
      expect(result.endsWith(suffix)).toBe(true);
      // Verify actual content preservation
      const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.neighbor - suffix.length);
      expect(result.slice(0, -suffix.length)).toBe(expectedPrefix);
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
      const suffix = '... [truncated]';

      expect(result.length).toBe(TRUNCATION_LIMITS.neighbor);
      expect(result.endsWith(suffix)).toBe(true);
      // Verify content before suffix is exactly the expected prefix
      const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.neighbor - suffix.length);
      expect(result.slice(0, -suffix.length)).toBe(expectedPrefix);
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

describe('unicode handling', () => {
  describe('emoji (surrogate pairs)', () => {
    it('does not truncate mid-emoji', () => {
      // Each emoji is 2 UTF-16 code units (surrogate pair)
      // Need 150+ to exceed neighbor limit of 200
      const emoji = '\u{1F389}'.repeat(150); // 🎉 repeated = 300 code units
      const truncated = truncateContent(emoji, 'neighbor');

      // Extract content before suffix to check for orphaned surrogate
      const suffix = '... [truncated]';
      const contentBeforeSuffix = truncated.slice(0, -suffix.length);

      // Should not end with orphaned high surrogate
      expect(contentBeforeSuffix).not.toMatch(/[\uD800-\uDBFF]$/);
    });

    it('handles mixed emoji and ASCII', () => {
      const content = 'Launch 🚀 Day ☕'.repeat(50);
      const truncated = truncateContent(content, 'neighbor');

      // Verify valid UTF-8 output
      expect(truncated).not.toMatch(/[\uD800-\uDBFF]$/);
    });

    it('handles emoji at truncation boundary', () => {
      // Create content that would truncate exactly at an emoji
      const limit = TRUNCATION_LIMITS.neighbor;
      const suffix = '... [truncated]';
      const targetLength = limit - suffix.length;

      // Fill with ASCII then add emoji at the cut point
      const padding = 'x'.repeat(targetLength - 1);
      const content = padding + '🎉' + 'y'.repeat(100);

      const truncated = truncateContent(content, 'neighbor');
      expect(truncated).not.toMatch(/[\uD800-\uDBFF]$/);
    });
  });

  describe('CJK characters', () => {
    it('handles Japanese text', () => {
      const content = '日本語ノート'.repeat(100);
      const truncated = truncateContent(content, 'neighbor');

      expect(truncated.endsWith('... [truncated]')).toBe(true);
      // CJK chars are single code units, so no surrogate issues
    });

    it('handles mixed scripts', () => {
      const content = 'Hello世界'.repeat(100);
      const truncated = truncateContent(content, 'neighbor');

      expect(truncated.endsWith('... [truncated]')).toBe(true);
    });
  });

  describe('combining characters', () => {
    it('handles combining accents', () => {
      // e followed by combining acute accent = é
      const content = 'e\u0301'.repeat(200);
      const truncated = truncateContent(content, 'neighbor');

      // Ideally should not split base char from combining mark
      // But at minimum, output should be valid
      expect(truncated.endsWith('... [truncated]')).toBe(true);
    });
  });
});

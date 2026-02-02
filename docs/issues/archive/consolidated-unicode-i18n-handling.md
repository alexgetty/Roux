---
id: HSDrCBRndCd_
title: consolidated-unicode-i18n-handling
tags:
  - consolidated
  - test-audit
  - unicode
  - i18n
status: open
priority: high
---
# Consolidated: Unicode and Internationalization Handling

## Problem Pattern
Functions using `toLowerCase()`, `slice()`, and string length calculations assume single-byte ASCII characters. Multi-byte characters (CJK, emoji, accented letters) could produce incorrect results, truncated strings, or malformed output.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/docstore/links.test.ts | `normalizeWikiLink` uses `toLowerCase()` without locale consideration | HIGH |
| tests/unit/mcp/truncate.test.ts | Slicing multi-byte characters could produce malformed UTF-8 | HIGH |
| tests/unit/docstore/cache/resolve.test.ts | No Unicode characters tested in fuzzy matching | LOW |
| tests/unit/embedding/transformers.test.ts | Unicode input (CJK, emoji, RTL) not tested | LOW |
| tests/unit/docstore/readers/markdown.test.ts | Wiki-links with Unicode untested | MEDIUM |
| tests/unit/cli/viz.test.ts | Node titles with special characters not tested for XSS | MEDIUM |

## Root Cause Analysis
JavaScript's string operations operate on UTF-16 code units, not graphemes. This causes three categories of problems:
1. `toLowerCase()` has locale-dependent behavior for certain characters (Turkish dotless i, German sharp S)
2. `slice()` and `length` can split multi-byte sequences (emoji, combining characters)
3. String similarity algorithms may produce unexpected results for non-ASCII text

These issues exist because test data uniformly uses ASCII characters, leaving Unicode paths untested.

## Fix Strategy

1. **Add Unicode test fixtures**: Create a shared set of test strings containing:
   - Emoji: `'🚀 Launch'`, `'Café ☕'`
   - CJK: `'日本語ノート'`
   - Combining characters: `'e\u0301'` (é with combining accent)
   - RTL: `'مرحبا'`
   - Mixed scripts: `'Hello世界'`

2. **Update affected test files** to include at least one test case with Unicode input:
   ```typescript
   it('handles unicode characters in titles', () => {
     expect(normalizeWikiLink('Café Notes')).toBe('café notes.md');
     expect(normalizeWikiLink('日本語')).toBe('日本語.md');
   });
   ```

3. **For truncation functions**: Verify output is valid UTF-8 and doesn't end mid-character:
   ```typescript
   it('does not truncate mid-character', () => {
     const emoji = '🎉'.repeat(100); // Each emoji is 2 UTF-16 code units
     const truncated = truncateContent(emoji, 'primary');
     expect(truncated).not.toMatch(/[\uD800-\uDBFF]$/); // No trailing high surrogate
   });
   ```

4. **Consider using `Intl.Segmenter`** for grapheme-aware string operations where precision matters.

## Verification
1. Run `npm test` with new Unicode test cases
2. Verify no test produces warnings about invalid Unicode sequences
3. For truncation: check that truncated Unicode strings parse correctly in JSON.stringify()

## Source Audits
- [[audit-docstore-links-test]]
- [[audit-mcp-truncate-test]]
- [[audit-cache-resolve-test]]
- [[audit-embedding-transformers-test]]
- [[audit-readers-markdown-test]]
- [[audit-cli-viz-test]]

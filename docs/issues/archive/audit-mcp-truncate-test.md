---
title: audit-mcp-truncate-test
tags:
  - test-audit
  - mcp
status: open
---
# Test Audit: mcp/truncate.test.ts

> **Consolidated into:** [[consolidated-unicode-i18n-handling]], [[consolidated-weak-assertions]], [[consolidated-empty-string-validation]]

## Summary

The truncate test file has reasonable happy-path coverage but misses critical edge cases around Unicode handling, input validation, and content verification. The tests check length and suffix presence but never verify the actual preserved content.

## Findings

### [HIGH] Unicode Multi-Byte Character Handling Untested

**Problem:** All tests use single-byte ASCII characters. The implementation uses `content.length` and `slice()`, which count UTF-16 code units, not graphemes. Slicing in the middle of a multi-byte character could produce malformed output.

**Fix:** Add tests with emoji content, multi-byte characters at truncation boundary, combining characters.

---

### [HIGH] Content Preservation Not Verified

**Problem:** Tests verify `result.length` and `result.endsWith('... [truncated]')` but never check that the correct prefix of the original content was preserved. A buggy implementation that returns random characters + suffix would pass.

**Fix:** Add assertion that verifies prefix:
```typescript
const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.primary - TRUNCATION_SUFFIX.length);
expect(result.startsWith(expectedPrefix)).toBe(true);
```

---

### [MEDIUM] Pre-Existing Truncation Suffix Collision

**Problem:** If content naturally ends with `'... [truncated]'`, `isTruncated()` returns a false positive.

---

### [MEDIUM] Null/Undefined Input Behavior Undocumented

**Problem:** No test documents what happens with `null` or `undefined` input.

---

### [MEDIUM] Invalid Context Type Not Runtime-Checked

**Problem:** If an invalid context string is passed at runtime, `TRUNCATION_LIMITS[context]` returns `undefined`, causing unexpected behavior.

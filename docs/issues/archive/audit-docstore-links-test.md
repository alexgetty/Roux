---
id: agn_sh8TPbsu
title: audit-docstore-links-test
tags:
  - test-audit
  - docstore
---
# Test Audit: docstore/links.test.ts

> **Consolidated into:** [[consolidated-unicode-i18n-handling]], [[consolidated-empty-string-validation]], [[consolidated-boundary-conditions]]

## Summary

The `links.test.ts` test suite covers the core happy paths but has significant gaps in edge case coverage. Several code paths in the implementation are not exercised, and some tests may pass by accident due to weak fixture data.

## Findings

### [MEDIUM] hasFileExtension: Empty string not tested

**Location:** `tests/unit/docstore/links.test.ts:10-47`

**Problem:** The function `hasFileExtension('')` behavior is not tested. The regex `path.match(/\.([a-z0-9]{1,4})$/i)` will return `null` for empty string, so it returns `false`, but this is never verified.

**Evidence:**
```typescript
// Implementation (links.ts:11-15)
export function hasFileExtension(path: string): boolean {
  const match = path.match(/\.([a-z0-9]{1,4})$/i);
  if (!match?.[1]) return false;
  return /[a-z]/i.test(match[1]);
}
```

No test for `hasFileExtension('')`.

**Fix:** Add test case:
```typescript
it('returns false for empty string', () => {
  expect(hasFileExtension('')).toBe(false);
});
```

**Verification:** Test passes and covers the empty string branch.

---

### [MEDIUM] hasFileExtension: Extension exactly at boundary (1 char, 4 chars) weakly tested

**Location:** `tests/unit/docstore/links.test.ts:10-47`

**Problem:** While 4-char extensions are implicitly tested (`.json` is 4 chars), the 1-character extension boundary is not explicitly tested. Extensions like `.c`, `.h`, `.r` are valid 1-char extensions.

**Evidence:**
```typescript
// No test for 1-char extensions
// Existing tests use: .md (2), .png (3), .json (4), .txt (3)
```

**Fix:** Add explicit boundary tests:
```typescript
it('returns true for 1-char extensions', () => {
  expect(hasFileExtension('main.c')).toBe(true);
  expect(hasFileExtension('header.h')).toBe(true);
});
```

**Verification:** Tests pass, confirming 1-char boundary works.

---

### [HIGH] normalizeWikiLink: Unicode characters not tested

**Location:** `tests/unit/docstore/links.test.ts:49-79`

**Problem:** The implementation uses `toLowerCase()` which has locale-dependent behavior for certain Unicode characters. Wiki-links in Obsidian vaults often contain Unicode (e.g., `[[Café]]`, `[[日本語]]`). The current tests only use ASCII.

**Evidence:**
```typescript
// Implementation (links.ts:24)
let normalized = target.toLowerCase().replace(/\\/g, '/');

// Tests only use ASCII:
expect(normalizeWikiLink('MyNote')).toBe('mynote.md');
expect(normalizeWikiLink('UPPERCASE')).toBe('uppercase.md');
```

**Fix:** Add Unicode tests:
```typescript
it('handles unicode characters', () => {
  expect(normalizeWikiLink('Café')).toBe('café.md');
  expect(normalizeWikiLink('日本語')).toBe('日本語.md');
  expect(normalizeWikiLink('NAÏVE')).toBe('naïve.md');
});
```

**Verification:** Tests pass. Note: Turkish locale edge case (`İ` -> `i̇`) may need consideration if localization is a concern.

---

### [HIGH] normalizeWikiLink: Leading/trailing whitespace not tested

**Location:** `tests/unit/docstore/links.test.ts:49-79`

**Problem:** The implementation does not trim whitespace, meaning `normalizeWikiLink('  note  ')` returns `'  note  .md'`. This may or may not be intentional, but it's untested and undocumented.

**Evidence:**
```typescript
// Implementation does no trimming:
let normalized = target.toLowerCase().replace(/\\/g, '/');
```

**Fix:** Either:
1. Add test documenting current behavior
2. Or add trimming to implementation and test it

**Verification:** Green team decides intended behavior and tests accordingly.

---

### [HIGH] resolveLinks: Case sensitivity behavior untested

**Location:** `tests/unit/docstore/links.test.ts:123-194`

**Problem:** The `resolveLinks` function does exact matching. But wiki-links are typically case-insensitive. If a user writes `[[Alpha.md]]` but the node ID is `alpha.md`, it won't match. This behavior is untested.

---

### Additional findings omitted for brevity - see original detailed audit above.

---
title: audit-docstore-links-test
tags:
  - test-audit
  - docstore
---
# Test Audit: docstore/links.test.ts

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

### [MEDIUM] normalizeWikiLink: Multiple dots edge case

**Location:** `tests/unit/docstore/links.test.ts:49-79`

**Problem:** File names with multiple dots (e.g., `archive.2024.01.md`) are not tested. The `hasFileExtension` function only checks the final extension, but the test suite doesn't verify this cascading behavior.

**Evidence:**
```typescript
// Only tests single dot + extension:
expect(normalizeWikiLink('report.2024')).toBe('report.2024.md');
// Does not test: 'file.tar.gz', 'v1.2.3.md', 'archive.2024.01'
```

**Fix:** Add multi-dot tests:
```typescript
it('handles multiple dots in filename', () => {
  expect(normalizeWikiLink('file.tar.gz')).toBe('file.tar.gz'); // .gz is valid
  expect(normalizeWikiLink('v1.2.3')).toBe('v1.2.3.md'); // .3 is numeric-only
  expect(normalizeWikiLink('archive.2024.01.md')).toBe('archive.2024.01.md');
});
```

**Verification:** Tests pass and cover edge cases.

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
1. Add test documenting current behavior:
```typescript
it('preserves whitespace (intentional behavior)', () => {
  expect(normalizeWikiLink('  note  ')).toBe('  note  .md');
});
```
2. Or add trimming to implementation and test it:
```typescript
it('trims whitespace', () => {
  expect(normalizeWikiLink('  note  ')).toBe('note.md');
});
```

**Verification:** Green team decides intended behavior and tests accordingly.

---

### [MEDIUM] buildFilenameIndex: Node IDs without extension not tested

**Location:** `tests/unit/docstore/links.test.ts:81-121`

**Problem:** All test fixtures use `.md` extension. The function extracts basename via `node.id.split('/').pop()!`, which works regardless of extension, but nodes like `{ id: 'notes/config' }` (no extension) are never tested.

**Evidence:**
```typescript
// All fixtures have .md:
const nodes = [
  { id: 'notes/alpha.md' },
  { id: 'notes/beta.md' },
  ...
];
```

**Fix:** Add extensionless test:
```typescript
it('handles node IDs without extension', () => {
  const nodes = [{ id: 'notes/config' }, { id: 'notes/README' }];
  const index = buildFilenameIndex(nodes);
  expect(index.get('config')).toEqual(['notes/config']);
  expect(index.get('README')).toEqual(['notes/README']);
});
```

**Verification:** Test passes.

---

### [LOW] buildFilenameIndex: Deeply nested paths not tested

**Location:** `tests/unit/docstore/links.test.ts:81-121`

**Problem:** All test paths are 1 level deep (`notes/alpha.md`). Deeply nested paths like `a/b/c/d/file.md` are not tested. The `split('/').pop()!` should work, but it's not verified.

**Evidence:**
```typescript
// Deepest path in tests is 'notes/alpha.md' (1 level)
```

**Fix:** Add deep path test:
```typescript
it('handles deeply nested paths', () => {
  const nodes = [{ id: 'a/b/c/d/deep.md' }];
  const index = buildFilenameIndex(nodes);
  expect(index.get('deep.md')).toEqual(['a/b/c/d/deep.md']);
});
```

**Verification:** Test passes.

---

### [HIGH] resolveLinks: Case sensitivity behavior untested

**Location:** `tests/unit/docstore/links.test.ts:123-194`

**Problem:** The `resolveLinks` function does exact matching (`validNodeIds.has(link)`, `filenameIndex.get(link)`). But wiki-links are typically case-insensitive. If a user writes `[[Alpha.md]]` but the node ID is `alpha.md`, it won't match. This behavior is untested.

**Evidence:**
```typescript
// Implementation uses exact match:
if (validNodeIds.has(link)) { return link; }
const matches = filenameIndex.get(link);

// No test for case mismatch:
// e.g., resolveLinks(['Alpha.md'], index, validNodeIds) where only 'alpha.md' exists
```

**Fix:** Add case sensitivity tests:
```typescript
it('does not resolve case-mismatched links (documents current behavior)', () => {
  const links = ['Alpha.md']; // Capital A, but index has 'alpha.md'
  const resolved = resolveLinks(links, filenameIndex, validNodeIds);
  expect(resolved).toEqual(['Alpha.md']); // Not resolved - kept as-is
});
```

**Verification:** Test documents actual behavior. Green team should evaluate if case-insensitive matching is needed.

---

### [MEDIUM] resolveLinks: Empty filenameIndex / empty validNodeIds not tested

**Location:** `tests/unit/docstore/links.test.ts:123-194`

**Problem:** The test fixtures always have populated `filenameIndex` and `validNodeIds`. Edge case of completely empty Maps/Sets is not tested.

**Evidence:**
```typescript
// Fixtures always have data:
const filenameIndex = new Map([...]);
const validNodeIds = new Set([...]);

// No test for:
resolveLinks(['alpha.md'], new Map(), new Set())
```

**Fix:** Add empty collection test:
```typescript
it('handles empty filenameIndex and validNodeIds', () => {
  const links = ['alpha.md', 'notes/beta.md'];
  const resolved = resolveLinks(links, new Map(), new Set());
  expect(resolved).toEqual(['alpha.md', 'notes/beta.md']); // All kept as-is
});
```

**Verification:** Test passes.

---

### [LOW] resolveLinks: Duplicate links in input array not tested

**Location:** `tests/unit/docstore/links.test.ts:123-194`

**Problem:** If the input array contains duplicates (`['alpha.md', 'alpha.md']`), the function processes each independently. This is fine, but the behavior is undocumented via tests.

**Evidence:**
```typescript
// No test with duplicate links
```

**Fix:** Add duplicate test:
```typescript
it('processes duplicate links independently', () => {
  const links = ['alpha.md', 'alpha.md'];
  const resolved = resolveLinks(links, filenameIndex, validNodeIds);
  expect(resolved).toEqual(['notes/alpha.md', 'notes/alpha.md']);
});
```

**Verification:** Test passes.

---

### [HIGH] resolveLinks: Link already in validNodeIds but ALSO matches basename - which takes priority?

**Location:** `tests/unit/docstore/links.test.ts:137-141`

**Problem:** The test "keeps links that already match valid node IDs" uses full paths (`notes/alpha.md`). But what if a bare filename like `alpha.md` is BOTH in `validNodeIds` AND in `filenameIndex`? The implementation checks `validNodeIds` first, but this edge case isn't tested.

**Evidence:**
```typescript
// Implementation priority:
if (validNodeIds.has(link)) { return link; }  // 1. Check validNodeIds
if (link.includes('/')) { return link; }       // 2. Skip paths
const matches = filenameIndex.get(link);       // 3. Basename lookup
```

Scenario: `validNodeIds = Set(['alpha.md'])`, `filenameIndex = Map([['alpha.md', ['notes/alpha.md']]])`. What does `resolveLinks(['alpha.md'], ...)` return?

**Fix:** Add priority test:
```typescript
it('validNodeIds takes priority over filenameIndex for bare filenames', () => {
  const customValidIds = new Set(['alpha.md']); // root-level alpha.md exists
  const customIndex = new Map([['alpha.md', ['notes/alpha.md']]]); // different path
  const links = ['alpha.md'];
  const resolved = resolveLinks(links, customIndex, customValidIds);
  expect(resolved).toEqual(['alpha.md']); // validNodeIds match wins
});
```

**Verification:** Test documents priority order explicitly.

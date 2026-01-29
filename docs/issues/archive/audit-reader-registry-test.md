---
title: audit-reader-registry-test
tags:
  - test-audit
  - docstore
status: open
---
# Test Audit: reader-registry.test.ts

**Consolidated into:** [[consolidated-empty-string-validation]], [[consolidated-weak-assertions]]

## Summary

The test file covers the happy paths but misses several edge cases, input validation scenarios, and has one assertion that passes by accident. The `createDefaultRegistry` tests also have coverage gaps around actual parsing behavior.

## Findings

### [HIGH] Empty Extensions Array Not Tested

**Location:** `src/providers/docstore/reader-registry.ts:21-34`

**Problem:** The `register()` method does not validate that a reader has at least one extension. Registering a reader with an empty `extensions` array succeeds silently but creates a useless reader.

**Evidence:**
```typescript
// Implementation allows this:
const emptyReader: FormatReader = {
  extensions: [],  // Empty!
  parse: () => { /* ... */ }
};
registry.register(emptyReader);  // Succeeds but does nothing
```

**Fix:** Either:
1. Add test asserting empty extensions throws (if that's desired behavior)
2. Add test asserting empty extensions is allowed but harmless (if intentional)

**Verification:** Add test case, confirm it documents actual behavior.

---

### [HIGH] Extension Without Leading Dot Not Tested

**Location:** `src/providers/docstore/reader-registry.ts:23-24`

**Problem:** The implementation normalizes extensions to lowercase but does not validate the leading dot. A reader registered with `['md']` (no dot) would be stored under key `'md'`, but `getReader('.md')` normalizes to `.md` and fails to match.

**Evidence:**
```typescript
// This registration:
registry.register({ extensions: ['md'], parse: ... });

// Would fail this lookup:
registry.getReader('.md');  // Returns null (looks for 'md' normalized as '.md')
```

**Fix:** Add test case demonstrating the mismatch behavior. Consider whether implementation should validate/normalize the dot.

**Verification:** Test that registers `['md']` and asserts `getReader('.md')` returns null (or throws, if validation added).

---

### [MEDIUM] parse() Does Not Verify Reader Return Type

**Location:** `tests/unit/docstore/reader-registry.test.ts:123-138`

**Problem:** The `parse()` test only checks `node.title` but the mock reader could return a malformed Node. The test passes by accident because the mock happens to return valid data.

**Evidence:**
```typescript
// Test at line 137:
const node = registry.parse('# Content', context);
expect(node.title).toBe('Mock: notes/test.md');
// No assertion that node has required fields (id, tags, outgoingLinks, etc.)
```

**Fix:** Either:
1. Assert the full Node structure returned
2. Create a separate test that verifies FormatReader contract violations are handled (or not)

**Verification:** Confirm test fails if mock returns incomplete Node.

---

### [MEDIUM] createDefaultRegistry Parsing Not Tested

**Location:** `tests/unit/docstore/reader-registry.test.ts:165-181`

**Problem:** Tests only verify extensions are registered, not that the MarkdownReader actually parses correctly. The integration is untested - you could register a broken reader and these tests would pass.

**Evidence:**
```typescript
// All three tests only check hasReader/getExtensions:
expect(defaultRegistry.hasReader('.md')).toBe(true);
expect(defaultRegistry.hasReader('.markdown')).toBe(true);
expect(exts.has('.md')).toBe(true);
// No parsing test!
```

**Fix:** Add test that calls `parse()` with markdown content and asserts correct Node output.

**Verification:** Test that `createDefaultRegistry().parse('# Title\n\nBody', context)` returns expected Node.

---

### [MEDIUM] getExtensions() Return Type Immutability Not Tested

**Location:** `src/providers/docstore/reader-registry.ts:48-50`

**Problem:** `getExtensions()` returns `ReadonlySet<string>` but the test doesn't verify the caller can't mutate the internal state. TypeScript types are compile-time only.

**Evidence:**
```typescript
// Implementation returns a new Set each call (good), but test doesn't verify:
getExtensions(): ReadonlySet<string> {
  return new Set(this.readers.keys());
}

// Test only checks values, not immutability:
const exts = registry.getExtensions();
expect(exts).toEqual(new Set(['.md', '.markdown', '.txt']));
```

**Fix:** Add test that attempts mutation (cast to Set, call `.add()`) and verifies internal state unchanged.

**Verification:** `registry.getExtensions().add('.hacked')` should not affect `registry.hasReader('.hacked')`.

---

### [LOW] types.ts Contract Test Is Fragile

**Location:** `tests/unit/docstore/reader-registry.test.ts:184-190`

**Problem:** The test imports `types.ts` as a module and checks `Object.keys()` is empty. This works now but is fragile - a const enum or namespace would break it despite still being "types only".

**Evidence:**
```typescript
import * as typesModule from '../../../src/providers/docstore/types.js';
// ...
const runtimeExports = Object.keys(typesModule);
expect(runtimeExports).toEqual([]);
```

**Fix:** Consider whether this test adds value. If kept, document why it exists and what it's really checking.

**Verification:** If a `const enum` is added to types.ts, this test may fail or pass incorrectly depending on transpilation settings.

---

### [LOW] register() Case Normalization Asymmetry Not Tested

**Location:** `src/providers/docstore/reader-registry.ts:23-27`

**Problem:** When registration fails, the error message shows the original extension (`.md`) but internally the key is normalized (`.md` -> `.md`). For extensions like `.MD`, the error would say `.MD` but storage key is `.md`. Not a bug, but the asymmetry is untested.

**Evidence:**
```typescript
if (this.readers.has(normalizedExt)) {
  throw new Error(`Extension already registered: ${ext}`);  // Uses original `ext`
}
```

**Fix:** Add test registering `.MD` then `.md` and assert error message says `.md` (the second attempt's original case).

**Verification:** Test confirms error message uses the new registration's case, not the normalized key.

---

### [LOW] No Test for Concurrent Registration

**Location:** `src/providers/docstore/reader-registry.ts:21-35`

**Problem:** No test verifies behavior if two calls to `register()` happen in quick succession with overlapping extensions. Not critical (JavaScript is single-threaded for sync code), but async init patterns could expose issues.

**Fix:** Low priority. Document that ReaderRegistry is not designed for concurrent modification.

**Verification:** N/A - documentation only.

---
tags:
  - test-audit
  - mcp
status: open
title: audit-mcp-truncate-test
---

# Test Audit: mcp/truncate.test.ts

## Summary

The truncate test file has reasonable happy-path coverage but misses critical edge cases around Unicode handling, input validation, and content verification. The tests check length and suffix presence but never verify the actual preserved content.

## Findings

### [HIGH] Unicode Multi-Byte Character Handling Untested

**Location:** `tests/unit/mcp/truncate.test.ts` (entire file)

**Problem:** All tests use single-byte ASCII characters (`'x'.repeat()`). The implementation uses `content.length` and `slice()`, which count UTF-16 code units, not graphemes. Slicing in the middle of a multi-byte character (emoji, CJK, combining characters) could produce malformed output.

**Evidence:**
```typescript
// All test inputs are ASCII
const content = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
```

**Fix:** Add tests with:
- Emoji content (e.g., `'🎉'.repeat(100)`)
- Multi-byte characters at truncation boundary
- Combining characters (e.g., `'e\u0301'` for é)

**Verification:** Test that truncated Unicode strings are still valid UTF-8 and don't end mid-character.

---

### [HIGH] Content Preservation Not Verified

**Location:** `tests/unit/mcp/truncate.test.ts:20-26`, `35-41`, `50-56`

**Problem:** Tests verify `result.length` and `result.endsWith('... [truncated]')` but never check that the correct prefix of the original content was preserved. A buggy implementation that returns random characters + suffix would pass.

**Evidence:**
```typescript
it('truncates content over limit with suffix', () => {
  const content = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
  const result = truncateContent(content, 'primary');

  expect(result.length).toBe(TRUNCATION_LIMITS.primary);
  expect(result.endsWith('... [truncated]')).toBe(true);
  // ❌ Never verifies result starts with correct prefix!
});
```

**Fix:** Add assertion that verifies prefix:
```typescript
const expectedPrefix = content.slice(0, TRUNCATION_LIMITS.primary - TRUNCATION_SUFFIX.length);
expect(result.startsWith(expectedPrefix)).toBe(true);
```

**Verification:** Tests fail if implementation corrupts or reorders content.

---

### [MEDIUM] Pre-Existing Truncation Suffix Collision

**Location:** `tests/unit/mcp/truncate.test.ts:93-107` (isTruncated tests)

**Problem:** If content naturally contains or ends with `'... [truncated]'` (e.g., user wrote it manually), `isTruncated()` returns a false positive. No test documents this edge case or the intended behavior.

**Evidence:**
```typescript
// This returns true, but content was never truncated by the module
isTruncated('User wrote: this got... [truncated]'); // true
```

**Fix:** Either:
1. Document this as expected behavior with a test
2. Use a more unique suffix (though this is a design decision)

**Verification:** Add explicit test case documenting the contract.

---

### [MEDIUM] Null/Undefined Input Behavior Undocumented

**Location:** `src/mcp/truncate.ts:19-32`

**Problem:** No test documents what happens with `null` or `undefined` input. The implementation will throw (`Cannot read properties of null (reading 'length')`), but this contract isn't tested.

**Evidence:**
```typescript
// No test for this - will throw at runtime
truncateContent(null as any, 'primary');
truncateContent(undefined as any, 'primary');
```

**Fix:** Add explicit tests that either:
1. Verify TypeScript rejects these at compile time (documented in test)
2. Verify runtime behavior with assertion on error

**Verification:** Test file explicitly documents the null/undefined contract.

---

### [MEDIUM] Invalid Context Type Not Runtime-Checked

**Location:** `src/mcp/truncate.ts:21-23`

**Problem:** If an invalid context string is passed (runtime bypass of TypeScript), `TRUNCATION_LIMITS[context]` returns `undefined`, and the comparison `content.length <= undefined` returns `false`, causing truncation to 0-15 chars for any input.

**Evidence:**
```typescript
// At runtime (e.g., from JSON input):
truncateContent('hello', 'invalid' as any);
// limit = undefined
// 'hello'.length <= undefined → false
// truncatedLength = Math.max(0, undefined - 15) → NaN → Math.max(0, NaN) → 0
// Returns '... [truncated]' (just the suffix!)
```

**Fix:** Add test documenting expected behavior, consider adding runtime validation.

**Verification:** Test verifies behavior with invalid context string.

---

### [LOW] Whitespace-Only Content Untested

**Location:** `tests/unit/mcp/truncate.test.ts:59-63`

**Problem:** Empty string is tested, but whitespace-only strings are not. Edge case for content like `'   '.repeat(1000)`.

**Evidence:**
```typescript
it('handles empty content', () => {
  expect(truncateContent('', 'primary')).toBe('');
  // No test for whitespace-only content
});
```

**Fix:** Add test for whitespace-only content exceeding limit.

**Verification:** Whitespace content truncates correctly with suffix.

---

### [LOW] Suffix-Longer-Than-Limit Path Not Exercised

**Location:** `src/mcp/truncate.ts:30`

**Problem:** The `Math.max(0, limit - TRUNCATION_SUFFIX.length)` guard exists for when suffix exceeds limit, but no test exercises this path. With current limits (200, 500, 10000), this is unreachable, but the defensive code exists untested.

**Evidence:**
```typescript
// Implementation has defensive code:
const truncatedLength = Math.max(0, limit - TRUNCATION_SUFFIX.length);
// But no test with limit < 15 (suffix length)
```

**Fix:** Either:
1. Add a test with a mock/parameterized limit smaller than suffix
2. Accept this as dead defensive code and leave untested

**Verification:** Decision documented either way.

---

## Test Quality Observations

1. **Good:** Boundary testing at exact limit and limit+1
2. **Good:** Empty string handling
3. **Good:** All three context types tested
4. **Gap:** All inputs are homogeneous (`'x'` repeated) - no realistic content
5. **Gap:** No integration with actual MCP response shapes

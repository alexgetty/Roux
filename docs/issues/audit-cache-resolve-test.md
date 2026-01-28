---
tags:
  - test-audit
  - docstore
  - cache
status: open
title: audit-cache-resolve-test
---

# Test Audit: cache/resolve.test.ts

## Summary

The resolve.test.ts file has reasonable coverage for happy paths but lacks edge case testing, boundary condition validation, and precise assertions. Several tests use weak assertions that could pass despite implementation bugs.

## Findings

### [MEDIUM] Threshold Boundary Not Tested

**Location:** `tests/unit/docstore/cache/resolve.test.ts:60-72`

**Problem:** Tests use thresholds 0.7 and 0.9 and assert scores are greater than threshold, but never test the exact boundary case where `score === threshold`. Implementation uses `>=` on line 54 of resolve.ts.

**Evidence:**
```typescript
// Line 64 - asserts > 0.7, but what if score is exactly 0.7?
expect(result[0]!.score).toBeGreaterThan(0.7);

// Implementation (resolve.ts:54)
if (bestMatch.rating >= threshold) {  // Note: >=, not >
```

**Fix:** Add test with a query that produces score exactly at threshold (may need to craft input carefully or mock string-similarity).

**Verification:** Test confirms a match at exactly threshold is accepted.

---

### [MEDIUM] Weak Assertion on Exact Match Score

**Location:** `tests/unit/docstore/cache/resolve.test.ts:80-85`

**Problem:** Test comment says "Exact match should have very high score" but assertion only checks `> 0.9`. An exact string match via Dice coefficient should return 1.0.

**Evidence:**
```typescript
it('returns score from string-similarity', () => {
  const result = resolveNames(['ground beef'], candidates, { strategy: 'fuzzy', threshold: 0.7 });

  // Exact match should have very high score
  expect(result[0]!.score).toBeGreaterThan(0.9);  // Should be exactly 1.0
});
```

**Fix:** Assert `toBe(1)` for exact string match, or if string-similarity doesn't guarantee 1.0, document why.

**Verification:** Test fails if score isn't exactly 1.0.

---

### [MEDIUM] Empty String Input Untested

**Location:** `tests/unit/docstore/cache/resolve.test.ts` (missing test)

**Problem:** No tests for empty string as query name or as candidate title. Empty strings could cause edge case bugs in string-similarity or produce unexpected results.

**Evidence:** Implementation does no validation on empty strings:
```typescript
// resolve.ts:40
const queryLower = query.toLowerCase();  // '' -> '' - what does string-similarity do?
```

**Fix:** Add tests for:
- `resolveNames([''], candidates, ...)` 
- Candidates with empty title: `[{ id: 'x.md', title: '' }]`

**Verification:** Tests document and verify behavior for empty strings.

---

### [LOW] Discarded Score Not Explicitly Tested

**Location:** `tests/unit/docstore/cache/resolve.test.ts:67-72`

**Problem:** When fuzzy match is below threshold, the test asserts `score: 0`. But the implementation discards the actual score and returns 0. This is a design decision that should be explicitly tested and documented.

**Evidence:**
```typescript
// Test at line 71
expect(result[0]!.score).toBe(0);

// Implementation (resolve.ts:58)
return { query, match: null, score: 0 };  // Actual score is lost
```

**Fix:** Add test with name like "discards actual score when below threshold" to document this is intentional.

**Verification:** Test name documents the design decision.

---

### [LOW] Special Characters and Unicode Untested

**Location:** `tests/unit/docstore/cache/resolve.test.ts` (missing test)

**Problem:** All test data uses simple ASCII strings. No tests for:
- Unicode characters (accents, CJK, emoji)
- Newlines in titles
- Special regex characters

**Evidence:**
```typescript
// All candidates use simple ASCII
const candidates: Candidate[] = [
  { id: 'ingredients/ground beef.md', title: 'Ground Beef' },
  // ...
];
```

**Fix:** Add candidate with Unicode title (e.g., `title: 'Côte de Boeuf'`) and query with accent variations.

**Verification:** Tests confirm or document behavior with non-ASCII input.

---

### [LOW] Non-Null Assertion on Map Lookup

**Location:** `src/providers/docstore/cache/resolve.ts:55`

**Problem:** Uses `!` non-null assertion on map lookup. If implementation is modified and this invariant breaks, it will throw uncaught error rather than graceful failure.

**Evidence:**
```typescript
const matchedId = titleToId.get(bestMatch.target)!;  // Could be undefined
```

**Fix:** Test should verify the invariant (map always contains bestMatch.target) or implementation should handle undefined.

**Verification:** Add negative test that would catch if map doesn't contain expected key.

---

## Already Documented Issues (Skip)

The following gaps are already documented elsewhere:
- Duplicate title collision (`resolve-duplicate-title-collision.md`)
- Semantic strategy fallthrough (`cache-test-gaps.md`)
- Semantic strategy at DocStore level (`docstore-semantic-resolve-unit-test.md`)

## References

- [[Cache]]
- [[DocStore]]

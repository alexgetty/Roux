---
id: yhGU5tX6xl9i
title: Cache Test Gaps
tags:
  - issue
  - cache
  - testing
type: '[[Test Gap]]'
priority: Low
component: '[[Cache]]'
status: open
---
# Cache Test Gaps

Missing test coverage in DocStore cache layer.

## 1. Fuzzy Threshold Boundary Test

**Location:** `tests/unit/docstore/cache.test.ts`

Tests verify typos match above threshold but don't assert behavior exactly at threshold (0.7). Score 0.69 vs 0.71 is implied but not explicit.

## 2. Semantic Strategy Fallthrough Untested

**Location:** `src/providers/docstore/cache.ts:329-331`

Cache returns `{ match: null, score: 0 }` for semantic strategy (correctly delegating to GraphCore), but this path has no unit test.

## 3. SQL Injection Defensive Test

**Location:** `tests/unit/docstore/cache.test.ts`

`listNodes` uses parameterized queries (safe), but a test confirming bad input like `'; DROP TABLE nodes; --'` doesn't crash would be defensive documentation.

## 4. Accessing Private DB Field

**Location:** `tests/unit/docstore/cache.test.ts:397-404`

`@ts-expect-error` to access private field for test verification. Fragile.

**Fix:** Consider exposing a test-only method or trusting implementation.

## References

- Red team round 8
- Red team round 9

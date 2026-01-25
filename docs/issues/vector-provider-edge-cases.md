---
title: Vector Provider Edge Cases
tags:
  - issue
  - vector
  - testing
---
# Vector Provider Edge Cases

Collection of untested edge cases in SqliteVectorProvider.

## 1. Zero Vector Accepted Without Warning

**Location:** `src/providers/vector/sqlite.ts:31-39`

Zero vectors `[0,0,0]` are accepted and return distance 1. Semantically meaningless for embeddings but stored silently.

**Fix:** Throw on zero magnitude or log warning.

## 2. getEmbeddingCount() Untested

**Location:** `src/providers/vector/sqlite.ts:141-146`

Method exists but no test coverage.

**Fix:** Add test verifying count after store/delete.

## 3. close() Twice Behavior

**Location:** `tests/unit/vector/sqlite.test.ts`

No test for double-close on provider.

**Fix:** Add test verifying doesn't throw.

## 4. Search Boundary: Exactly Limit Vectors

**Location:** `tests/unit/vector/sqlite.test.ts:118-127`

Tests `limit 2` with 4 vectors. No test for `limit 10` with exactly 10 or fewer vectors.

**Fix:** Add boundary test.

## 5. Passed DB Remains Usable After Close

**Location:** `tests/unit/vector/sqlite.test.ts:361-373`

When `ownsDb = false`, test doesn't verify `db.open` is still true after `provider.close()`.

**Fix:** Add assertion.

## References

- Red team round 2 #6
- Red team round 4 #4
- Red team round 5 #5, #6
- Red team round 6 #5
- Red team round 7 #1

---
title: audit-vector-sqlite-test
tags:
  - test-audit
  - vector
status: open
---
# Test Audit: vector/sqlite.test.ts

**Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-empty-string-validation]], [[consolidated-weak-assertions]]

## Summary

The test file has solid coverage for happy paths and basic validation, but contains weak assertions that could pass by accident, missing edge cases around concurrent operations, and untested methods. Some findings overlap with `[[Vector Provider Edge Cases]]` - those are noted but not duplicated here.

## Findings

### [HIGH] Concurrent store test has race-dependent assertion

**Location:** `tests/unit/vector/sqlite.test.ts:66-94`

**Problem:** The test verifies that exactly one entry survives concurrent writes, but the assertion at line 75 (`expect(model).toBeDefined()`) only checks the model exists - it doesn't fail if both writes somehow interleaved incorrectly. More critically, the conditional assertion at lines 86-93 means the test accepts either outcome without verifying the database is in a truly consistent state.

**Evidence:**
```typescript
// Verify model and vector are consistent (from the same write)
// If model is 'model-first', vector should be [1,0,0] (distance ~0 from query)
// If model is 'model-second', vector should be [0,1,0] (distance ~1 from query)
const distance = concurrentResults[0]!.distance;
if (model === 'model-first') {
  expect(distance).toBeCloseTo(0, 5);
} else {
  expect(model).toBe('model-second');
  expect(distance).toBeCloseTo(1, 5);
}
```

The if/else means this test can never fail - if model is first, it checks first's distance; if model is second, it checks second's distance. Both are correct by definition. This doesn't test atomicity - it tests that whichever one won is self-consistent.

**Fix:** Test atomicity by verifying count is exactly 1, then verify the vector blob matches the expected vector for whichever model won. Could also add a stress test with more concurrent operations.

**Verification:** Temporarily break the `INSERT OR REPLACE` to just `INSERT` and verify the test fails (should get UNIQUE constraint violation or duplicate entries).

---

### [HIGH] search() loads all vectors - no test for large dataset performance

**Location:** `src/providers/vector/sqlite.ts:74-76`

**Problem:** The implementation does `SELECT id, vector FROM vectors` loading ALL vectors into memory before filtering. No test verifies behavior or performance with large datasets (1000+ vectors). This is a design choice but it's untested.

**Evidence:**
```typescript
const rows = this.db
  .prepare('SELECT id, vector FROM vectors')
  .all() as Array<{ id: string; vector: Buffer }>;
```

**Fix:** Add a test that stores 1000+ vectors and verifies search still works correctly. Document the O(n) memory characteristic.

**Verification:** Test should pass and document expected behavior.

---

### [MEDIUM] No test for special characters in id

**Location:** `tests/unit/vector/sqlite.test.ts` (missing)

**Problem:** Tests use simple IDs like `'doc1'`, `'a'`, `'identical'`. No test verifies behavior with special characters (spaces, quotes, unicode, SQL injection attempts).

**Evidence:** All test IDs are simple alphanumeric strings.

**Fix:** Add tests for:
- ID with spaces: `'my document'`
- ID with quotes: `'doc"name'`
- ID with unicode: `'文档1'`
- SQL injection attempt: `'doc1"; DROP TABLE vectors;--'`

**Verification:** All operations should succeed without data corruption.

---

### [MEDIUM] getVectorBlobSize is test-only method without exhaustive coverage

**Location:** `src/providers/vector/sqlite.ts:133-139`, `tests/unit/vector/sqlite.test.ts:44-56`

**Problem:** This method is marked "For testing" but only tested for the happy path (stored vector returns size) and missing ID (returns null). Not tested after overwrite.

**Evidence:**
```typescript
/** For testing: get vector blob size */
getVectorBlobSize(id: string): number | null {
```

Tests only check:
- Line 49: Size is 20 bytes for 5-element vector
- Line 54: Returns null for missing ID

**Fix:** Add test verifying blob size changes correctly after overwrite with different dimension vector.

**Verification:** `getVectorBlobSize('a')` should return `12` after storing 3-dim, then `20` after overwriting with 5-dim.

---

### [MEDIUM] Float32 precision loss not explicitly tested

**Location:** `src/providers/vector/sqlite.ts:53`

**Problem:** Vectors are stored as Float32Array, losing precision from JS's Float64 numbers. No test verifies this precision loss is acceptable or documents the tradeoff.

**Evidence:**
```typescript
const blob = Buffer.from(new Float32Array(vector).buffer);
```

JavaScript numbers are 64-bit floats. Storing as Float32 loses precision. For example, `0.123456789` becomes `0.12345679104328156` when round-tripped through Float32.

**Fix:** Add test that explicitly documents precision expectations:
```typescript
it('stores with Float32 precision (expected precision loss)', async () => {
  const precise = [0.123456789012345];
  await provider.store('precise', precise, 'model');
  // Retrieve and verify expected precision loss
});
```

**Verification:** Test should document the actual precision boundary.

---

### [MEDIUM] Dimension validation inconsistency on empty database

**Location:** `src/providers/vector/sqlite.ts:43-51`

**Problem:** The dimension check queries for existing vectors excluding the current ID. But the test at line 264-272 (`'allows storing after all vectors deleted'`) doesn't verify the internal dimension tracking is reset - it just checks that store succeeds.

**Evidence:**
```typescript
const existing = this.db
  .prepare('SELECT LENGTH(vector) / 4 as dim FROM vectors WHERE id != ? LIMIT 1')
  .get(id) as { dim: number } | undefined;
```

**Fix:** After deleting all vectors, explicitly verify dimension tracking is reset by storing vectors of different dimensions in sequence.

**Verification:** Store 3-dim, delete, store 5-dim, delete, store 3-dim again - all should succeed.

---

### [LOW] No test for getTableNames with empty database

**Location:** `src/providers/vector/sqlite.ts:126-131`, `tests/unit/vector/sqlite.test.ts:22-25`

**Problem:** Test verifies `'vectors'` table exists after construction. Doesn't test behavior if somehow the table doesn't exist.

**Evidence:**
```typescript
it('creates vectors table', () => {
  const tables = provider.getTableNames();
  expect(tables).toContain('vectors');
});
```

**Fix:** This is a test helper method. Low priority, but could add a test that drops the table and calls getTableNames to verify it returns empty array.

**Verification:** Minor - only needed if getTableNames is used outside tests.

---

### [LOW] No test for very small vectors (dimension 1 or 2)

**Location:** `tests/unit/vector/sqlite.test.ts` (missing)

**Problem:** Tests use 3+ dimensions. Single and two-element vectors are edge cases not tested.

**Evidence:** Smallest dimension used is 3 in most tests.

**Fix:** Add tests for 1-dim and 2-dim vectors:
```typescript
it('handles 1-dimensional vectors', async () => {
  await provider.store('scalar', [1.0], 'model');
  const results = await provider.search([1.0], 10);
  expect(results[0]!.distance).toBeCloseTo(0, 5);
});
```

**Verification:** Operations should work correctly for all dimensions >= 1.

---

## Previously Documented (See [[Vector Provider Edge Cases]])

The following gaps are already documented in the existing issue file:
- Zero vector accepted without warning
- `getEmbeddingCount()` untested
- `close()` twice behavior untested
- Search boundary (exactly limit vectors) untested
- Passed DB remains usable after close untested

## References

- Implementation: `src/providers/vector/sqlite.ts`
- Test file: `tests/unit/vector/sqlite.test.ts`
- Related issue: [[Vector Provider Edge Cases]]
- Cosine distance: `src/utils/math.ts`

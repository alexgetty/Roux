---
title: audit-cache-embeddings-test
tags:
  - test-audit
  - docstore
  - cache
---
# Test Audit: cache/embeddings.test.ts

## Summary

The embeddings cache tests cover happy paths but miss important edge cases around Float32 precision limits, error handling, and foreign key constraints. One empty-vector gap is already tracked separately.

## Findings

### [MEDIUM] Foreign Key Constraint Violation Untested

**Location:** `tests/unit/docstore/cache/embeddings.test.ts` (missing test)

**Problem:** The test setup inserts `test.md` into nodes to satisfy foreign keys, but there's no test verifying what happens when `storeEmbedding` is called for a non-existent node. The schema has `FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE` but the implementation doesn't handle the SQLite constraint error.

**Evidence:**
```typescript
// Implementation blindly runs INSERT without catching constraint errors
db.prepare(
  `
  INSERT INTO embeddings (node_id, model, vector)
  VALUES (?, ?, ?)
  ...
`).run(nodeId, model, buffer);  // throws if nodeId not in nodes table
```

**Fix:** Add test:
```typescript
it('throws when node does not exist', () => {
  expect(() => storeEmbedding(db, 'nonexistent.md', [1,2,3], 'model'))
    .toThrow(/FOREIGN KEY constraint failed/);
});
```

**Verification:** Run test, confirm it documents current throw behavior (or reveals silent failure).

---

### [MEDIUM] Special Float Values Not Tested (NaN, Infinity)

**Location:** `tests/unit/docstore/cache/embeddings.test.ts` (missing test)

**Problem:** Embeddings should never contain NaN or Infinity, but if they do, Float32Array will preserve them. No test documents this behavior or guards against it.

**Evidence:**
```typescript
// This silently stores and retrieves garbage
storeEmbedding(db, 'test.md', [NaN, Infinity, -Infinity], 'model');
const result = getEmbedding(db, 'test.md');
// result.vector = [NaN, Infinity, -Infinity] - valid JS, but corrupt embedding
```

**Fix:** Either:
1. Add validation to reject special values (preferred), or
2. Add test documenting the current pass-through behavior

**Verification:** Run `storeEmbedding(db, 'test.md', [NaN], 'model')` - if it doesn't throw, the system silently accepts corrupt data.

---

### [LOW] Weak Assertion on Round-Trip Test

**Location:** `tests/unit/docstore/cache/embeddings.test.ts:77-85`

**Problem:** Test "returns embedding record with model and vector" only checks `toHaveLength(3)`, not that values survived the round-trip. A bug that corrupts values but preserves length would pass.

**Evidence:**
```typescript
it('returns embedding record with model and vector', () => {
  storeEmbedding(db, 'test.md', [0.1, 0.2, 0.3], 'test-model');
  const result = getEmbedding(db, 'test.md');
  
  expect(result!.vector).toHaveLength(3);  // <-- Only checks length!
  // Missing: expect(result!.vector[0]).toBeCloseTo(0.1, 5);
});
```

**Fix:** Add value assertions:
```typescript
expect(result!.vector[0]).toBeCloseTo(0.1, 5);
expect(result!.vector[1]).toBeCloseTo(0.2, 5);
expect(result!.vector[2]).toBeCloseTo(0.3, 5);
```

**Verification:** Temporarily corrupt the implementation (return `[0,0,0]`) and confirm original test still passes. Fixed test would fail.

---

### [LOW] Negative Values Untested

**Location:** `tests/unit/docstore/cache/embeddings.test.ts` (missing test)

**Problem:** All test vectors use positive values `[0.1, 0.2, 0.3]`. Real embeddings contain negative values. Float32 encoding of negatives is tested implicitly by line 95's `toBeCloseTo`, but not explicitly.

**Evidence:**
```typescript
// All test vectors are positive
const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
const original = [0.1, 0.2, 0.3, 0.4, 0.5];
```

**Fix:** Add test with mixed values:
```typescript
it('preserves negative values', () => {
  const original = [-0.5, 0, 0.5, -1.0, 1.0];
  storeEmbedding(db, 'test.md', original, 'model');
  const result = getEmbedding(db, 'test.md');
  result!.vector.forEach((v, i) => {
    expect(v).toBeCloseTo(original[i], 5);
  });
});
```

**Verification:** Implementation likely works, but test makes this explicit.

---

### [LOW] High-Dimension Vector Untested

**Location:** `tests/unit/docstore/cache/embeddings.test.ts` (missing test)

**Problem:** Tests use 3-5 element vectors. Real embeddings are 384-1536+ dimensions. Buffer allocation at scale is untested.

**Evidence:**
```typescript
// Largest test vector: 5 elements (20 bytes)
const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
// Real embedding: 1536 elements (6144 bytes)
```

**Fix:** Add scale test:
```typescript
it('handles high-dimension vectors (1536)', () => {
  const original = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  storeEmbedding(db, 'test.md', original, 'ada-002');
  const result = getEmbedding(db, 'test.md');
  expect(result!.vector).toHaveLength(1536);
  // Spot-check a few values
  expect(result!.vector[0]).toBeCloseTo(original[0], 5);
  expect(result!.vector[1535]).toBeCloseTo(original[1535], 5);
});
```

**Verification:** Run test, confirm no buffer allocation issues.

---

### [ALREADY TRACKED] Empty Vector Edge Case

**Location:** Documented in `docs/issues/embeddings-empty-vector-untested.md`

Not duplicating here.

## Related Issues

- [[embeddings-empty-vector-untested]] - Empty vector case
- [[cache-test-gaps]] - Other cache layer gaps
- [[vector-provider-edge-cases]] - Similar gaps in vector provider

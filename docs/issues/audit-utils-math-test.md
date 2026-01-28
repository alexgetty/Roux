---
tags:
  - test-audit
  - utils
status: open
title: audit-utils-math-test
---

# Test Audit: utils/math.test.ts

## Summary

The test file covers basic happy paths and zero-vector edge cases, but has significant gaps around dimension mismatches, empty vectors, very large dimensions, numerical edge cases, and the internal `isZeroVector` function which is untested.

## Findings

### [HIGH] Dimension Mismatch Behavior Untested

**Location:** `src/utils/math.ts:13-17`

**Problem:** The loop iterates based on `a.length` only. When vectors have different lengths, the function accesses out-of-bounds indices on the shorter vector, producing `undefined * number = NaN`. This corrupts the result silently.

**Evidence:**
```typescript
// src/utils/math.ts:13
for (let i = 0; i < a.length; i++) {
  dotProduct += a[i]! * b[i]!;  // b[i] is undefined when i >= b.length
```

No test verifies behavior when `a.length !== b.length`. Real-world embedding dimension mismatches (e.g., mixing 384-dim and 768-dim models) would silently produce garbage results.

**Fix:** Add tests for:
1. `cosineSimilarity([1,2,3], [1,2])` - second vector shorter
2. `cosineSimilarity([1,2], [1,2,3])` - first vector shorter
3. Decide: should implementation throw, or use min length?

**Verification:** Test should either assert thrown error or documented fallback behavior.

---

### [HIGH] Empty Vector Behavior Untested

**Location:** `src/utils/math.ts:8-22`

**Problem:** Empty vectors `[]` are not tested. With `a.length = 0`, the loop never executes, `normA` and `normB` remain 0, and the function returns 0. This is semantically different from zero vectors `[0,0,0]` but produces the same result.

**Evidence:**
```typescript
// No test for:
cosineSimilarity([], [])      // returns 0
cosineSimilarity([], [1,2,3]) // returns 0
cosineSimilarity([1,2,3], []) // returns 0 (via NaN path actually)
```

The third case (`[1,2,3], []`) hits the dimension mismatch bug - it returns `NaN`, not 0.

**Fix:** Add explicit tests for empty vector inputs and document expected behavior.

**Verification:** Tests pass and behavior matches documentation.

---

### [MEDIUM] isZeroVector Helper Function Untested

**Location:** `src/utils/math.ts:37-42`

**Problem:** The `isZeroVector` function is a private helper but its correctness is critical to `cosineDistance`'s zero-vector handling. It's only tested indirectly.

**Evidence:**
```typescript
// src/utils/math.ts:37-42
function isZeroVector(v: VectorLike): boolean {
  for (let i = 0; i < v.length; i++) {
    if (v[i] !== 0) return false;
  }
  return true;
}
```

Edge cases not exercised:
- `isZeroVector([])` - empty array (returns `true` - loop never runs)
- `isZeroVector([0.0, -0.0])` - negative zero (`-0 === 0` is true, so works)
- `isZeroVector([1e-300])` - near-zero but not zero

**Fix:** Export `isZeroVector` for testing, or add integration tests that exercise these paths through `cosineDistance`.

**Verification:** Add test: `cosineDistance([1e-300, 0], [1,0])` to confirm near-zero vectors are NOT treated as zero vectors.

---

### [MEDIUM] Numerical Stability with Extreme Values Untested

**Location:** `src/utils/math.ts:9-21`

**Problem:** No tests for numerical edge cases that occur in production embeddings.

**Evidence:** Missing tests for:
```typescript
// Very small values (denormalized floats)
cosineSimilarity([1e-300, 1e-300], [1e-300, 1e-300])

// Very large values (overflow risk)
cosineSimilarity([1e150, 1e150], [1e150, 1e150])  // normA overflows to Infinity

// Mixed scales
cosineSimilarity([1e-300, 1], [1, 1e-300])
```

The large value case causes `normA` to overflow to `Infinity`, making the result `0/Infinity = 0` instead of the expected `1`.

**Fix:** Add tests documenting behavior at numerical boundaries. Consider if implementation should normalize vectors first for stability.

**Verification:** Run `cosineSimilarity([1e155, 0], [1e155, 0])` - currently returns 0, should return 1.

---

### [MEDIUM] NaN and Infinity Input Behavior Untested

**Location:** `src/utils/math.ts:8-22`

**Problem:** No tests for vectors containing special floating-point values.

**Evidence:**
```typescript
// Not tested:
cosineSimilarity([NaN, 1], [1, 1])       // Returns NaN
cosineSimilarity([Infinity, 0], [1, 0])  // Returns NaN (Infinity * 0)
cosineSimilarity([Infinity, 0], [Infinity, 0])  // Returns NaN (Inf/Inf)
```

These values can arise from upstream bugs (e.g., division by zero in embedding normalization).

**Fix:** Add tests and decide on behavior: throw, return 0, or return NaN (current).

**Verification:** Tests document and assert expected behavior for invalid inputs.

---

### [MEDIUM] cosineDistance Zero Vector Relationship Test is Incomplete

**Location:** `tests/unit/utils/math.test.ts:85-91`

**Problem:** The test "equals 1 - cosineSimilarity for non-zero vectors" only uses one vector pair. The relationship should hold for any non-zero vectors.

**Evidence:**
```typescript
// tests/unit/utils/math.test.ts:85-91
it('equals 1 - cosineSimilarity for non-zero vectors', () => {
  const a = [1, 2, 3];
  const b = [4, 5, 6];
  // ... only one example
});
```

Missing test that this invariant holds when similarity is negative (opposite vectors).

**Fix:** Add test: `const a = [1,0]; const b = [-1,0];` where similarity = -1, distance = 2.

**Verification:** Test passes, confirming relationship holds across full similarity range.

---

### [LOW] cosineDistance Both-Zero-Vector Case Missing

**Location:** `tests/unit/utils/math.test.ts:54-97`

**Problem:** Tests cover first-zero and second-zero, but not both-zero case for `cosineDistance`.

**Evidence:**
```typescript
// Missing:
it('returns 1 when both vectors are zero', () => {
  expect(cosineDistance([0,0,0], [0,0,0])).toBe(1);
});
```

The `cosineSimilarity` tests have this case (line 41-45), but `cosineDistance` tests don't.

**Fix:** Add the missing both-zero test for completeness.

**Verification:** Test passes (implementation already handles this correctly).

---

### [LOW] Float32Array Cross-Type Test Missing

**Location:** `tests/unit/utils/math.test.ts:47-51, 93-97`

**Problem:** Tests verify Float32Array works with Float32Array, but not mixed types (Float32Array with regular Array).

**Evidence:**
```typescript
// Missing cross-type test:
it('works with mixed array types', () => {
  const a = new Float32Array([1, 2, 3]);
  const b = [1, 2, 3];  // Regular array
  expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
});
```

The implementation uses `ArrayLike<number>` which should support mixing, but this isn't verified.

**Fix:** Add cross-type tests for both functions.

**Verification:** Tests pass confirming interoperability.

---

### [LOW] Precision Tolerance Inconsistency

**Location:** `tests/unit/utils/math.test.ts` throughout

**Problem:** Tests use `toBeCloseTo(x, 10)` for regular arrays but `toBeCloseTo(x, 5)` for Float32Array. The inconsistency suggests uncertainty about actual precision guarantees.

**Evidence:**
```typescript
// Line 8 - regular array
expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);

// Line 50 - Float32Array
expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
```

**Fix:** Document why Float32Array has lower precision, or standardize tolerances.

**Verification:** Review and document expected precision per type.

---

## Summary Table

| Severity | Count | Key Issue |
|----------|-------|-----------|
| HIGH | 2 | Dimension mismatch and empty vectors silently corrupt results |
| MEDIUM | 4 | Numerical edge cases, NaN/Infinity, untested helper function |
| LOW | 3 | Minor coverage gaps and inconsistent tolerances |

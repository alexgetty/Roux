---
title: audit-cache-embeddings-test
tags:
  - test-audit
  - docstore
  - cache
---
# Test Audit: cache/embeddings.test.ts

> **Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-weak-assertions]]

## Summary

The embeddings cache tests cover happy paths but miss important edge cases around Float32 precision limits, error handling, and foreign key constraints.

## Findings

### [MEDIUM] Foreign Key Constraint Violation Untested

**Problem:** No test verifies what happens when `storeEmbedding` is called for a non-existent node.

---

### [MEDIUM] Special Float Values Not Tested (NaN, Infinity)

**Problem:** Embeddings should never contain NaN or Infinity, but if they do, they're silently stored and retrieved.

---

### [LOW] Weak Assertion on Round-Trip Test

**Problem:** Test only checks `toHaveLength(3)`, not that values survived the round-trip.

**Fix:** Add value assertions with `toBeCloseTo()`.

---

### [LOW] Negative Values Untested

**Problem:** All test vectors use positive values. Real embeddings contain negative values.

---

### [LOW] High-Dimension Vector Untested

**Problem:** Tests use 3-5 element vectors. Real embeddings are 384-1536+ dimensions.

## Related Issues

- [[embeddings-empty-vector-untested]]
- [[cache-test-gaps]]
- [[vector-provider-edge-cases]]

---
id: qymkQbHYsY3d
title: audit-utils-heap-test
tags:
  - test-audit
  - utils
status: open
---
# Test Audit: utils/heap.test.ts

> **Consolidated into:** [[consolidated-boundary-conditions]]

## Summary

The MinHeap tests cover basic operations and a good top-k usage pattern, but miss several edge cases around duplicate values, comparator edge behavior, and structural verification.

## Findings

### [MEDIUM] Duplicate values not tested

**Problem:** No test inserts duplicate values. The heap should maintain heap property when duplicates exist.

---

### [MEDIUM] Comparator returning zero (equal elements) behavior untested

**Problem:** The `bubbleUp` method uses `>= 0` to determine when to stop. Equal elements don't swap upward, but this behavior isn't tested.

---

### [LOW] toArray mutation isolation untested

**Problem:** Test verifies heap state after `toArray()`, but doesn't verify the returned array is a true copy.

---

### [LOW] Negative numbers not tested

**Problem:** All numeric test values are non-negative.

---

### [LOW] Interleaved push/pop operations untested

**Problem:** Tests either push multiple values then pop, but never interleave operations.

---

### [LOW] bubbleDown with only left child not explicitly verified

**Problem:** Specific path through bubbleDown where `rightChild >= length` is not explicitly tested.

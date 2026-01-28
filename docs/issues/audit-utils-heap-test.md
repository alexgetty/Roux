---
tags:
  - test-audit
  - utils
status: open
title: audit-utils-heap-test
---

# Test Audit: utils/heap.test.ts

## Summary

The MinHeap tests cover basic operations and a good top-k usage pattern, but miss several edge cases around duplicate values, comparator edge behavior, and structural verification. The implementation handles these cases, but correctness is not verified by tests.

## Findings

### [MEDIUM] Duplicate values not tested

**Location:** `tests/unit/utils/heap.test.ts` - entire file
**Problem:** No test inserts duplicate values. The heap should maintain heap property when duplicates exist, but this is unverified.
**Evidence:** All test values are unique:
```typescript
// Line 50
const values = [10, 4, 15, 20, 0, 8, 2];
// Line 84-86
const items: Array<[string, number]> = [
  ['a', 10], ['b', 5], ['c', 20], ['d', 15], ['e', 3], ['f', 25]
];
```
**Fix:** Add test case inserting duplicate values and verifying correct extraction order (all duplicates should be extracted before larger values).
```typescript
it('handles duplicate values', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  heap.push(5);
  heap.push(3);
  heap.push(3);
  heap.push(5);
  heap.push(1);
  
  const extracted: number[] = [];
  while (heap.size() > 0) {
    extracted.push(heap.pop()!);
  }
  expect(extracted).toEqual([1, 3, 3, 5, 5]);
});
```
**Verification:** Test passes and coverage report shows bubbleUp/bubbleDown paths exercised with equal comparisons.

### [MEDIUM] Comparator returning zero (equal elements) behavior untested

**Location:** `src/utils/heap.ts:45`
**Problem:** The `bubbleUp` method uses `>= 0` to determine when to stop bubbling:
```typescript
if (this.compare(this.data[index]!, this.data[parentIndex]!) >= 0) {
  break;
}
```
This means equal elements don't swap upward, which is correct for stability, but this behavior is never tested.
**Evidence:** No test verifies that elements with equal comparison results maintain insertion order or any specific ordering.
**Fix:** Add test that inserts elements with equal comparison results and verifies they're handled correctly.
```typescript
it('does not bubble up equal elements', () => {
  const heap = new MinHeap<{id: string, priority: number}>(
    (a, b) => a.priority - b.priority
  );
  heap.push({id: 'first', priority: 5});
  heap.push({id: 'second', priority: 5});
  
  // First one pushed should not be displaced by equal priority
  expect(heap.peek()?.id).toBe('first');
});
```
**Verification:** Test passes, demonstrating stable ordering for equal elements.

### [LOW] toArray mutation isolation untested

**Location:** `tests/unit/utils/heap.test.ts:119-126`
**Problem:** Test verifies heap state after `toArray()`, but doesn't verify the returned array is a true copy that can be mutated without affecting the heap.
**Evidence:**
```typescript
it('does not modify heap', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  heap.push(5);
  heap.push(3);
  heap.toArray();
  expect(heap.size()).toBe(2);
  expect(heap.peek()).toBe(3);
});
```
The test calls `toArray()` but doesn't even capture the result.
**Fix:** Verify the returned array can be mutated without affecting heap internals:
```typescript
it('returns a copy that can be mutated independently', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  heap.push(5);
  heap.push(3);
  const arr = heap.toArray();
  arr.push(999);
  arr[0] = -1;
  
  expect(heap.size()).toBe(2);
  expect(heap.toArray()).not.toContain(999);
  expect(heap.toArray()).not.toContain(-1);
});
```
**Verification:** Test passes, confirming spread operator in `toArray()` creates independent copy.

### [LOW] Negative numbers not tested

**Location:** `tests/unit/utils/heap.test.ts` - entire file
**Problem:** All numeric test values are non-negative. While the comparator should handle negatives correctly, this is unverified.
**Evidence:** Values used: `[10, 4, 15, 20, 0, 8, 2]`, `[5, 3, 7]`
**Fix:** Add test with negative values:
```typescript
it('handles negative values correctly', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  heap.push(-5);
  heap.push(0);
  heap.push(-10);
  heap.push(3);
  
  expect(heap.pop()).toBe(-10);
  expect(heap.pop()).toBe(-5);
  expect(heap.pop()).toBe(0);
  expect(heap.pop()).toBe(3);
});
```
**Verification:** Test passes with correct ordering.

### [LOW] Interleaved push/pop operations untested

**Location:** `tests/unit/utils/heap.test.ts`
**Problem:** Tests either push multiple values then pop multiple values, but never interleave operations. Real usage (like streaming top-k) alternates between push and pop.
**Evidence:** The top-k test at line 81-105 does interleave, but only with the pattern "check size, maybe pop+push". No test does arbitrary interleaving like push-push-pop-push-pop-pop.
**Fix:** Add explicit interleaved test:
```typescript
it('maintains heap property with interleaved push/pop', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  heap.push(10);
  heap.push(5);
  expect(heap.pop()).toBe(5);  // [10]
  heap.push(3);
  heap.push(15);
  expect(heap.pop()).toBe(3);  // [10, 15]
  expect(heap.pop()).toBe(10); // [15]
  heap.push(1);
  expect(heap.pop()).toBe(1);  // [15]
  expect(heap.pop()).toBe(15); // []
});
```
**Verification:** Test passes, heap property maintained through arbitrary operation sequence.

### [LOW] bubbleDown with only left child not explicitly verified

**Location:** `src/utils/heap.ts:56-62`
**Problem:** When a heap has 2 elements and we call pop, the resulting heap has 1 element. When a heap has 3 elements and we pop, the resulting heap has 2 elements (root + left child only, no right child). This specific path through bubbleDown where `rightChild >= length` is not explicitly tested.
**Evidence:** The code handles this:
```typescript
if (leftChild < length && this.compare(this.data[leftChild]!, this.data[smallest]!) < 0) {
  smallest = leftChild;
}
if (rightChild < length && this.compare(this.data[rightChild]!, this.data[smallest]!) < 0) {
  smallest = rightChild;
}
```
But tests extract entire heap, so this path is exercised implicitly but not verified.
**Fix:** Add explicit test for the partial tree case:
```typescript
it('bubbleDown works when only left child exists', () => {
  const heap = new MinHeap<number>((a, b) => a - b);
  // Build heap where after pop, root must bubble down with only left child
  heap.push(1);
  heap.push(3);
  heap.push(2);
  // Internal: [1, 3, 2] - complete tree
  
  heap.pop(); // Remove 1, move 2 to root, bubbleDown
  // 2 vs 3: 2 is smaller, no swap needed
  // Internal: [2, 3]
  
  expect(heap.peek()).toBe(2);
  expect(heap.pop()).toBe(2);
  expect(heap.pop()).toBe(3);
});
```
**Verification:** Test passes, demonstrating left-child-only bubbleDown works correctly.

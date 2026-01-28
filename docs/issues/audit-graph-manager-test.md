---
tags:
  - test-audit
  - graph
status: open
title: audit-graph-manager-test
---

# Test Audit: graph/manager.test.ts

## Summary

The manager tests verify the delegation pattern works but miss edge cases in input validation, error handling, and behavioral boundaries. Several assertions are weak or incomplete.

## Findings

### [HIGH] Empty nodes array not tested

**Location:** `manager.test.ts` - `describe('build')` block (lines 25-49)
**Problem:** No test verifies behavior when `build([])` is called with an empty array. The implementation calls `buildGraph([])` and `computeCentrality(graph)` - does this work? Does `isReady()` become true?
**Evidence:**
```typescript
// All tests use testNodes (5 nodes)
const testNodes = [
  createTestNode('a', ['b', 'd']),
  // ...
];
```
**Fix:** Add test:
```typescript
it('handles empty nodes array', () => {
  const metrics = manager.build([]);
  expect(metrics.size).toBe(0);
  expect(manager.isReady()).toBe(true); // or false? Document expected behavior
});
```
**Verification:** Test passes and documents empty array behavior.

### [HIGH] Rebuilding graph not tested

**Location:** `manager.test.ts` - `describe('build')` (lines 25-49)
**Problem:** Calling `build()` multiple times is untested. Does it replace the old graph? Does it throw? Memory leak?
**Evidence:** Implementation simply overwrites `this.graph`:
```typescript
// src/graph/manager.ts:19-21
build(nodes: Node[]): Map<string, CentralityMetrics> {
  this.graph = buildGraph(nodes);
  return computeCentrality(this.graph);
}
```
**Fix:** Add test:
```typescript
it('replaces previous graph on rebuild', () => {
  manager.build([createTestNode('x', [])]);
  expect(manager.isReady()).toBe(true);
  
  manager.build(testNodes);
  expect(manager.assertReady().order).toBe(5);
  expect(manager.assertReady().hasNode('x')).toBe(false);
});
```
**Verification:** Test confirms old graph is replaced, not merged.

### [MEDIUM] getNeighborIds 'both' direction not tested

**Location:** `manager.test.ts:108-127` - `describe('getNeighborIds')`
**Problem:** Only `direction: 'out'` and `direction: 'in'` are tested. The `'both'` direction is untested at manager level.
**Evidence:**
```typescript
it('delegates to traversal function with correct args', () => {
  const result = manager.getNeighborIds('a', { direction: 'out' });
  // ...
});

it('returns incoming neighbors', () => {
  const result = manager.getNeighborIds('e', { direction: 'in' });
  // ...
});
// No test for direction: 'both'
```
**Fix:** Add test:
```typescript
it('returns both incoming and outgoing neighbors', () => {
  const result = manager.getNeighborIds('b', { direction: 'both' });
  expect(result.sort()).toEqual(['a', 'c', 'e']); // a→b and b→c, b→e
});
```
**Verification:** Test covers all three Direction enum values.

### [MEDIUM] getNeighborIds for non-existent node not tested

**Location:** `manager.test.ts:108-127`
**Problem:** No test verifies behavior when querying neighbors of a node that doesn't exist.
**Evidence:** Implementation in `traversal.ts:15-17`:
```typescript
if (!graph.hasNode(id)) {
  return [];
}
```
**Fix:** Add test:
```typescript
it('returns empty array for non-existent node', () => {
  const result = manager.getNeighborIds('nonexistent', { direction: 'out' });
  expect(result).toEqual([]);
});
```
**Verification:** Manager correctly delegates and returns empty array.

### [MEDIUM] getNeighborIds limit=0 not tested

**Location:** `manager.test.ts:123-126`
**Problem:** Only `limit: 1` is tested. Edge case `limit: 0` is untested.
**Evidence:**
```typescript
it('respects limit option', () => {
  const result = manager.getNeighborIds('a', { direction: 'out', limit: 1 });
  expect(result).toHaveLength(1);
});
```
Implementation in `traversal.ts:34-36`:
```typescript
if (options.limit <= 0) {
  return [];
}
```
**Fix:** Add test:
```typescript
it('returns empty array when limit is 0', () => {
  const result = manager.getNeighborIds('a', { direction: 'out', limit: 0 });
  expect(result).toEqual([]);
});
```
**Verification:** Boundary condition at limit=0 is covered.

### [MEDIUM] findPath for non-existent nodes not tested

**Location:** `manager.test.ts:129-148`
**Problem:** Tests cover no-path-exists and same-node cases, but not when source or target don't exist.
**Evidence:** Implementation in `traversal.ts:54-56`:
```typescript
if (!graph.hasNode(source) || !graph.hasNode(target)) {
  return null;
}
```
**Fix:** Add tests:
```typescript
it('returns null when source does not exist', () => {
  expect(manager.findPath('nonexistent', 'a')).toBeNull();
});

it('returns null when target does not exist', () => {
  expect(manager.findPath('a', 'nonexistent')).toBeNull();
});
```
**Verification:** Both branches of the hasNode check are covered.

### [MEDIUM] getHubs with limit=0 not tested

**Location:** `manager.test.ts:150-170`
**Problem:** Tests verify limit truncation but not the edge case of `limit: 0`.
**Evidence:** Implementation in `traversal.ts:76-78`:
```typescript
if (limit <= 0) {
  return [];
}
```
**Fix:** Add test:
```typescript
it('returns empty array when limit is 0', () => {
  const hubs = manager.getHubs('in_degree', 0);
  expect(hubs).toEqual([]);
});
```
**Verification:** Boundary condition documented and tested.

### [MEDIUM] getHubs with limit > graph size not tested

**Location:** `manager.test.ts:150-170`
**Problem:** No test verifies behavior when limit exceeds the number of nodes.
**Evidence:** Implementation uses heap with limit, but behavior when limit > n isn't explicitly tested.
**Fix:** Add test:
```typescript
it('returns all nodes when limit exceeds graph size', () => {
  const hubs = manager.getHubs('in_degree', 100);
  expect(hubs).toHaveLength(5); // Only 5 nodes in test graph
});
```
**Verification:** Confirms heap returns all available nodes without error.

### [LOW] Weak assertion on assertReady return value

**Location:** `manager.test.ts:68-74`
**Problem:** Test only checks `graph.order`, doesn't verify it's actually the DirectedGraph instance.
**Evidence:**
```typescript
it('returns graph when built', () => {
  manager.build(testNodes);
  const graph = manager.assertReady();

  expect(graph).toBeDefined();
  expect(graph.order).toBe(5); // 5 nodes
});
```
**Fix:** Strengthen assertion:
```typescript
it('returns graph when built', () => {
  manager.build(testNodes);
  const graph = manager.assertReady();

  expect(graph).toBeInstanceOf(DirectedGraph);
  expect(graph.order).toBe(5);
  expect(graph.size).toBe(5); // 5 edges in test graph
});
```
**Verification:** Verifies returned object is actually a DirectedGraph.

### [LOW] getCentrality is not exposed or tested

**Location:** N/A
**Problem:** `computeCentrality` is called in `build()` but the centrality Map is only returned, not stored. If caller loses the Map, they must rebuild. Is this intentional?
**Evidence:**
```typescript
// manager.ts
build(nodes: Node[]): Map<string, CentralityMetrics> {
  this.graph = buildGraph(nodes);
  return computeCentrality(this.graph); // Not stored
}
```
**Fix:** Not a test gap per se, but worth documenting whether this is intentional (caller must store) or a missing `getCentrality()` method.
**Verification:** Document design decision or add method if missing.

### [LOW] Negative limit handling inconsistent between methods

**Location:** Tests at lines 123-126, 166-168
**Problem:** Tests only verify positive limits. Implementation handles negative limits same as 0, but this is untested.
**Evidence:**
```typescript
// traversal.ts:34
if (options.limit <= 0) { return []; }

// traversal.ts:76
if (limit <= 0) { return []; }
```
**Fix:** Add tests for negative limits if this behavior should be documented:
```typescript
it('treats negative limit as empty result', () => {
  expect(manager.getNeighborIds('a', { direction: 'out', limit: -1 })).toEqual([]);
  expect(manager.getHubs('in_degree', -5)).toEqual([]);
});
```
**Verification:** Negative limit behavior is explicitly documented.

## References

- [[Graph Test Coverage]] - Related known issue with additional coverage gaps
- `src/graph/manager.ts` - Implementation under test
- `src/graph/traversal.ts` - Delegated traversal functions

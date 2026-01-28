---
tags:
  - test-audit
  - graph
status: open
title: audit-graph-traversal-test
---

# Test Audit: graph/traversal.test.ts

## Summary

The traversal tests cover basic happy paths well but miss critical edge cases around graph topology (self-loops, isolated nodes, disconnected components), determinism of results, and incomplete verification of algorithm correctness.

## Findings

### [HIGH] Self-loop behavior untested

**Location:** `tests/unit/graph/traversal.test.ts` - entire file
**Problem:** No tests verify behavior when a node links to itself. Self-loops affect neighbor counts, path finding, and hub calculations in potentially unexpected ways.
**Evidence:** The test graph in `fixtures.ts:27-39` has no self-loops. The `createTestGraph()` function only creates edges between distinct nodes:
```typescript
graph.addDirectedEdge('a', 'b');
graph.addDirectedEdge('a', 'd');
graph.addDirectedEdge('b', 'c');
graph.addDirectedEdge('b', 'e');
graph.addDirectedEdge('d', 'e');
```
**Fix:** Add tests with self-loops to verify:
- `getNeighborIds(graph, 'x', { direction: 'out' })` includes 'x' when x->x exists
- `getNeighborIds(graph, 'x', { direction: 'both' })` doesn't duplicate the self-loop node
- `findPath(graph, 'x', 'x')` returns `['x']` even when x->x edge exists (not `['x', 'x']`)
- `getHubs` correctly counts self-loops in degree calculations
**Verification:** Add self-loop edge to test graph, run tests, verify expected behavior documented

### [HIGH] getHubs tie-breaking behavior unverified

**Location:** `tests/unit/graph/traversal.test.ts:116-125`
**Problem:** When multiple nodes have the same degree, the test doesn't verify consistent/deterministic ordering. Line 119 just checks "some node with in_degree 1" exists:
```typescript
expect(hubs[1][1]).toBe(1); // b, c, or d (all have in_degree 1)
```
This is a weak assertion that doesn't verify the algorithm is deterministic or documents what tie-breaking behavior to expect.
**Evidence:** The implementation at `src/graph/traversal.ts:80-93` uses a MinHeap. When scores are equal, insertion order determines heap position, which depends on `graph.forEachNode()` iteration order - potentially non-deterministic.
**Fix:** Either:
1. Document and test that ties are broken by insertion order (which may be arbitrary)
2. Add secondary sort key (e.g., alphabetical by ID) for determinism
3. Update test to explicitly acknowledge non-determinism by checking all valid permutations
**Verification:** Run test 100 times, verify consistent ordering OR update assertion to accept any valid ordering

### [MEDIUM] findPath doesn't verify actual shortest path

**Location:** `tests/unit/graph/traversal.test.ts:106-112`
**Problem:** Test for "finds shortest path when multiple exist" only checks length and endpoints, not that the path is valid:
```typescript
it('finds shortest path when multiple exist', () => {
  // a -> e via d (2 hops) or via b (2 hops)
  const path = findPath(graph, 'a', 'e');
  expect(path).toHaveLength(3);
  expect(path?.[0]).toBe('a');
  expect(path?.[path.length - 1]).toBe('e');
});
```
A buggy implementation could return `['a', 'c', 'e']` (invalid path - no c->e edge) and pass.
**Fix:** Verify the returned path is actually traversable - each consecutive pair has an edge:
```typescript
expect(path).toHaveLength(3);
for (let i = 0; i < path!.length - 1; i++) {
  expect(graph.hasDirectedEdge(path![i], path![i + 1])).toBe(true);
}
```
**Verification:** Add assertion, verify it catches invalid paths when implementation is intentionally broken

### [MEDIUM] Isolated node behavior untested

**Location:** `tests/unit/graph/traversal.test.ts` - entire file
**Problem:** No test verifies behavior for a node with zero edges (exists in graph but no connections). This is distinct from "node with no neighbors in direction" (line 34-37) which tests a node that has some edges just not in the queried direction.
**Evidence:** Test graph has no isolated nodes. Node 'c' has in_degree 1 (from b), node 'a' has out_degree 2.
**Fix:** Add test with truly isolated node:
```typescript
graph.addNode('isolated');
// getNeighborIds: should return [] for all directions
// findPath: should return null to/from isolated (unless source === target)
// getHubs: isolated node should appear with degree 0
```
**Verification:** Add isolated node to test graph, verify all three functions handle it correctly

### [MEDIUM] Disconnected graph components untested

**Location:** `tests/unit/graph/traversal.test.ts:91-93`
**Problem:** "returns null when no path exists" tests unreachable due to edge direction (c->a), not disconnected components. The test graph is fully connected when ignoring direction.
**Evidence:** 
```typescript
it('returns null when no path exists', () => {
  const path = findPath(graph, 'c', 'a');
  expect(path).toBeNull();
});
```
**Fix:** Add test with truly disconnected subgraphs:
```typescript
it('returns null for disconnected components', () => {
  graph.addNode('x');
  graph.addNode('y');
  graph.addDirectedEdge('x', 'y');
  // No edges connect {a,b,c,d,e} to {x,y}
  expect(findPath(graph, 'a', 'x')).toBeNull();
  expect(findPath(graph, 'x', 'a')).toBeNull();
});
```
**Verification:** Add disconnected component, verify pathfinding correctly returns null

### [MEDIUM] getNeighborIds "both" deduplication untested

**Location:** `tests/unit/graph/traversal.test.ts:29-32`
**Problem:** When a node has both incoming and outgoing edges to the same neighbor, does "both" return duplicates or deduplicated list? Test uses node 'b' which has distinct in/out neighbors:
```typescript
it('returns both directions for direction "both"', () => {
  const result = getNeighborIds(graph, 'b', { direction: 'both' });
  expect(result.sort()).toEqual(['a', 'c', 'e']);
});
```
This passes whether graphology deduplicates or not.
**Evidence:** graphology's `neighbors()` method returns deduplicated results, but this isn't documented or tested here.
**Fix:** Add test with bidirectional edge:
```typescript
it('deduplicates when node is both in and out neighbor', () => {
  graph.addDirectedEdge('b', 'a'); // a->b already exists
  const result = getNeighborIds(graph, 'a', { direction: 'both' });
  // Should return ['b', 'd'] not ['b', 'b', 'd']
  expect(result.filter(n => n === 'b')).toHaveLength(1);
});
```
**Verification:** Add bidirectional edge, verify no duplicates in result

### [LOW] Fractional limit behavior undocumented

**Location:** `tests/unit/graph/traversal.test.ts:44-72`, `src/graph/traversal.ts:33-40`
**Problem:** Tests cover limit: 0, negative, and positive integers. What happens with `limit: 1.5`? JavaScript's slice handles it (truncates to integer), but this isn't tested or documented.
**Evidence:** Implementation uses `neighbors.slice(0, options.limit)` which coerces to integer.
**Fix:** Either:
1. Add validation that rejects non-integer limits
2. Document and test the truncation behavior
**Verification:** Add test with `limit: 2.5`, verify it returns 2 items (or throws if validation added)

### [LOW] Empty graph behavior incomplete

**Location:** `tests/unit/graph/traversal.test.ts:133-137`
**Problem:** Only `getHubs` is tested against empty graph. `getNeighborIds` and `findPath` are not tested on empty graphs (no nodes at all).
**Evidence:**
```typescript
it('returns empty array for empty graph', () => {
  const emptyGraph = new DirectedGraph();
  const hubs = getHubs(emptyGraph, 'in_degree', 5);
  expect(hubs).toEqual([]);
});
```
**Fix:** Add empty graph tests for all functions:
```typescript
describe('empty graph', () => {
  it('getNeighborIds returns [] for any node', () => {
    const empty = new DirectedGraph();
    expect(getNeighborIds(empty, 'any', { direction: 'out' })).toEqual([]);
  });
  
  it('findPath returns null', () => {
    const empty = new DirectedGraph();
    expect(findPath(empty, 'a', 'b')).toBeNull();
  });
});
```
**Verification:** Create empty graph, verify all functions handle gracefully

## Cross-reference

The existing [[Graph Test Coverage]] issue notes self-loop + other links and limit validity, but does not cover:
- Tie-breaking determinism in getHubs
- Path validity verification
- Isolated nodes
- Disconnected components
- "both" deduplication
- Fractional limits
- Empty graph for all functions

This audit is complementary, not duplicative.

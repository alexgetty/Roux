---
tags:
  - test-audit
  - graph
status: open
title: audit-graph-analysis-test
---

# Test Audit: graph/analysis.test.ts

## Summary

The `analysis.test.ts` file tests `computeCentrality` with only 2 test cases covering 31 lines of test code against 21 lines of implementation. Coverage appears complete at line level but misses several graph topology edge cases and lacks assertion depth.

## Findings

### [MEDIUM] Single Graph Topology Tested

**Location:** `tests/unit/graph/analysis.test.ts:10-12`

**Problem:** All positive tests use the same 5-node DAG from `createTestGraph()`. This single topology has specific properties (no cycles, no self-loops, no disconnected components, no isolated nodes) that don't exercise alternative graph structures.

**Evidence:**
```typescript
// Uses standard 5-node test graph from fixtures.ts
beforeEach(() => {
  graph = createTestGraph();
});
```

The fixture creates a DAG:
```
  a -> b -> c
  |    |
  v    v
  d -> e
```

**Fix:** Add test cases for:
1. Graph with self-loop (node links to itself)
2. Graph with cycle (a -> b -> c -> a)
3. Disconnected graph (two separate components)
4. Single isolated node (degree 0 both directions)

**Verification:** Add tests that explicitly verify `inDegree`/`outDegree` for each topology variant.

---

### [MEDIUM] No Test for Single Node Graph

**Location:** `tests/unit/graph/analysis.test.ts:25-29`

**Problem:** Tests cover empty graph and 5-node graph, but skip the minimal non-empty case: a single node with no edges.

**Evidence:**
```typescript
it('returns empty map for empty graph', () => {
  const emptyGraph = new DirectedGraph();
  const centrality = computeCentrality(emptyGraph);
  expect(centrality.size).toBe(0);
});
```

**Fix:** Add test for single-node graph:
```typescript
it('computes zero degrees for isolated node', () => {
  const singleNode = new DirectedGraph();
  singleNode.addNode('lonely');
  const centrality = computeCentrality(singleNode);
  expect(centrality.size).toBe(1);
  expect(centrality.get('lonely')).toEqual({ inDegree: 0, outDegree: 0 });
});
```

**Verification:** Test passes and covers the boundary condition between empty and multi-node.

---

### [MEDIUM] Self-Loop Not Tested

**Location:** `tests/unit/graph/analysis.test.ts:14-23`

**Problem:** A node with a self-loop (edge to itself) is a valid graph configuration. The test doesn't verify whether graphology counts self-loops in both `inDegree` and `outDegree` or neither.

**Evidence:** No test includes `graph.addDirectedEdge('x', 'x')`.

**Fix:** Add explicit test:
```typescript
it('counts self-loop in both in and out degree', () => {
  const selfLoop = new DirectedGraph();
  selfLoop.addNode('x');
  selfLoop.addDirectedEdge('x', 'x');
  const centrality = computeCentrality(selfLoop);
  // Verify graphology's behavior (self-loop counts as both in and out)
  expect(centrality.get('x')).toEqual({ inDegree: 1, outDegree: 1 });
});
```

**Verification:** Test documents the actual behavior; if graphology changes, test will catch it.

---

### [LOW] Map Key Existence Not Verified

**Location:** `tests/unit/graph/analysis.test.ts:15-22`

**Problem:** Tests use `centrality.get('a')` without first asserting that the key exists. If the implementation silently skips a node, `get()` returns `undefined` and `toEqual()` would still fail, but the error message wouldn't indicate which node was missing.

**Evidence:**
```typescript
expect(centrality.get('a')).toEqual({ inDegree: 0, outDegree: 2 });
expect(centrality.get('b')).toEqual({ inDegree: 1, outDegree: 2 });
// ...
```

**Fix:** Add size assertion and/or use `expect(centrality.has('a')).toBe(true)`:
```typescript
expect(centrality.size).toBe(5);
expect(centrality.has('a')).toBe(true);
expect(centrality.get('a')).toEqual({ inDegree: 0, outDegree: 2 });
```

**Verification:** Provides clearer failure message if a node is missing from the result.

---

### [LOW] No Test for Large Graph Performance Characteristics

**Location:** N/A (missing test)

**Problem:** While not a correctness issue, there's no test that verifies behavior at scale. If `computeCentrality` were refactored to use a different algorithm, performance regressions could go unnoticed.

**Evidence:** All tests use graphs with 0-5 nodes.

**Fix:** Consider adding a test with a larger graph (100+ nodes) to catch O(n^2) regressions if the implementation changes:
```typescript
it('handles large graphs efficiently', () => {
  const large = new DirectedGraph();
  for (let i = 0; i < 100; i++) {
    large.addNode(`n${i}`);
    if (i > 0) large.addDirectedEdge(`n${i-1}`, `n${i}`);
  }
  const start = Date.now();
  const result = computeCentrality(large);
  expect(Date.now() - start).toBeLessThan(100); // Should be O(n)
  expect(result.size).toBe(100);
});
```

**Verification:** Test fails if complexity becomes worse than linear.

---

### [LOW] Test Relies on Fixture Without Documenting Expectations

**Location:** `tests/unit/graph/analysis.test.ts:9-12`

**Problem:** The test file comment references `fixtures.ts` but the expected values (e.g., `a` has `outDegree: 2`) are hardcoded in the test. If someone modifies `createTestGraph()`, the test will break with a confusing error.

**Evidence:**
```typescript
// Uses standard 5-node test graph from fixtures.ts
beforeEach(() => {
  graph = createTestGraph();
});
```

Then later:
```typescript
expect(centrality.get('a')).toEqual({ inDegree: 0, outDegree: 2 });
```

The connection between the fixture's structure and the expected values requires reading both files.

**Fix:** Either:
1. Inline the graph creation in the test so expectations are co-located with setup
2. Add a constant in fixtures.ts that exports the expected centrality values
3. Add a more detailed comment documenting the graph structure in the test file

**Verification:** A developer can understand the test without opening `fixtures.ts`.

---

## Summary Table

| Severity | Finding | Effort |
|----------|---------|--------|
| MEDIUM | Single graph topology tested | Low |
| MEDIUM | No single-node graph test | Low |
| MEDIUM | Self-loop not tested | Low |
| LOW | Map key existence not verified | Low |
| LOW | No large graph test | Low |
| LOW | Fixture expectations undocumented | Low |

## References

- [[Graph Test Coverage]] — Related issue with additional graph test gaps
- `src/graph/analysis.ts` — Implementation under test
- `tests/unit/graph/fixtures.ts` — Shared test fixtures

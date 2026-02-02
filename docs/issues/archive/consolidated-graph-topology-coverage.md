---
id: dRQP-MBOK4dG
title: consolidated-graph-topology-coverage
tags:
  - consolidated
  - test-audit
  - graph
  - topology
status: open
priority: high
---
# Consolidated: Graph Topology Coverage Gaps

## Problem Pattern
Graph tests use a single DAG topology with no cycles, self-loops, or disconnected components. Alternative graph structures that could expose edge cases in traversal, path-finding, and centrality calculations are untested.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/graph/analysis.test.ts | Single 5-node DAG tested; no cycles, self-loops, isolated nodes | MEDIUM |
| tests/unit/graph/analysis.test.ts | Single-node graph not tested | MEDIUM |
| tests/unit/graph/analysis.test.ts | Self-loop degree counting untested | MEDIUM |
| tests/unit/graph/traversal.test.ts | Self-loop behavior untested | HIGH |
| tests/unit/graph/traversal.test.ts | Isolated node (zero edges) untested | MEDIUM |
| tests/unit/graph/traversal.test.ts | Disconnected components untested | MEDIUM |
| tests/unit/graph/traversal.test.ts | `getNeighborIds('both')` deduplication untested | MEDIUM |
| tests/unit/graph/traversal.test.ts | `getHubs` tie-breaking non-deterministic | HIGH |
| tests/unit/graph/builder.test.ts | Duplicate node IDs untested | HIGH |
| tests/unit/graph/builder.test.ts | Case sensitivity of node IDs | MEDIUM |
| tests/unit/graph/manager.test.ts | Rebuilding graph (replace vs merge) untested | HIGH |
| tests/unit/graph/manager.test.ts | Non-existent node queries | MEDIUM |

## Root Cause Analysis
The test fixture (`createTestGraph()`) creates a specific DAG:
```
  a -> b -> c
  |    |
  v    v
  d -> e
```
This topology has convenient properties (acyclic, connected, no self-loops) that don't challenge edge cases in:
- BFS/DFS termination with cycles
- Degree calculations with self-loops
- Path-finding in disconnected graphs
- Hub ranking tie-breaking

## Fix Strategy

1. **Create topology test fixtures** in `tests/unit/graph/fixtures.ts`:
   ```typescript
   export function createGraphWithSelfLoop(): DirectedGraph {
     const graph = new DirectedGraph();
     graph.addNode('x');
     graph.addDirectedEdge('x', 'x'); // self-loop
     return graph;
   }
   
   export function createGraphWithCycle(): DirectedGraph {
     const graph = new DirectedGraph();
     ['a', 'b', 'c'].forEach(n => graph.addNode(n));
     graph.addDirectedEdge('a', 'b');
     graph.addDirectedEdge('b', 'c');
     graph.addDirectedEdge('c', 'a'); // creates cycle
     return graph;
   }
   
   export function createDisconnectedGraph(): DirectedGraph {
     const graph = new DirectedGraph();
     ['a', 'b', 'x', 'y'].forEach(n => graph.addNode(n));
     graph.addDirectedEdge('a', 'b'); // component 1
     graph.addDirectedEdge('x', 'y'); // component 2, disconnected
     return graph;
   }
   
   export function createIsolatedNodeGraph(): DirectedGraph {
     const graph = new DirectedGraph();
     graph.addNode('lonely'); // no edges
     return graph;
   }
   ```

2. **Add topology-specific tests**:
   ```typescript
   describe('self-loop handling', () => {
     it('counts self-loop in both in and out degree', () => {
       const graph = createGraphWithSelfLoop();
       const centrality = computeCentrality(graph);
       expect(centrality.get('x')).toEqual({ inDegree: 1, outDegree: 1 });
     });
     
     it('findPath(x, x) returns [x] not [x, x]', () => {
       const graph = createGraphWithSelfLoop();
       const path = findPath(graph, 'x', 'x');
       expect(path).toEqual(['x']);
     });
   });
   
   describe('disconnected graph', () => {
     it('returns null for path between disconnected components', () => {
       const graph = createDisconnectedGraph();
       expect(findPath(graph, 'a', 'x')).toBeNull();
     });
   });
   ```

3. **Document tie-breaking behavior** for `getHubs`:
   ```typescript
   it('uses stable ordering for equal degrees', () => {
     // Run multiple times to verify determinism
     const results = Array.from({ length: 10 }, () => getHubs(graph, 'in_degree', 5));
     expect(new Set(results.map(r => JSON.stringify(r))).size).toBe(1);
   });
   ```

## Verification
1. Add each topology fixture
2. Run existing tests to ensure no regressions
3. Add new tests for each topology variant
4. Verify coverage report shows new code paths exercised

## Source Audits
- [[audit-graph-analysis-test]]
- [[audit-graph-traversal-test]]
- [[audit-graph-builder-test]]
- [[audit-graph-manager-test]]

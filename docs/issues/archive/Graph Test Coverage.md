---
type: Issue
priority: Low
component: Graph
status: open
title: Graph Test Coverage
tags:
  - issue
  - docstore
  - testing
severity: Medium
phase: 5
---

# Graph Test Coverage

Additional test coverage for graph operations edge cases.

## Summary

Polish test coverage for graphology integration. Current tests are solid but not exhaustive.

## Current State

MVP: 202 tests passing, 100% coverage. Core functionality verified.

## Proposed

Additional edge case tests for completeness:

### Self-loop combined with other links

Test a node that links to itself AND other nodes simultaneously. Currently covered implicitly through separate tests but not explicitly validated.

```typescript
it('handles node with self-loop and other outgoing links', () => {
  graph.addDirectedEdge('a', 'a'); // self-loop
  const result = getNeighborIds(graph, 'a', { direction: 'out' });
  expect(result).toContain('a'); // self
  expect(result).toContain('b'); // other
});
```

### Limit returns valid neighbors

Verify that when limit truncates results, the returned neighbors are actually valid neighbors (not random nodes).

```typescript
it('limit returns valid neighbors not arbitrary nodes', () => {
  const result = getNeighborIds(graph, 'a', { direction: 'out', limit: 1 });
  const allNeighbors = getNeighborIds(graph, 'a', { direction: 'out' });
  expect(allNeighbors).toContain(result[0]);
});
```

### Missing barrel export

Add `src/graph/index.ts` barrel export for cleaner imports. Not urgent since graph module is internal to DocStore.

### Duplicate Node IDs in buildGraph

If `buildGraph` receives nodes with duplicate IDs, graphology throws. This can't happen from DocStore (cache enforces unique IDs), but the function is public.

```typescript
it('throws on duplicate node IDs', () => {
  const nodes = [
    createNode({ id: 'same.md' }),
    createNode({ id: 'same.md' }),
  ];
  expect(() => buildGraph(nodes)).toThrow();
});
```

**Decision needed:** Should `buildGraph` deduplicate silently, or is throwing correct?

## Complexity

Low — test additions only, no implementation changes.

## References

- [[DocStore]] — Parent implementation
- [[decisions/Graphology Lifecycle]] — Graph architecture

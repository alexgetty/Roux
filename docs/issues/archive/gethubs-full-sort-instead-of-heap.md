---
title: getHubs Full Sort Instead of Heap
tags:
  - bug
  - performance
  - limit-theater
  - severe
---
# getHubs Full Sort Instead of Heap

## Severity
**SEVERE** — O(n log n) when O(n log k) is achievable.

## Location
- `src/mcp/handlers.ts:215` — Handler accepts limit
- `src/core/graphcore.ts:159-165` — Passes limit to store
- `src/providers/docstore/index.ts:268-271` — Passes to graph operations
- `src/graph/operations.ts:73-103` — **Bug location**

## Problem
The `getHubs` operation iterates every node in the graph, computes degree metrics for all, pushes all to an array, sorts the entire array, then slices to limit.

```typescript
const scores: Array<[string, number]> = [];
graph.forEachNode((id) => {
  const score = metric === 'in_degree' 
    ? graph.inDegree(id) 
    : graph.outDegree(id);
  scores.push([id, score]);
});

scores.sort((a, b) => b[1] - a[1]);
return scores.slice(0, limit);  // <-- POST-SORT TRUNCATION
```

For a 10,000-node graph asking for top 10:
- Computes 10,000 scores
- Allocates array of 10,000 tuples
- Sorts 10,000 items (O(n log n))
- Keeps 10

## Expected Behavior
Use a min-heap to maintain only top-k during iteration. Never materialize full sorted array.

## Suggested Fix
```typescript
import { MinHeap } from './heap'; // or use a library

const heap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);

graph.forEachNode((id) => {
  const score = metric === 'in_degree' 
    ? graph.inDegree(id) 
    : graph.outDegree(id);
  
  if (heap.size() < limit) {
    heap.push([id, score]);
  } else if (score > heap.peek()![1]) {
    heap.pop();
    heap.push([id, score]);
  }
});

return heap.toArray().sort((a, b) => b[1] - a[1]);
```

Complexity: O(n log k) instead of O(n log n)

## Related
- [[Vector Search Loads All Vectors]]
- [[getNeighbors Fetches All Neighbor IDs]]

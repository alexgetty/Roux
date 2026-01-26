---
title: getNeighbors Fetches All Neighbor IDs
tags:
  - bug
  - performance
  - limit-theater
  - medium
---
# getNeighbors Fetches All Neighbor IDs

## Severity
**Medium** — Wastes graph iteration but only handles IDs, not full node data.

## Location
- `src/mcp/handlers.ts:167` — Handler accepts limit
- `src/core/graphcore.ts:149-152` — Passes limit in options
- `src/providers/docstore/index.ts:257-261` — Passes to graph operations
- `src/graph/operations.ts:13-46` — **Bug location**

## Problem
The `getNeighbors` operation fetches all neighbor IDs from the graph, then slices to limit.

```typescript
export function getNeighborIds(
  graph: DirectedGraph,
  id: string,
  options: NeighborOptions
): string[] {
  // ... collect all neighbors based on direction ...
  
  if (options.limit !== undefined) {
    if (options.limit < neighbors.length) {
      return neighbors.slice(0, limit);  // <-- POST-FETCH TRUNCATION
    }
  }
  return neighbors;
}
```

For a node with 5,000 incoming edges asking for 20:
- Retrieves all 5,000 neighbor IDs
- Slices to 20

## Impact
Less severe than other limit-theater bugs because:
- Only IDs are fetched, not full node objects
- Graph neighbor lookup is O(degree) regardless

However, for extremely high-degree nodes (hub nodes in social graphs, etc.), this still wastes memory allocating large arrays that get immediately discarded.

## Suggested Fix
Early-exit iteration with counter:

```typescript
const neighbors: string[] = [];
let count = 0;
const maxCount = options.limit ?? Infinity;

if (direction === 'in' || direction === 'both') {
  for (const pred of graph.inNeighbors(id)) {
    if (count >= maxCount) break;
    neighbors.push(pred);
    count++;
  }
}
// ... similar for out direction
```

## Related
- [[Vector Search Loads All Vectors]]
- [[getHubs Full Sort Instead of Heap]]

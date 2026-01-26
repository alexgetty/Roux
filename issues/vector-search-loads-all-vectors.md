---
title: Vector Search Loads All Vectors
tags:
  - bug
  - performance
  - limit-theater
  - severe
---
# Vector Search Loads All Vectors

## Severity
**SEVERE** — Memory and CPU bomb waiting for real workload.

## Location
- `src/mcp/handlers.ts:101` — Handler accepts limit
- `src/core/graphcore.ts:54-65` — Passes limit to store
- `src/providers/docstore/index.ts:281-286` — Passes to vector provider
- `src/providers/vector/sqlite.ts:60-104` — **Bug location**

## Problem
The `search` operation accepts a `limit` parameter but the SQLite vector provider loads ALL vector blobs from the database, computes cosine distance for every one, sorts the entire array, then slices to limit.

```typescript
const rows = this.db
  .prepare('SELECT id, vector FROM vectors')
  .all();  // <-- LOADS ALL VECTORS

for (const row of rows) {
  const distance = cosineDistance(queryVec, storedVec);
  results.push({ id: row.id, distance });
}

results.sort((a, b) => a.distance - b.distance);
return results.slice(0, limit);  // <-- POST-SORT TRUNCATION
```

For 50,000 embeddings in 768 dimensions asking for 10 results:
- Loads ~150MB of vector data into memory
- Performs 50,000 distance calculations
- Sorts 50,000 results
- Keeps 10

## Expected Behavior
Limit should be applied efficiently at query time, not after loading everything.

## Suggested Fixes
1. **Threshold-based early exit** — Maintain top-k during iteration with a heap, skip vectors that can't beat current worst
2. **sqlite-vec extension** — Use proper vector indexing with ANN (approximate nearest neighbor)
3. **External vector DB** — pgvector, Milvus, Pinecone for production workloads

## Related
- [[getHubs Full Sort Instead of Heap]]
- [[getNeighbors Fetches All Neighbor IDs]]

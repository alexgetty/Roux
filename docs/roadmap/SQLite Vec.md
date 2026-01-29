---
type: Feature
status: Proposed
priority: P2
effort: M
phase: Future
category: Storage & Providers
---

# Feature - sqlite-vec

Native SQLite vector operations via sqlite-vec extension.

## Summary

Replace brute-force similarity search with sqlite-vec for better performance at scale.

## Current State

MVP: Brute-force cosine similarity in JavaScript. O(n) for every search.

## Proposed

Use sqlite-vec extension for native vector indexing:
- HNSW index for approximate nearest neighbor
- Native cosine/euclidean distance functions
- 10-100x faster at scale

## Implementation

```sql
-- Create vector index
CREATE VIRTUAL TABLE vec_embeddings USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);

-- Search
SELECT id, distance
FROM vec_embeddings
WHERE embedding MATCH ?
ORDER BY distance
LIMIT 10;
```

## Tradeoffs

**Pros:**
- Much faster at scale (1000+ nodes)
- Native SQLite, no external dependencies

**Cons:**
- Requires native extension compilation
- Approximate results (configurable accuracy)
- More complex deployment

## Migration Path

StoreProvider interface unchanged. Swap implementation inside DocStore:
- `searchByVector()` calls sqlite-vec instead of JS brute-force
- Transparent to callers

## Complexity

Low — interface stable, implementation swap.

## References

- [[DocStore#Vector Search]] — Current implementation
- [[decisions/Vector Storage]] — Migration path noted
- [[decisions/SQLite Schema]] — Hybrid approach selected

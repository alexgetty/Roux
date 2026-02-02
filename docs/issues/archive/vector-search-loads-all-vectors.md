---
id: m9rRxmmflZZt
title: Vector Search Loads All Vectors
tags:
  - issue
  - vector
  - archived
---
# Vector Search Loads All Vectors — ARCHIVED

> **Status:** Resolved. Refactored to use streaming iteration + bounded heap.

## Original Problem

`SqliteVectorIndex.search()` loaded ALL vectors into memory, computed ALL distances, sorted ALL results, then sliced to limit. For 50k embeddings, this was ~150MB loaded for 10 results.

## Resolution

- Changed `.all()` to `.iterate()` for streaming
- Replaced array + sort + slice with bounded MaxHeap of size `limit`
- Memory complexity: O(n) → O(limit)

## Related

See [[Vector Search Tie-Breaking]] for deferred enhancement on deterministic ordering when distances are equal.

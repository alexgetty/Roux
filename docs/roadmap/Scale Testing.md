---
id: GUU2k_ojGVAp
title: Scale Testing
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: Testing
parent: '[[Testing Framework]]'
---
# Scale Testing

Performance and concurrency testing beyond MVP's <200 node target.

## Performance at Scale

MVP explicitly targets <200 nodes. These tests are deferred:

### searchByTags O(n*m)

`Cache.searchByTags()` iterates all nodes then filters by tags. For large vaults:

```typescript
it('searchByTags with 10k nodes and 100 tags', async () => {
  // Create 10k nodes with random tags
  // Measure query time
  // Assert < 100ms
});
```

**Fix when needed:** SQL LIKE queries or FTS5 full-text search.

### Vector Search Brute Force

`SqliteVectorProvider.search()` loads all vectors into memory and computes cosine distance. O(n) per query.

**Fix when needed:** sqlite-vec extension or dedicated vector DB. See [[sqlite-vec]].

### High-Dimension Embeddings

Current tests use 384-dim (MiniLM). Future providers may use:
- 768 (larger sentence transformers)
- 1536 (OpenAI text-embedding-3-small)
- 3072 (OpenAI text-embedding-3-large)

No functional difference, but memory/performance implications.

## Concurrency

### Concurrent Write Races

`docstore.test.ts:909-920` tests concurrent sync calls. No test for:
- Concurrent `createNode` calls
- `createNode` during `sync`
- Multiple GraphCore instances on same cache

SQLite WAL mode handles atomicity, but higher-level invariants untested.

### File Watcher + Manual Sync

When Phase 8 (File Watcher) lands, what happens if:
- Watcher triggers sync while manual sync is running
- File changes during embedding computation

## When to Address

Phase 11 (Integration & Polish) or post-MVP based on real-world vault sizes.

## References

- [[MVP Implementation Plan]] - <200 node target
- [[sqlite-vec]] - Vector search optimization
- [[decisions/Graphology Lifecycle]] - Graph rebuild strategy

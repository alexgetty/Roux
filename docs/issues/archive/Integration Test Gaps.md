---
id: vQ9KwURKPNlr
title: Integration Test Gaps
tags:
  - issue
  - docstore
  - testing
  - integration
type: Issue
priority: Medium
component: Testing
status: open
severity: High
phase: 7
---
# Integration Test Gaps

Missing integration tests for cross-component flows.

## 1. DocStore → VectorProvider Real Flow

Unit tests mock VectorProvider. One test at `docstore.test.ts:398-432` uses real SqliteVectorProvider, but no integration test for the full search flow:

```
embed(text) → storeEmbedding(id, vector) → searchByVector(query) → return nodes
```

This flow will be orchestrated by GraphCore (Phase 7), but the pieces should be tested together now.

## 2. EmbeddingProvider → VectorProvider Dimension Contract

If `EmbeddingProvider.dimensions()` returns 384 but `embed()` returns 768-dim vectors, there's no validation. Downstream will store wrong-dimension vectors.

The dimension mismatch bug was fixed in SqliteVectorProvider, but nothing validates that EmbeddingProvider is consistent with itself.

## Suggested Integration Tests

Create `tests/integration/search-flow.test.ts`:

```typescript
describe('search flow integration', () => {
  it('embeds, stores, and retrieves via vector search', async () => {
    const embeddingProvider = new TransformersEmbeddingProvider();
    const store = new DocStore(sourceDir, cacheDir);

    // Create a node
    await store.createNode({
      id: 'test.md',
      title: 'Test',
      content: 'Machine learning is fascinating',
      tags: [],
      outgoingLinks: [],
      properties: {},
    });

    // Embed and store
    const embedding = await embeddingProvider.embed('Machine learning');
    await store.storeEmbedding('test.md', embedding, embeddingProvider.modelId());

    // Search
    const queryEmbedding = await embeddingProvider.embed('AI and ML');
    const results = await store.searchByVector(queryEmbedding, 10);

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('test.md');
  });

  it('embedding dimensions match provider.dimensions()', async () => {
    const provider = new TransformersEmbeddingProvider();
    const embedding = await provider.embed('test');

    expect(embedding.length).toBe(provider.dimensions());
  });
});
```

## References

- `tests/unit/docstore/docstore.test.ts:684-758` (VectorProvider delegation)
- `tests/unit/embedding/transformers.test.ts`
- `docs/MVP Implementation Plan.md` Phase 7 (GraphCore orchestration)

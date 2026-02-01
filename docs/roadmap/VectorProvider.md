---
title: Vectorprovider
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: L
phase: Future
category: Storage & Providers
---
# Feature - VectorProvider

External vector store delegation for industrial-scale search.

## Summary

Allow StoreProvider to delegate `searchByVector()` to specialized vector databases.

## Current State

MVP: Vectors stored in SQLite, brute-force similarity search in application code.

## Use Cases

- **Scale:** 100K+ vectors exceed SQLite brute-force performance
- **Specialized stores:** Pinecone, Weaviate, Qdrant optimized for vector ops
- **Hybrid:** DocStore for documents + Pinecone for vectors

## Proposed

Optional VectorProvider interface:
```typescript
interface VectorProvider {
  store(id: string, vector: number[]): Promise<void>;
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
}
```

StoreProvider configuration:
```yaml
providers:
  store:
    type: docstore
    vectorDelegate: pinecone  # Override vector storage
  vector:
    type: pinecone
    apiKey: ${PINECONE_API_KEY}
    index: roux-vectors
```

## Implementation

- StoreProvider checks for vectorDelegate config
- If set, routes `storeEmbedding`/`searchByVector` to VectorProvider
- Fallback to internal storage if not configured

## Complexity

Low-Medium — interface exists, need delegation logic.

## References

- [[decisions/Vector Storage]] — Architecture decision
- [[StoreProvider#Vector Search]] — Current interface

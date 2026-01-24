# VectorProvider

Vector storage and similarity search.

## Overview

VectorProvider handles persistence and retrieval of embedding vectors. It's the storage counterpart to [[EmbeddingProvider]] (which generates vectors).

```
text → [EmbeddingProvider] → vector → [VectorProvider] → storage/search
```

## Interface

```typescript
interface VectorProvider {
  store(id: string, vector: number[], model: string): Promise<void>;
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  getModel(id: string): Promise<string | null>;
}

interface VectorSearchResult {
  id: string;
  distance: number;  // Lower = more similar (cosine distance)
}
```

## Methods

### store(id, vector, model)

Persist a vector with its associated node ID and model identifier.

- `id`: Node identifier
- `vector`: Float32 array from EmbeddingProvider
- `model`: Model that generated this vector (for cache invalidation)

**Design note:** `store()` does not validate that the node ID exists in the store. This is intentional—GraphCore calls `store()` after creating the node and generating the embedding. Adding existence checks would require a cache lookup on every embed operation. Orphan embeddings (vectors without corresponding nodes) are cleaned up when `delete()` is called or during full re-sync.

### search(vector, limit)

Find the most similar vectors to a query vector.

- `vector`: Query vector (same dimensions as stored vectors)
- `limit`: Maximum results to return
- Returns: Array of `{ id, distance }` sorted by distance ascending

### delete(id)

Remove a vector from storage. Called when a node is deleted.

### getModel(id)

Get the model identifier for a stored vector. Used to detect when embeddings need regeneration after model changes.

## Implementations

### SqliteVectorProvider (MVP Default)

Brute-force cosine similarity in SQLite. No external dependencies.

- Vectors stored as BLOB (Float32Array)
- Search scans all vectors, computes cosine distance
- Sufficient for hundreds to low thousands of nodes

### Future Implementations

| Provider | Use Case |
|----------|----------|
| PineconeVectorProvider | Cloud-scale, millions of vectors |
| QdrantVectorProvider | Self-hosted, high performance |
| Native store providers | Neo4j/SurrealDB with built-in vector indexes |

## Configuration

```yaml
# Implicit: uses SqliteVectorProvider
providers:
  store:
    type: docstore

# Explicit: use Pinecone
providers:
  store:
    type: docstore
  vector:
    type: pinecone
    apiKey: xxx
    index: my-index
```

## Storage Format

Vectors stored as Float32Array (not Float64):
- Matches EmbeddingProvider output format
- Half the memory footprint
- No practical precision loss for similarity search

## Relationship to StoreProvider

StoreProvider exposes convenience methods that delegate to VectorProvider:

```typescript
interface StoreProvider {
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]>;
}
```

DocStore injects a VectorProvider and delegates these calls. This keeps the StoreProvider interface simple while allowing vector implementation to vary.

## Validation

SqliteVectorProvider enforces:
- **Non-empty vectors**: `store()` and `search()` reject empty arrays
- **Finite values**: `store()` rejects NaN or Infinity in vectors
- **Dimension consistency**: `search()` throws if query dimensions don't match stored vectors

## Known Limitations (SqliteVectorProvider)

### Performance Cliff at Scale

SqliteVectorProvider uses brute-force search: every `search()` call loads all vectors into memory and computes cosine distance against each one.

| Vector Count | Memory per Search | Suitability |
|--------------|-------------------|-------------|
| 100 | ~150KB | Excellent |
| 1,000 | ~1.5MB | Good |
| 10,000 | ~15MB | Marginal |
| 100,000 | ~150MB | Unacceptable |

**MVP target is <200 nodes.** For larger vaults, switch to PineconeVectorProvider or a native store with vector indexes.

### No Approximate Nearest Neighbor

Brute-force is O(n) per query. No indexing, no HNSW, no IVF. This is intentional for MVP simplicity. Future VectorProvider implementations will use proper ANN algorithms.

### Single-Dimension Assumption

All vectors in a store must have the same dimensions. Mixing 384-dim and 768-dim vectors will throw on search. This is validated at search time, not store time (to allow lazy migration).

## Related

- [[decisions/Vector Storage]] — Design decision
- [[EmbeddingProvider]] — Vector generation (upstream)
- [[StoreProvider]] — Data persistence (delegates to VectorProvider)
- [[DocStore]] — MVP store implementation
- [[Transformers]] — Default EmbeddingProvider

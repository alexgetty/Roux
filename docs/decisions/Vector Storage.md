# Decision - Vector Storage

**Status:** Decided
**Affects:** [[EmbeddingProvider]], [[DocStore]], [[StoreProvider]]

## Problem

Embeddings must be persisted—regenerating on every query is expensive. But the current architecture is ambiguous about who stores them:

- [[EmbeddingProvider]] generates vectors and has a `search()` method (implying it has an index)
- [[DocStore]] mentions SQLite cache for embeddings (implying Store owns them)

Who persists embeddings? Where do they live?

## Options

### Option A: EmbeddingProvider owns vector storage

Each EmbeddingProvider implementation manages its own vector index.

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  store(id: string, vector: number[]): Promise<void>;
  search(query: string, limit: number): Promise<Array<{ id: string; distance: number }>>;
}
```

**Pros:** Self-contained. Swap embedding providers, keep their indexes.
**Cons:** Two persistence layers. Vectors divorced from node data. Sync complexity.

### Option B: StoreProvider owns vector storage

Embeddings stored alongside nodes. EmbeddingProvider is stateless.

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;  // So store knows vector size
}

interface StoreProvider {
  // ... existing methods ...
  storeEmbedding(id: string, vector: number[]): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<Array<{ id: string; distance: number }>>;
}
```

**Pros:** Single persistence layer. Vectors live with nodes. Store can optimize.
**Cons:** Every store must implement vector storage. Tight coupling to embedding dimensions.

### Option C: Separate VectorStore provider

New provider type dedicated to vector persistence.

```typescript
interface VectorStoreProvider {
  store(id: string, vector: number[]): Promise<void>;
  search(vector: number[], limit: number): Promise<Array<{ id: string; distance: number }>>;
  delete(id: string): Promise<void>;
}
```

**Pros:** Clean separation. Can use Pinecone/Milvus without changing other providers.
**Cons:** Third provider to configure. More moving parts for MVP.

## Considerations

- MVP scale (hundreds to low thousands of nodes) doesn't need a dedicated vector DB
- SQLite can do brute-force cosine similarity fine at MVP scale
- Production stores (Neo4j 5.x) have native vector indexes
- If we change embedding models, all vectors must regenerate anyway
- Vectors are derived data—can always regenerate from content

## Decision

**Option B: StoreProvider owns the `searchByVector()` interface** — with optional delegation to external VectorProvider (future).

## Outcome

### Interface

`searchByVector()` is part of the StoreProvider interface. This is the standardized contract that all stores implement:

```typescript
interface StoreProvider {
  // ... existing CRUD and graph ops ...
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<Array<{ id: string; distance: number }>>;
}
```

EmbeddingProvider remains stateless (just `embed()` and `embedBatch()`).

### Implementation Strategy

Each store implements `searchByVector()` using whatever mechanism is appropriate for that backend:

| Store | Vector Search Implementation |
|-------|------------------------------|
| DocStore | SQLite brute-force cosine similarity (MVP) |
| Neo4jStore | Native Neo4j vector index |
| SurrealDB | Native vector support |
| FalkorDB | Native vector similarity |
| SQLiteStore | sqlite-vec or brute-force |

Stores with native vector support use their optimized implementations. Stores without (or with limited support) use simpler approaches.

### Future: VectorProvider Override

Post-MVP, stores may support delegating `searchByVector()` to an external VectorProvider:

```yaml
# Default: DocStore uses built-in SQLite brute-force
providers:
  store:
    type: docstore

# Override: DocStore delegates vector search to external provider
providers:
  store:
    type: docstore
  vector:
    type: pinecone
    apiKey: xxx
```

When a VectorProvider is configured, stores that support delegation use it instead of their built-in implementation. This enables:
- Scale mismatch scenarios (simple document store + industrial vector search)
- Specialized optimization (purpose-built vector DBs outperform general-purpose stores)
- Upgrade path (start with brute-force, add Pinecone later without changing document store)

**This is not an MVP feature.** The architecture accommodates it without requiring interface changes later.

### MVP Scope

For MVP:
- DocStore implements `searchByVector()` with brute-force cosine similarity in SQLite
- No VectorProvider override capability
- Sufficient for hundreds to low thousands of nodes

### Embedding Metadata

Store tracks metadata per embedding:
- `model`: which provider/model generated this vector
- `computed_at`: timestamp for cache invalidation

### Embedding Provider Swap Behavior

System-level setting applies to embedding model changes:

```yaml
system:
  on_model_change: lazy  # lazy | eager
```

| Mode | Behavior |
|------|----------|
| `lazy` (default) | New/updated nodes use new provider. Existing embeddings untouched. |
| `eager` | Model change triggers background regeneration. |

Manual override: `roux sync --full` forces complete re-embed regardless of setting.

### Rationale

- **Standardized interface:** `searchByVector()` on StoreProvider gives a consistent contract regardless of backend.
- **Backend-appropriate implementation:** Each store uses its native capabilities. Neo4j uses native vectors. DocStore uses SQLite.
- **Stateless EmbeddingProvider:** Trivial to implement, test, swap. Just `text in → vector out`.
- **Future flexibility:** VectorProvider override can be added without changing the interface. Two-way door.
- **No premature complexity:** MVP ships with simple brute-force. Optimization comes when needed.

## Related

- [[Decisions]] — Decision hub
- [[decisions/Search Ownership]] — Related decision
- [[EmbeddingProvider]] — Vector generation
- [[StoreProvider]] — Data persistence
- [[DocStore]] — MVP implementation

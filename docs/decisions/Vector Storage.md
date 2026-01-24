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

**Option B evolves to modular VectorProvider** — StoreProvider delegates vector operations to an injected VectorProvider. Default implementation uses SQLite brute-force. Swappable via config.

## Outcome

### Interface

VectorProvider is a separate interface for vector storage and similarity search:

```typescript
interface VectorProvider {
  store(id: string, vector: number[], model: string): Promise<void>;
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  getModel(id: string): Promise<string | null>;
}
```

StoreProvider delegates to VectorProvider but exposes convenience methods:

```typescript
interface StoreProvider {
  // ... existing CRUD and graph ops ...
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]>;
}
```

EmbeddingProvider remains stateless (just `embed()` and `embedBatch()`).

### Implementation Strategy

VectorProvider is injected into stores. Each store can use a different VectorProvider:

| VectorProvider | Implementation |
|----------------|----------------|
| SqliteVectorProvider | Brute-force cosine similarity (MVP default) |
| PineconeVectorProvider | Pinecone cloud vector DB (future) |
| Native store vectors | Neo4j/SurrealDB/FalkorDB can implement VectorProvider using native indexes (future) |

### Configuration

```yaml
# Implicit: uses SqliteVectorProvider (default)
providers:
  store:
    type: docstore

# Explicit: swap in Pinecone
providers:
  store:
    type: docstore
  vector:
    type: pinecone
    apiKey: xxx
```

When a VectorProvider is configured, stores use it instead of the default. This enables:
- Scale mismatch scenarios (simple document store + industrial vector search)
- Specialized optimization (purpose-built vector DBs outperform general-purpose stores)
- Upgrade path (start with brute-force, add Pinecone later without changing document store)

### MVP Scope

For MVP:
- `VectorProvider` interface defined
- `SqliteVectorProvider` implements brute-force cosine similarity
- DocStore delegates to injected VectorProvider (defaults to SqliteVectorProvider)
- Vectors stored as Float32Array (matches model output, half the memory of Float64)
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

- **Modular from day one:** VectorProvider is a separate concern from StoreProvider. Swap implementations via config.
- **Same pattern as EmbeddingProvider:** `text → EmbeddingProvider → vector → VectorProvider → storage/search`. Consistent mental model.
- **Stateless EmbeddingProvider:** Trivial to implement, test, swap. Just `text in → vector out`.
- **Float32 efficiency:** Matches model output. Half the memory of Float64 with no practical precision loss for similarity search.
- **No premature complexity:** MVP ships with simple brute-force. Pinecone can be added later with zero changes to DocStore.

## Related

- [[Decisions]] — Decision hub
- [[decisions/Search Ownership]] — Related decision
- [[VectorProvider]] — Vector storage interface
- [[EmbeddingProvider]] — Vector generation
- [[StoreProvider]] — Data persistence
- [[DocStore]] — MVP implementation

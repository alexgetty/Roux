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

**Option B: StoreProvider owns vector storage** — with configurable regeneration behavior.

## Outcome

### Storage

StoreProvider persists embeddings alongside nodes. EmbeddingProvider is stateless (just `embed()` and `embedBatch()`).

Store tracks metadata per embedding:
- `model`: which provider/model generated this vector
- `generated_at`: timestamp for cache invalidation if needed

### Provider Swap Behavior

System-level setting applies to all model swaps:

```yaml
system:
  on_model_change: lazy  # lazy | eager

providers:
  embeddings:
    type: ollama
    model: nomic-embed-text
```

| Mode | Behavior |
|------|----------|
| `lazy` (default) | New/updated nodes use new provider. Existing embeddings untouched. Mixed-model index is acceptable. |
| `eager` | Any model change triggers background regeneration. Index stays model-consistent. |

One knob for the whole project. Per-provider overrides can be added later if a real use case demands it.

### Manual Override

`roux sync --full` always available to force complete re-embed regardless of mode.

### Rationale

- **Single persistence layer:** Store owns all data. No sync between Store and separate vector DB.
- **Stateless EmbeddingProvider:** Trivial to implement, test, swap. Just `text in → vector out`.
- **User choice on consistency:** Those who don't care get zero friction on provider swap. Those who need consistent embeddings flip one flag.
- **Mixed-model index is fine:** Semantic search degrades slightly with mixed embeddings, not catastrophically. "Find relevant nodes" still works.
- **Future-proof:** Production stores (Neo4j, SurrealDB) have native vector indexes. This pattern lets them use optimized implementations internally.

## Related

- [[Decisions]] — Decision hub
- [[Decision - Search Ownership]] — Related decision
- [[EmbeddingProvider]] — Vector generation
- [[StoreProvider]] — Data persistence
- [[DocStore]] — MVP implementation

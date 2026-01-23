# Decision - Search Ownership

**Status:** Decided
**Affects:** [[GraphCore]], [[StoreProvider]], [[EmbeddingProvider]]

## Problem

Both `EmbeddingProvider` and `StoreProvider` define a `search()` method:

```typescript
// EmbeddingProvider
search(query: string, limit: number): Promise<Array<{ id: string; distance: number }>>;

// StoreProvider
search(query: string, limit: number): Promise<Node[]>;
```

Who owns semantic search? What does each `search()` do?

## Options

### Option A: EmbeddingProvider owns vector search

- `EmbeddingProvider.search()` — Vector similarity, returns IDs + distances
- `StoreProvider.search()` — Keyword/fulltext search only, or removed entirely
- `GraphCore` coordinates: calls EmbeddingProvider for vectors, StoreProvider to hydrate nodes

**Pros:** Clear separation. EmbeddingProvider is self-contained.
**Cons:** EmbeddingProvider needs its own storage (vector index). Adds infrastructure.

### Option B: StoreProvider owns all search

- `EmbeddingProvider` — Only `embed()` and `embedBatch()`, stateless
- `StoreProvider.search()` — Handles both semantic and keyword search
- Store implementations manage their own vector storage

**Pros:** Single search entry point. Store controls all persistence.
**Cons:** Every StoreProvider must implement vector search. Tight coupling.

### Option C: GraphCore owns search orchestration

- `EmbeddingProvider.embed()` — Generate vector for query
- `StoreProvider.searchByVector(vector, limit)` — Find nearest neighbors
- `StoreProvider.search()` — Keyword search (optional)
- `GraphCore.search()` — Orchestrates: embed query, then searchByVector

**Pros:** Clean separation. Embedding is stateless. Store owns all data.
**Cons:** New method on StoreProvider. All stores must support vector search.

## Considerations

- MVP uses DocStore with SQLite cache. SQLite can store vectors and do brute-force similarity.
- Future stores (Neo4j) have native vector indexes. Should use them.
- If EmbeddingProvider owns the index, swapping stores doesn't lose embeddings. But swapping embedding providers does.
- Stateless EmbeddingProvider is simpler to implement and test.

## Decision

**Option C: GraphCore owns search orchestration** — with modifications.

## Outcome

EmbeddingProvider is stateless. GraphCore orchestrates semantic search:

```typescript
// EmbeddingProvider - stateless
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
  modelId(): string;  // For tracking which model generated vectors
}

// StoreProvider - owns all persistence including vectors
interface StoreProvider {
  // ... existing CRUD and graph ops ...
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<Array<{ id: string; distance: number }>>;
}

// GraphCore - orchestrates
async search(query: string, limit: number): Promise<Node[]> {
  const vector = await this.embedding.embed(query);
  const results = await this.store.searchByVector(vector, limit);
  return this.store.getNodes(results.map(r => r.id));
}
```

**Rationale:**
- Stateless EmbeddingProvider is trivial to implement, test, and swap
- Store as single source of truth aligns with "human-usable interface at every layer" philosophy
- Clean failure isolation: embedding down = no semantic search, but CRUD and traversal still work
- Future stores (Neo4j 5.x, SurrealDB) have native vector indexes—this pattern lets them use their optimized implementations

## Related

- [[Decisions]] — Decision hub
- [[GraphCore]] — Orchestration
- [[EmbeddingProvider]] — Vector generation
- [[StoreProvider]] — Data persistence

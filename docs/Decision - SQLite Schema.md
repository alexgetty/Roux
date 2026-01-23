# Decision - SQLite Schema

**Status:** Decided
**Affects:** [[DocStore]], [[StoreProvider]], [[EmbeddingProvider]]

## Problem

DocStore uses SQLite as a cache layer, but the schema is undefined. This affects:

- How nodes are stored and queried
- How embeddings are stored
- How vector search (`searchByVector`) is implemented
- How centrality scores are cached
- Index strategy for performance

Vector search implementation is particularly critical. Options range from brute-force cosine similarity (simple, O(n) per query) to sqlite-vec extension (requires native dependency) to external vector store (adds complexity).

## Options

### Vector Search Implementation

#### Option A: Brute-force in application code

Load all vectors into memory, compute cosine similarity in JS/TS.

```typescript
async searchByVector(query: number[], limit: number) {
  const all = await db.all('SELECT id, embedding FROM nodes');
  return all
    .map(row => ({ id: row.id, distance: cosine(query, JSON.parse(row.embedding)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
```

**Pros:** Zero dependencies. Simple. Works everywhere.
**Cons:** O(n) per query. Memory pressure loading all vectors. Doesn't scale past ~5K nodes.

#### Option B: sqlite-vec extension

Use the sqlite-vec extension for native vector operations.

```sql
CREATE VIRTUAL TABLE embeddings USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);
```

**Pros:** Fast KNN queries. Scales to 100K+ vectors. SQL-native.
**Cons:** Native extension dependency. Complicates installation. May not work on all platforms.

#### Option C: Hybrid (brute-force MVP, migrate later) ✓ SELECTED

Start with brute-force, define interface that allows swap to sqlite-vec.

**Pros:** Ship faster. Learn real performance needs.
**Cons:** May need to rewrite. Users hit performance wall.

**Decision:** This is the MVP approach. See [[Decision - Vector Storage]] for full rationale. The `searchByVector()` interface on StoreProvider allows implementation to change without affecting callers.

### Schema Structure

#### Option A: Single table with JSON columns

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,           -- JSON array
  outgoing_links TEXT, -- JSON array
  properties TEXT,     -- JSON object
  embedding TEXT,      -- JSON array of floats
  source_type TEXT,
  source_path TEXT,
  source_modified INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Pros:** Simple. Single source of truth. Easy to query.
**Cons:** JSON parsing overhead. Can't index into JSON arrays efficiently.

#### Option B: Normalized tables

```sql
CREATE TABLE nodes (id, title, content, properties, ...);
CREATE TABLE tags (node_id, tag);
CREATE TABLE links (source_id, target_id);
CREATE TABLE embeddings (node_id, model, vector);
```

**Pros:** Proper indexing. Query flexibility. Cleaner data model.
**Cons:** More joins. More complexity. Migration complexity.

#### Option C: Hybrid (denormalized nodes, separate embeddings) ✓ SELECTED

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  tags TEXT,           -- JSON array (read frequently, written rarely)
  outgoing_links TEXT, -- JSON array
  properties TEXT,
  source_type TEXT,
  source_path TEXT,
  source_modified INTEGER
);

CREATE TABLE embeddings (
  node_id TEXT PRIMARY KEY,
  model TEXT,
  vector BLOB,         -- Binary for efficiency
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE centrality (
  node_id TEXT PRIMARY KEY,
  pagerank REAL,
  in_degree INTEGER,
  out_degree INTEGER,
  computed_at INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

**Pros:** Balance of simplicity and performance. Embeddings isolated for easy rebuild.
**Cons:** Still some JSON parsing. Multiple tables to sync.

**Decision:** Hybrid schema selected. Keeps node operations simple while isolating embeddings (large, change on different schedule) and centrality (computed, can be blown away and recomputed). Internal to DocStore — can be restructured via migration if needed.

## Considerations

- MVP targets 500+ nodes. Production might see 10K+.
- sqlite-vec installation complexity vs performance gain
- Embedding dimension varies by model (384 for MiniLM, 768 for others)
- Centrality needs periodic recomputation—separate table makes this clean
- Binary BLOB vs JSON text for vectors (BLOB is ~4x smaller, faster to parse)

## Questions to Resolve

1. ~~What's the acceptable query latency for semantic search at 500 nodes? 1000? 5000?~~ See [[Decision - Performance Thresholds]]
2. ~~Is sqlite-vec installation complexity acceptable for MVP?~~ No. Brute-force for MVP.
3. ~~Should we store vectors as JSON text or binary BLOB?~~ BLOB. No need for human-debuggable vectors.
4. ~~How is embedding dimension tracked when models change?~~ Store `model` in embeddings table.

## Decision

### Vector Search: Option C (Brute-force MVP)

Brute-force cosine similarity in application code for MVP. Interface (`searchByVector()` on StoreProvider) allows swap to sqlite-vec later. See [[Decision - Vector Storage]].

### Schema Structure: Option C (Hybrid)

Denormalized nodes + separate embeddings + separate centrality tables.

**Rationale:** At MVP scale (500 nodes), performance difference between normalized and denormalized is negligible. Hybrid keeps node CRUD simple (single table, JSON columns for tags/links) while isolating embeddings and centrality into separate tables. Embeddings are large and regenerated when models change. Centrality is computed and can be wiped/rebuilt without touching source data. This is internal to DocStore and can be migrated later if needed.

### Vector Format: BLOB

Binary BLOB storage for embedding vectors. ~4x smaller than JSON text, faster to parse. Human-debuggability not required.

## Outcome

Decided. Three tables: `nodes` (denormalized with JSON columns), `embeddings` (BLOB vectors), `centrality` (computed metrics). Implementation proceeds with this schema.

## Related

- [[Decisions]] — Decision hub
- [[DocStore]] — Implementation
- [[Decision - Vector Storage]] — Where embeddings live (decided: in StoreProvider)

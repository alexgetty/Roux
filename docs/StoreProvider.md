# StoreProvider

Data persistence and graph operations. The most critical provider interface.

## Overview

StoreProvider defines how Roux stores and retrieves [[Node|Nodes]]. Every storage backend—from markdown files to Neo4j—implements this interface.

The interface abstracts away storage details. [[GraphCore]] doesn't know if it's talking to files or a graph database. Same queries, same results.

## Interface

```typescript
interface StoreProvider {
  // CRUD
  createNode(node: Node): Promise<void>;
  updateNode(id: string, updates: Partial<Node>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  getNode(id: string): Promise<Node | null>;
  getNodes(ids: string[]): Promise<Node[]>;

  // Graph operations (see Decision - Edge Futureproofing for options pattern)
  getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
  findPath(source: string, target: string): Promise<string[] | null>;
  getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;

  // Vector storage (see Decision - Vector Storage)
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(vector: number[], limit: number): Promise<Array<{ id: string; distance: number }>>;

  // Search
  searchByTags(tags: string[], mode: TagMode): Promise<Node[]>;
}

interface NeighborOptions {
  direction: Direction;
  type?: string;       // Future: filter by edge type
  minWeight?: number;  // Future: filter by edge weight
  limit?: number;      // Future: cap results
}

type Direction = 'in' | 'out' | 'both';
type Metric = 'pagerank' | 'in_degree' | 'out_degree';
type TagMode = 'any' | 'all';
```

**Note:** The old `search(query, limit)` method is removed. Semantic search is orchestrated by [[GraphCore]]: embed query via [[EmbeddingProvider]], then call `searchByVector()` on Store.

## Implementations

Store implementations span a spectrum from zero infrastructure to enterprise scale:

**File-based (zero infra)**
- [[DocStore]] — Markdown, text, HTML. Graph projected from links. (MVP)

**Embedded (no external server)**
- [[SQLiteStore]] — SQLite-based graph storage
- [[LevelGraph]] — Embedded graph library

**Standalone (moderate scale)**
- [[SurrealDB]] — Multi-model database
- [[FalkorDB]] — Graph database
- [[Memgraph]] — In-memory graph

**Enterprise (full scale)**
- [[Neo4j]] — The standard
- [[ArangoDB]] — Multi-model
- [[Amazon Neptune]] — Cloud-native

## Design Decisions

**Why separate Store from Embedding?**
Storage and vector generation are orthogonal. You might want OpenAI embeddings with file storage, or local embeddings with Neo4j. Decoupling enables mix-and-match. See [[Decision - Search Ownership]] and [[Decision - Vector Storage]].

**Why include graph operations in Store?**
Graph traversal is inherently tied to how data is stored. A graph database handles `findPath` natively; a file store needs to build an in-memory graph. The implementation differs, the interface doesn't.

**Why include vector search in Store?**
`searchByVector()` is part of StoreProvider because each backend implements it differently using native capabilities:

| Store | Vector Search Implementation |
|-------|------------------------------|
| DocStore | SQLite brute-force (MVP), sqlite-vec (future) |
| Neo4jStore | Native Neo4j vector index |
| SurrealDB | Native vector support |
| FalkorDB | Native vector similarity |

The interface is standardized. The implementation is backend-specific.

**Future: VectorProvider Override**
Post-MVP, stores may support delegating `searchByVector()` to an external VectorProvider (e.g., Pinecone). This enables scenarios like DocStore for documents + Pinecone for industrial-scale vector search. See [[Decision - Vector Storage]] for details.

**Canonical IDs vs Internal Storage**
`Node.id` is the canonical, portable identifier defined by Roux. Each StoreProvider maps it to native storage:

| Store | Canonical ID | Internal Storage |
|-------|--------------|------------------|
| DocStore | `notes/research.md` | File path |
| Neo4j | `notes/research.md` | `id` property |
| SurrealDB | `notes/research.md` | Record ID or field |

Internal/auto-generated IDs (e.g., Neo4j numeric IDs) are implementation details, never exposed through the interface. See [[Decision - Node Identity]].

## Open Questions (Deferred)

- **Scale Boundaries**: At what node count does SQLite + in-memory graph become inadequate? Empirical—learn from usage.
- ~~**Centrality Caching**: PageRank recomputation frequency.~~ Decided: recompute during file sync (piggybacked). See [[Decision - Graphology Lifecycle]].

## Related

- [[GraphCore]] — Consumes StoreProvider
- [[Node]] — What gets stored
- [[DocStore]] — MVP implementation
- [[EmbeddingProvider]] — Often used alongside for semantic search
- [[Decision - Graphology Lifecycle]] — Graph construction and sync timing

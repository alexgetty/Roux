---
title: Storeprovider
---
# StoreProvider

Data persistence and graph operations. The most critical provider layer.

## Overview

The Store layer has two parts:

- **`Store` interface** (`src/types/provider.ts`) — The contract that all storage backends must fulfill. [[GraphCore]] programs against this interface.
- **`StoreProvider` abstract class** (`src/providers/store/index.ts`) — Shared implementation that provides default graph operations, vector delegation, discovery, tag search, batch operations, and graph lifecycle management. Concrete stores (like [[DocStore]]) extend this class.

The interface abstracts away storage details. [[GraphCore]] doesn't know if it's talking to files or a graph database. Same queries, same results.

## Architecture

```
┌─────────────────┐
│  Store interface │  ← GraphCore programs against this
└────────┬────────┘
         │ implements
┌────────▼────────┐
│  StoreProvider   │  ← Abstract class with shared logic
│  (abstract)      │     GraphManager, VectorIndex delegation,
│                  │     tag search, batch ops, discovery
└────────┬────────┘
         │ extends
┌────────▼────────┐
│  DocStore        │  ← Concrete implementation
│  (and future     │     Adds file I/O, parsing, caching
│   stores)        │
└─────────────────┘
```

## Store Interface

See `src/types/provider.ts` for the current `Store` interface definition. Key method groups:

- **CRUD** — `createNode()`, `updateNode()`, `deleteNode()`, `getNode()`, `getNodes()`
- **Graph** — `getNeighbors()`, `findPath()`, `getHubs()`
- **Vector** — `storeEmbedding()`, `searchByVector()`
- **Search** — `searchByTags()`
- **Discovery** — `getRandomNode()`
- **Resolution** — `resolveTitles()`
- **Batch** — `listNodes()`, `resolveNodes()`, `nodesExist()`

## StoreProvider Abstract Class

The abstract class provides default implementations so concrete stores only need to implement storage-specific operations:

**Abstract (must implement):**
- `loadAllNodes()` — Return all nodes from storage
- `getNodesByIds(ids)` — Return specific nodes by ID
- `createNode()`, `updateNode()`, `deleteNode()`, `getNode()`, `getNodes()`, `close()`

**Provided by StoreProvider:**
- Graph operations via `GraphManager` — `getNeighbors()`, `findPath()`, `getHubs()`
- Vector operations via `VectorIndex` — `storeEmbedding()`, `searchByVector()`
- Discovery — `getRandomNode()`
- Search — `searchByTags()`
- Batch — `listNodes()`, `resolveNodes()`, `nodesExist()`, `resolveTitles()`
- Graph lifecycle — `syncGraph()`, `onCentralityComputed()`

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
Storage and vector generation are orthogonal. You might want OpenAI embeddings with file storage, or local embeddings with Neo4j. Decoupling enables mix-and-match. See [[decisions/Search Ownership]] and [[decisions/Vector Storage]].

**Why include graph operations in Store?**
Graph traversal is inherently tied to how data is stored. A graph database handles `findPath` natively; a file store needs to build an in-memory graph. The implementation differs, the interface doesn't.

**Why include vector search in Store?**
`searchByVector()` is part of Store because each backend implements it differently using native capabilities:

| Store | Vector Search Implementation |
|-------|------------------------------|
| DocStore | SQLite brute-force (MVP), sqlite-vec (future) |
| Neo4jStore | Native Neo4j vector index |
| SurrealDB | Native vector support |
| FalkorDB | Native vector similarity |

The interface is standardized. The implementation is backend-specific.

**Future: VectorIndex Override**
Post-MVP, stores may support delegating `searchByVector()` to an external VectorIndex (e.g., Pinecone). This enables scenarios like DocStore for documents + Pinecone for industrial-scale vector search. See [[decisions/Vector Storage]] for details.

**Canonical IDs vs Internal Storage**
`Node.id` is the canonical, portable identifier defined by Roux. Each store maps it to native storage:

| Store | Canonical ID | Internal Storage |
|-------|--------------|------------------|
| DocStore | `notes/research.md` | File path |
| Neo4j | `notes/research.md` | `id` property |
| SurrealDB | `notes/research.md` | Record ID or field |

Internal/auto-generated IDs (e.g., Neo4j numeric IDs) are implementation details, never exposed through the interface. See [[decisions/Node Identity]].

**Why `resolveTitles()`?**
MCP responses include outgoing links with human-readable titles for LLM context. The mapping from ID to title is store-specific:

| Store | Resolution Strategy |
|-------|---------------------|
| DocStore | Derive from file path (zero IO) |
| Neo4j | Batch query for title property |
| SurrealDB | Batch query for title field |

This keeps the MCP layer store-agnostic while enabling rich context in responses. See [[MCP Tools Schema]] for response format details.

## Centrality

Currently implemented: `in_degree`, `out_degree`. PageRank is planned but not yet implemented.

See [[decisions/Graphology Lifecycle]] for graph construction and centrality recomputation timing.

## Open Questions (Deferred)

- **Scale Boundaries**: At what node count does SQLite + in-memory graph become inadequate? Empirical—learn from usage.

## Related

- [[GraphCore]] — Consumes Store interface
- [[Node]] — What gets stored
- [[DocStore]] — MVP implementation
- [[EmbeddingProvider]] — Often used alongside for semantic search
- [[decisions/Graphology Lifecycle]] — Graph construction and sync timing

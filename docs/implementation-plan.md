# Roux: Graph Programming Interface (GPI)

## The Bet

In the age of AI, products and personal tooling will be differentiated by the ability to author and manage knowledge in graph-based formats—for both humans and LLMs. Roux is a long-term investment in that thesis.

## What Roux Is

Roux is a **[[GPI|Graph Programming Interface]]**—a personal infrastructure platform for authoring, querying, traversing, and maintaining graph-structured knowledge.

Like an API connects external systems to applications, a GPI connects you (human or machine) to graph-structured knowledge. Everything in Roux exists to serve this interface.

**Core principle:** The graph is always the target structure. Data sources that aren't natively graphs get transformed into graphs during ingestion. The query model stays constant regardless of where the data originated or how it's stored.

**Why build this instead of using existing tools?** Existing solutions either require heavy infrastructure (Neo4j, FalkorDB) or lack graph traversal and semantic search (Obsidian MCP plugins). Roux provides graph-aware querying with zero-to-minimal infrastructure for lightweight or prototyping use cases, scaling up to production databases when needed—all through the same interface and toolkit.

---

## Architecture

See [[Architecture.canvas]] for the visual system map.

### Core Principle: Full Modularity

Roux is a platform composed of pluggable modules. [[GraphCore]] is the coordination hub—it defines what it needs from each provider type but has zero functionality without them. Every capability is a separate module that can be installed or omitted based on the use case.

This enables configurations ranging from "point at a markdown folder and query" (GraphCore + [[StoreProvider]] + [[EmbeddingProvider]]) to "production recommendation engine with analytics" (full provider stack).

### Module Overview

#### [[GraphCore]]
The invariant center. Orchestration only—defines provider interfaces, routes requests, coordinates responses. Zero capabilities without providers.

#### External Interfaces
How you access Roux. Each is a separate module.
- [[MCP Server]] — AI co-authoring via Model Context Protocol
- [[API]] — REST/GraphQL for programmatic access
- [[CLI]] — Terminal access for administration and automation

#### Providers
Pluggable capabilities. Each defines an interface that implementations must fulfill.
- [[StoreProvider]] — Data persistence and graph operations
- [[EmbeddingProvider]] — Vector generation for semantic search
- [[LLMProvider]] — Text generation for assisted features
- [[IngestionProvider]] — Data transformation and import
- [[ValidationProvider]] — Data integrity and schema enforcement
- [[AnalyticsProvider]] — Graph health and metrics
- [[AuthoringProvider]] — Content creation assistance

#### Store Implementations
[[StoreProvider]] implementations span zero infra to full scale:
- **File-based**: [[DocStore]] (MVP)
- **Embedded**: [[SQLiteStore]], [[LevelGraph]]
- **Standalone**: [[SurrealDB]], [[FalkorDB]], [[Memgraph]]
- **Enterprise**: [[Neo4j]], [[ArangoDB]], [[Amazon Neptune]]

#### Embedding Implementations
[[EmbeddingProvider]] implementations:
- [[Transformers]] — Local ONNX models via transformers.js (default)
- [[Ollama]] — Local models via Ollama service
- [[OpenAI]] — Cloud models
- [[Structural Embeddings]] — Graph-aware vectors (research)

### Data Model

All modules speak [[Node]] and [[Edge]]. Format conversion happens at store boundaries only. See [[Node]] for the entity model and [[Edge]] for the relationship model (currently implicit, with a roadmap to explicit typing).

### Key Concepts

- [[Graph Projection]] — Inferring graph structure from flat files
- [[Wiki-links]] — Link syntax for edges in [[DocStore]]

### Interface Contracts (One-Way Doors)

These interfaces must be designed correctly—changing them later breaks everything:

1. **Provider interfaces** — [[StoreProvider]], [[EmbeddingProvider]], [[LLMProvider]], etc. All providers of a type must conform to the same interface.
2. **[[Node]] data model** — The canonical internal representation.
3. **[[GraphCore]] API** — How external interfaces communicate with GraphCore.

### Two-Way Doors (Safe to Change Later)

- Specific provider implementations (can swap [[Ollama]] for [[OpenAI]])
- SQLite schema details within [[DocStore]]
- Graph library choice (graphology vs alternatives)
- [[CLI]] command structure
- [[MCP Server]] tool signatures (can add tools, careful removing)
- Which providers are installed (modular by design)

---

## MVP

See [[MVP]] for the detailed first use case: **Personal Knowledge Base**.

Summary: Point Roux at a markdown directory, query via MCP, edit in Obsidian, changes sync in <1 second.

---

## Roadmap

### Phase 0: MVP
**Goal**: Working [[MCP Server]] with [[DocStore]]. See [[MVP]] for scope and success criteria.

- [ ] Project scaffold (TypeScript, interfaces defined)
- [ ] [[StoreProvider]] definition
- [ ] [[DocStore]]: read/write documents, parse [[Wiki-links]] + frontmatter, SQLite cache
- [ ] [[EmbeddingProvider]] interface + [[Ollama]] implementation
- [ ] [[GraphCore]]: query orchestration
- [ ] Graphology integration for path/centrality operations
- [ ] [[MCP Server]] with 10 tools
- [ ] [[CLI]]: `init`, `serve`, `status`
- [ ] File watcher for live sync
- [ ] Test against existing markdown directory

**Output**: `npm install -g roux && roux init ~/docs && roux serve`

### Phase 0.5: LLMProvider
**Goal**: Expose text generation alongside embeddings

- [ ] [[LLMProvider]] interface definition
- [ ] [[Ollama]] implementation of [[LLMProvider]]
- [ ] MCP tools for LLM-assisted features (optional): `summarize_node`, `suggest_tags`, `extract_entities`

### Phase 1: Structural Embeddings (Research)
**Goal**: True graph-aware vectors

- [ ] Research: Node2Vec vs GraphSAGE vs hybrid approaches
- [ ] Implement new [[EmbeddingProvider]] using graph structure
- [ ] A/B test retrieval quality: text-appended vs structural
- [ ] Document findings, choose approach

See [[Structural Embeddings]] for research questions.

### Phase 2: Neo4jStore
**Goal**: Graph database option for scale

- [ ] Implement [[Neo4j|Neo4jStore]] behind [[StoreProvider]]
- [ ] Migration tooling: [[DocStore]] → Neo4jStore
- [ ] Performance benchmarks at 10K, 50K, 100K nodes
- [ ] Document when to upgrade

### Phase 3: IngestionProvider
**Goal**: First-class data transformation

- [ ] [[IngestionProvider]] interface definition
- [ ] Entity extraction from unstructured text
- [ ] Edge inference (detect implicit relationships)
- [ ] Batch import tooling
- [ ] Incremental ingestion (add to existing graph)

### Phase 4: Additional Stores
**Goal**: Multiple storage backends

- [ ] [[SQLiteStore]] for non-file-based graphs
- [ ] JSONStore for structured data
- [ ] Multi-store federation (query across stores)
- [ ] Migration tooling between stores

### Phase 5: Production Features
**Goal**: Support product-level use cases

- [ ] Multi-tenancy (isolated graphs per user/org)
- [ ] Access control layer (who sees what nodes)
- [ ] Real-time write handling (concurrent authors)
- [ ] SLA/latency guarantees
- [ ] Horizontal scaling considerations

### Future (Unscheduled)
- SSE transport for MCP Server (standalone HTTP server, multi-client). See [[decisions/MCP Transport]].
- REST/GraphQL [[API]] layer
- LLM-assisted graph construction
- Domain-specific schema validation
- Web UI for graph visualization
- Bidirectional sync with external systems

### Deferred Considerations (Not MVP)

Items explicitly scoped out of MVP, to revisit in later phases:

**Node Model**
- Node versioning / history tracking
- Soft deletes (currently hard delete)
- Schema evolution strategy

**DocStore**
- Binary file handling (images, PDFs)
- Symlink support
- Frontmatter schema enforcement
- Non-markdown format parsers (txt, html, rtf)

**StoreProvider**
- Scale boundary testing (when SQLite + in-memory becomes inadequate)
- ~~Centrality caching strategy (PageRank recomputation frequency)~~ Decided: piggyback on file sync. See [[decisions/Graphology Lifecycle]].
- `searchByTags` pagination/limits (MVP returns all matches; add limits when scale matters)

**Operations**
- Concurrent access handling (multiple MCP clients)
- Crash recovery / write-ahead logging
- Memory footprint optimization

**Embeddings (Research Phase)**
- Embedding composition (content + structure vectors)
- Chunking strategy for long documents
- Incremental structural embedding updates

---

## Open Research Questions

Research questions have been distributed to relevant atomic notes. Cross-cutting performance questions remain here:

### Performance & Operations

- **Cold Start Time**: How long does `roux init` take on 1K, 5K, 10K documents? What's acceptable? Can we show progress?
- **Memory Footprint**: How much RAM does the server use at different scales? Can we run on a Raspberry Pi? On a VPS with 512MB RAM?
- **Concurrent Access**: If multiple MCP clients connect simultaneously, what happens? Do we need locking? Connection pooling?
- **Crash Recovery**: If the server crashes mid-write, what state is the cache in? Do we need write-ahead logging? Transactions?

### Implementation Edge Cases (Decisions Deferred)

These don't block MVP but need answers during implementation:

- ~~**File Watching Details**: What debounce interval? How to handle partial reads during write? `.roux/` ignored automatically?~~ Resolved. 100ms debounce, parse failure = skip + retry, `.roux/` always excluded. See [[DocStore]].
- ~~**Centrality Computation Timing**: Compute PageRank on init, invalidate on change, recompute lazily on query? Or background job?~~ Decided: piggyback on file sync. See [[decisions/Graphology Lifecycle]].
- **Tag Format**: YAML array in frontmatter? Inline `#tag` syntax? Case-sensitive matching? Document in [[DocStore]].
- **Broken Link Handling**: MVP logs warning and skips edge. No mode configuration until a real use case demands it.
- ~~**ID Derivation Edge Cases**: What if title contains special characters? Slashes? Unicode? Document normalization rules.~~ Resolved. See [[decisions/Node Identity]].

See also:
- [[GraphCore#Open Questions]]
- [[Node#Open Questions]]
- [[StoreProvider#Open Questions]]
- [[EmbeddingProvider#Open Questions]]
- [[DocStore#Open Questions]]
- [[Structural Embeddings#Open Questions]]

---

## Why Not Existing Tools?

| Tool | What it does | What it lacks |
|------|--------------|---------------|
| Graphiti, Memento MCP | Full KG + MCP | Require Neo4j/FalkorDB infrastructure |
| Obsidian MCP plugins | File access for Claude | No graph traversal, no semantic search, no write-back |
| Neo4j + Neosemantics | Full graph DB | Infrastructure overhead, no MCP built-in |
| LangChain/LlamaIndex | RAG pipelines | No persistent graph, no true co-authoring |

**Roux's position**: Zero-to-minimal infrastructure graph-aware querying that scales up. Start with human-editable files, upgrade to graph databases when needed—same [[GPI]] throughout.

---

## File Structure (MVP)

```
roux/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Entry point
│   ├── core/
│   │   ├── graph-core.ts         # GraphCore
│   │   └── types.ts              # Node, enums, shared types
│   ├── interfaces/
│   │   ├── cli.ts                # CLI
│   │   ├── mcp-server.ts         # MCP Server
│   │   └── api.ts                # API (future)
│   └── providers/
│       ├── store/
│       │   ├── store-provider.ts # StoreProvider interface
│       │   └── doc-store.ts      # DocStore implementation
│       ├── embedding/
│       │   ├── embedding-provider.ts
│       │   └── ollama.ts
│       ├── llm/
│       │   ├── llm-provider.ts
│       │   └── ollama.ts
│       ├── ingestion/            # Future
│       ├── validation/           # Future
│       ├── analytics/            # Future
│       └── authoring/            # Future
├── tests/
└── README.md
```

---

## Decision Log

| Decision | Rationale | Reversible? |
|----------|-----------|-------------|
| Roux as [[GPI]] | Unifying mental model: everything serves the graph programming interface | N/A (framing) |
| Full modularity | Every capability is a pluggable provider. Enables minimal to full-featured configurations. | No (architectural) |
| [[GraphCore]] as orchestration hub | Zero functionality without providers. Routes requests, defines interfaces. | No |
| [X]Provider naming pattern | Consistent interface naming. [[StoreProvider]], [[EmbeddingProvider]], etc. | No |
| External interfaces as separate modules | [[MCP Server]], [[API]], [[CLI]] are distinct modules. Different protocols, different clients. | No |
| Store categories (file → enterprise) | Spectrum of options from zero-infra to full-scale. Same interface regardless. | N/A (conceptual) |
| [[DocStore]] for MVP | Lightweight, human-editable, zero infrastructure. Proves the architecture. | Yes, via [[StoreProvider]] |
| TypeScript | Familiar ecosystem, official MCP SDK | Yes, but painful |
| [[Ollama]] as default provider | Local-first, no cloud dependency | Yes, provider abstraction |
| SQLite cache for [[DocStore]] | Zero infrastructure, fast enough for MVP scale | Yes, internal to DocStore |
| Graphology for graph ops | Mature JS library for in-memory operations | Yes, behind interface |

---

## Glossary

| Term | Definition |
|------|------------|
| **[[Config]]** | Configuration schema for `roux.yaml`. |
| **[[GPI]]** | Graph Programming Interface. What Roux is. |
| **[[MVP]]** | First use case: Personal Knowledge Base. |
| **[[Transformers]]** | Default local embedding provider using transformers.js. |
| **[[GraphCore]]** | The orchestration hub. Defines provider interfaces, routes requests. |
| **Provider** | A pluggable capability module. See specific provider notes. |
| **[[StoreProvider]]** | Provider for data persistence and graph operations. |
| **[[EmbeddingProvider]]** | Provider for vector generation. |
| **[[LLMProvider]]** | Provider for text generation. |
| **[[IngestionProvider]]** | Provider for data transformation and import. |
| **[[ValidationProvider]]** | Provider for data integrity. |
| **[[AnalyticsProvider]]** | Provider for graph health and metrics. |
| **[[AuthoringProvider]]** | Provider for content creation assistance. |
| **[[DocStore]]** | [[StoreProvider]] implementation for text documents. |
| **[[Node]]** | The entity data model. |
| **[[Edge]]** | The relationship model (implicit in MVP, typed edges on roadmap). |
| **[[Graph Projection]]** | Inferring graph structure from non-graph data. |
| **External Interface** | How you access Roux: [[MCP Server]], [[API]], or [[CLI]]. |

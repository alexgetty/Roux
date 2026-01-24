# Roux MVP Implementation Plan

## Goal
Working personal knowledge base: `roux init ~/docs && roux serve` → Claude queries your markdown files via MCP.

## Current State
- 50+ architecture docs in `/docs/`
- 15 major decisions made and documented
- All interfaces specified (Node, providers, GraphCore, MCP tools, CLI)
- Phases 1-7 complete: scaffold, types, schemas, DocStore, Graphology, Embedding/Vector, GraphCore
- 333 tests, 100% coverage
- Ready for Phase 8: File Watcher

## Success Criteria
1. `roux init` creates config and `.roux/` cache
2. Semantic search returns relevant nodes
3. Graph traversal (neighbors, paths, hubs) works correctly
4. CRUD operations create/modify/delete markdown files
5. File watcher syncs external changes <1 second
6. Works on Alex's Obsidian vault (target: <200 nodes)
7. `roux viz` generates inspectable graph visualization for QA

---

## Implementation Phases

### Phase 1: Project Scaffold ✓
**Goal:** TypeScript project ready for TDD

**Tasks:**
- [x] Initialize npm package (`roux`)
- [x] TypeScript config (strict mode)
- [x] Vitest setup with coverage thresholds (100%)
- [x] Directory structure: `src/`, `tests/unit/`, `tests/integration/`, `tests/contracts/`
- [x] ESLint + Prettier
- [x] Build tooling (tsup or similar)

**Files created:**
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.js`
- `.prettierrc`
- `tsup.config.ts`

---

### Phase 2: Core Types & Interfaces ✓
**Goal:** All provider interfaces and data models defined with contract tests

**Tasks:**
- [x] Node interface + type guards
- [x] Edge interface (simple for MVP)
- [x] StoreProvider interface
- [x] EmbeddingProvider interface
- [x] GraphCore interface
- [x] Config types (`roux.yaml` schema)
- [x] Contract tests for each provider interface

**Key files:**
- `src/types/node.ts`
- `src/types/edge.ts`
- `src/types/provider.ts`
- `src/types/graphcore.ts`
- `src/types/config.ts`
- `src/types/index.ts`

---

### Phase 3: MCP Tool Schema Specification ✓
**Goal:** Define exact tool signatures, parameters, and response shapes before implementation

**Why:** Tools need to be ergonomic for LLM consumption. Spec first prevents rework.

**Tasks:**
- [x] Define input schema for each of 10 tools (JSON Schema)
- [x] Define response shapes (what Node fields to include, truncation rules)
- [x] Specify `get_node` neighbor context behavior (depth, fields included)
- [x] Specify `search` result format (how many, what fields, similarity scores)
- [x] Specify `get_neighbors` direction parameter and response
- [x] Specify pagination/limits strategy (context window awareness)
- [x] Document error responses for capability-based exposure
- [x] Add schemas to `docs/MCP Tools Schema.md`

**Key decision:** Changed `linkCount` to `links: LinkInfo[]` with resolved titles. StoreProvider.resolveTitles() handles the ID→title mapping per store implementation.

**Output:** `docs/MCP Tools Schema.md`

---

### Phase 4: DocStore Implementation ✓
**Goal:** File-based storage with SQLite cache

**Tasks:**
- [x] Markdown parser (frontmatter + wiki-links)
- [x] SQLite schema (nodes, embeddings, centrality)
- [x] File → Node transformation
- [x] Node → File transformation (for writes)
- [x] CRUD operations
- [x] Link resolution (case-insensitive, handle missing)
- [x] ID normalization (relative path, lowercase)
- [x] Title resolution (resolveTitles implementation)
- [x] Unit tests for each operation

**Key files:**
- `src/providers/docstore/parser.ts`
- `src/providers/docstore/cache.ts`
- `src/providers/docstore/index.ts`
- `tests/unit/docstore/`

**Dependencies:** Phase 2

---

### Phase 5: Graphology Integration ✓
**Goal:** Graph operations via graphology library

**Tasks:**
- [x] Build graph from DocStore nodes (`buildGraph()`)
- [x] get_neighbors (in/out/both directions via `getNeighborIds()`)
- [x] find_path (shortest path via `findPath()`)
- [x] get_hubs (in_degree metric via `getHubs()`)
- [x] Centrality computation (`computeCentrality()`)
- [x] Unit tests (31 tests across builder + operations)

**Key files:**
- `src/graph/builder.ts`
- `src/graph/operations.ts`
- `tests/unit/graph/builder.test.ts`
- `tests/unit/graph/operations.test.ts`

**Note:** Graph rebuild on file changes is handled by DocStore (see [[decisions/Graphology Lifecycle]]). DocStore owns the graphology instance.

**Dependencies:** Phase 4

---

### Phase 6: Embedding & Vector Providers ✓
**Goal:** Local vector generation via transformers.js + modular vector storage

**Tasks:**
- [x] VectorProvider interface in types
- [x] Fix Cache to use Float32Array (not Float64)
- [x] SqliteVectorProvider implementation (brute-force cosine similarity)
- [x] TransformersEmbeddingProvider implementation
- [x] Batch embedding support
- [x] Model ID tracking
- [x] Dimension reporting
- [x] Update DocStore to inject VectorProvider

**Key files:**
- `src/types/provider.ts` (VectorProvider interface + type guard)
- `src/providers/vector/sqlite.ts`
- `src/providers/embedding/transformers.ts`
- `tests/unit/vector/sqlite.test.ts` (22 tests)
- `tests/unit/embedding/transformers.test.ts` (14 tests)
- `tests/unit/types/provider.test.ts` (14 tests)

**Dependencies:** Phase 2 (interface), Phase 4 (storage)

---

### Phase 7: GraphCore Orchestration ✓
**Goal:** Hub that routes requests to providers. Zero functionality itself—pure delegation.

**Architecture Clarifications:**
- GraphCore does NOT own a graph instance. It calls StoreProvider methods.
- DocStore owns the graphology instance (per [[decisions/Graphology Lifecycle]])
- No lazy refresh patterns or eventual consistency—keep it simple for MVP
- **Config loading:** CLI loads `roux.yaml`, parses to `RouxConfig`, passes to `GraphCore.fromConfig(config)`. GraphCore does not touch filesystem directly.
- **StoreProvider is required:** `GraphCore.fromConfig()` throws if store not configured. No store = no data = nothing works. (See [[decisions/Provider Lifecycle]])
- **EmbeddingProvider defaults to local:** If `providers.embedding` omitted, use TransformersEmbeddingProvider automatically. Semantic search works out of the box. (See [[Config]])
- **Score conversion:** `searchByVector()` returns `distance` (lower = closer). GraphCore converts to `score` (0-1, higher = better) using `score = 1 / (1 + distance)` before returning from `search()`.

**Interface Additions Required (before implementation):**

Add to `src/types/graphcore.ts`:
```typescript
searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
getRandomNode(tags?: string[]): Promise<Node | null>;
```

Add to `src/types/provider.ts` (StoreProvider):
```typescript
getRandomNode(tags?: string[]): Promise<Node | null>;
```

Note: DocStore implements `getRandomNode()` using its internal `getAllNodeIds()` + random pick + optional tag filter via `searchByTags()`. Database-backed stores can use native random selection (e.g., `ORDER BY rand() LIMIT 1`).

**Tasks:**
- [x] Add interface methods above (with tests first per TDD)
- [x] Implement `GraphCore` class with `fromConfig(config: RouxConfig)` static factory
- [x] Provider registration (`registerStore()`, `registerEmbedding()`)
- [x] Search orchestration (embed → searchByVector → convert score → getNodes)
- [x] CRUD routing → StoreProvider (`getNode`, `createNode`, `updateNode`, `deleteNode`)
- [x] Graph ops routing → StoreProvider (`getNeighbors`, `findPath`, `getHubs`)
- [x] Tag search routing → StoreProvider (`searchByTags`)
- [x] Random node routing → StoreProvider (`getRandomNode`)
- [x] `getNode` with depth: call `getNeighbors` for in/out, count each, merge into `NodeWithContext`
- [x] Error handling: throw if store missing, EmbeddingProvider auto-defaults to local

**Test Strategy:**
- Unit tests with mocked providers (StoreProvider, EmbeddingProvider mocks)
- 100% coverage required
- Integration tests with real DocStore deferred to Phase 11

**Key files:**
- `src/types/graphcore.ts` (interface additions)
- `src/types/provider.ts` (StoreProvider interface addition)
- `src/core/graphcore.ts` (implementation)
- `tests/unit/core/graphcore.test.ts`

**Dependencies:** Phases 4, 5, 6

---

### Phase 8: File Watcher
**Goal:** Live sync of external file changes

**Tasks:**
- [ ] Chokidar integration
- [ ] Debounce (100ms)
- [ ] Add/change/delete detection
- [ ] Cache invalidation
- [ ] Graph rebuild on changes
- [ ] Re-embed modified nodes
- [ ] `.roux/` exclusion (hardcoded)
- [ ] Configurable exclusions

**Key files:**
- `src/watcher/index.ts`
- `tests/integration/watcher/`

**Dependencies:** Phases 4, 5, 6

---

### Phase 9: MCP Server
**Goal:** 10 tools exposed via Model Context Protocol

**Implementation follows Phase 3 tool schemas exactly.**

**Tools to implement:**
- [ ] `search` - semantic similarity
- [ ] `get_node` - single node with optional neighbors
- [ ] `get_neighbors` - adjacent nodes
- [ ] `find_path` - shortest path
- [ ] `get_hubs` - most central nodes
- [ ] `search_by_tags` - filter by tags
- [ ] `random_node` - discovery
- [ ] `create_node` - create document
- [ ] `update_node` - modify document
- [ ] `delete_node` - remove document

**Key files:**
- `src/mcp/server.ts`
- `src/mcp/tools/*.ts`
- `tests/integration/mcp/`

**Dependencies:** Phases 3 (schemas), 7 (GraphCore)

---

### Phase 10: CLI
**Goal:** Four commands for user interaction

**Commands:**
- [ ] `roux init <directory>` - create config and cache
- [ ] `roux serve` - start MCP server with file watching
- [ ] `roux serve --no-watch` - start without watching
- [ ] `roux status` - show stats (nodes, edges, cache freshness)
- [ ] `roux viz` - generate static HTML graph visualization for QA

**Key files:**
- `src/cli/index.ts`
- `src/cli/commands/init.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/status.ts`
- `src/cli/commands/viz.ts`
- `tests/integration/cli/`

**Visualization notes:**
- Static HTML output (force-directed graph via d3/sigma/vis.js)
- Opens in browser or outputs to file
- Future: live visualization in `roux serve` (see [[roadmap/Serve Visualization]])

**Dependencies:** Phases 7, 8, 9 (viz only needs Phase 5)

---

### Phase 11: Integration & Polish
**Goal:** End-to-end testing and real-world validation

**Tasks:**
- [ ] Integration tests: GraphCore + real DocStore + real TransformersEmbeddingProvider
- [ ] Integration tests: MCP Server + GraphCore + real providers
- [ ] E2E test: full user journey (`roux init` → `roux serve` → MCP tool calls → file changes)
- [ ] Test on Alex's Obsidian vault
- [ ] README with quickstart
- [ ] npm publish prep

**Key files:**
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/integration/mcp/`
- `tests/e2e/`

**Dependencies:** All previous phases

---

## Dependency Graph

```
Phase 1 (Scaffold)
    ↓
Phase 2 (Types/Interfaces)
    ↓
Phase 3 (MCP Tool Schemas) ──────────────────┐
    ↓                                        │
Phase 4 (DocStore)                           │
    ↓                                        │
Phase 5 (Graphology)                         │
    ↓                                        │
Phase 6 (Embeddings)                         │
    ↓                                        │
Phase 7 (GraphCore)                          │
    ↓                                        │
Phase 8 (File Watcher)                       │
    ↓                                        │
Phase 9 (MCP Server) ←───────────────────────┘
    ↓
Phase 10 (CLI)
    ↓
Phase 11 (Integration)
```

---

## Key Technical Decisions (Already Made)

| Area | Decision |
|------|----------|
| Search | GraphCore orchestrates: embed query → search vectors → return nodes |
| Vectors | Stored by StoreProvider in SQLite, brute-force search for MVP |
| IDs | File path-based (relative, lowercase, with extension) |
| Hubs | `in_degree` metric (not PageRank - O(1) vs O(n)) |
| Errors | Capability-based tool exposure, not runtime errors |
| Embeddings | transformers.js default, zero external deps. Auto-instantiated if config omits `providers.embedding`. |
| Transport | stdio for MCP (Claude Code spawns as subprocess) |
| Link titles | StoreProvider.resolveTitles() maps IDs to human-readable titles |
| Graph ownership | DocStore owns graphology instance; GraphCore delegates (no cached copy) |
| Capabilities | Config-driven at startup (read `roux.yaml`), not runtime detection |
| Graph sync | Debounced incremental (100ms) per [[decisions/Graphology Lifecycle]] |
| Config loading | CLI loads `roux.yaml`, passes `RouxConfig` to `GraphCore.fromConfig()`. GraphCore never touches filesystem. |
| Score conversion | `searchByVector()` returns distance; GraphCore converts to similarity score (0-1, higher=better) |
| Phase 7 tests | Unit tests with mocked providers. Integration tests deferred to Phase 11. |

---

## Critical Files Reference

**Architecture docs to keep open:**
- `docs/GPI.md` - what Roux is
- `docs/GraphCore.md` - orchestration hub
- `docs/StoreProvider.md` - storage interface
- `docs/DocStore.md` - MVP storage implementation
- `docs/Node.md` - data model
- `docs/MCP Server.md` - tool definitions
- `docs/MCP Tools Schema.md` - exact tool specifications
- `docs/CLI.md` - command specs
- `docs/TDD.md` - methodology

---

## Verification Plan

**After each phase:**
1. Run `npm test` - all tests pass
2. Check coverage - 100% maintained
3. Verify no TypeScript errors

**End-to-end verification:**
```bash
# 1. Install locally
npm link

# 2. Init on Alex's Obsidian vault
cd ~/path/to/obsidian-vault
roux init .

# 3. Start server
roux serve

# 4. Test via Claude Code
# - "Search for X" → returns relevant nodes
# - "What links to Y?" → shows incoming edges
# - "Create a note about Z" → creates markdown file
# - Edit file in Obsidian → changes reflect in next query (<1s)

# 5. Functional validation
# All 10 MCP tools work as specified in Phase 3 schemas
```

---

## Post-MVP / Future

See [[Roadmap]] for all deferred features with individual notes.

**Critical before shipping:** [[roadmap/Link Integrity]] — title rename breaks incoming links.

---

## Open Questions

None blocking. All 15 major decisions documented in `docs/Decisions.md`.

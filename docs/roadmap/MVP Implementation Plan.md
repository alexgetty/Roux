# Roux MVP Implementation Plan

## Goal
Working personal knowledge base: `roux init ~/docs && roux serve` → Claude queries your markdown files via MCP.

## Current State
- 50+ architecture docs in `/docs/`
- 15 major decisions made and documented
- All interfaces specified (Node, providers, GraphCore, MCP tools, CLI)
- Phases 1-10 complete: scaffold, types, schemas, DocStore, Graphology, Embedding/Vector, GraphCore, File Watcher, MCP Server, CLI
- 517+ tests, 100% coverage
- Red team audits completed (rounds 2-7), tech debt documented in `docs/issues/`
- Ready for Phase 11: Integration & Polish

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

### Phase 8: File Watcher ✓
**Goal:** Live sync of external file changes. User edits in Obsidian → Roux sees it in <2 seconds.

**Architecture Decision:** Watcher lives inside DocStore, not as a standalone module.
- DocStore is the only StoreProvider that needs filesystem watching
- Other stores (Neo4j, SQLite) would use database-level change notifications
- Chokidar is a DocStore dependency, not a core Roux dependency

**DocStore Methods to Add:**
```typescript
startWatching(onChange?: (changedIds: string[]) => void): void
stopWatching(): void
isWatching(): boolean
```

The `onChange` callback notifies the serve layer which nodes changed, enabling re-embedding coordination at the CLI/serve level. DocStore handles cache/graph updates internally; the serve layer handles embedding generation.

**Tasks:**
- [x] Add `startWatching()`, `stopWatching()`, `isWatching()` to DocStore
- [x] Chokidar integration watching `sourceRoot` for `.md` files
- [x] Debounce (1 second) — batches rapid edits, no perceptible delay for users
- [x] Add/change/delete event handling:
  - `add`: parse file → upsert cache → queue ID
  - `change`: parse file → upsert cache → queue ID
  - `unlink`: delete from cache → delete embedding → queue ID
- [x] After debounce: rebuild graph, call `onChange(changedIds)`
- [x] Graceful parse failures: if file mid-write (truncated), log warning, skip file, retry on next event
- [x] Hardcoded exclusions: `.roux/`, `.git/`, `node_modules/`, `.obsidian/`
- [x] Unit tests for watcher lifecycle and event handling
- [x] Integration tests with real filesystem events

**Re-embedding Flow:**
DocStore does NOT have access to EmbeddingProvider. The serve layer (Phase 10) coordinates re-embedding:
1. CLI calls `docStore.startWatching(async (ids) => { ... })`
2. In callback: for each changed ID, fetch node content, call `embeddingProvider.embed()`, store via `docStore.storeEmbedding()`
3. On shutdown: `docStore.stopWatching()`

This keeps DocStore focused on storage/graph and GraphCore/CLI on embedding orchestration.

**Key files:**
- `src/providers/docstore/index.ts` (add watcher methods)
- `tests/unit/docstore/watcher.test.ts`
- `tests/integration/watcher/`

**Test Strategy:**
- Unit tests: watcher lifecycle, event handling, debounce behavior, parse failure handling
- Integration tests: real filesystem create/modify/delete detection, timing verification

**Dependencies:** Phases 4, 5, 6

---

### Phase 9: MCP Server ✓
**Goal:** 10 tools exposed via Model Context Protocol over stdio

**Implementation follows [[MCP Tools Schema]] exactly.**

#### Setup Tasks
- [x] Install `@modelcontextprotocol/sdk`
- [x] Scaffold `src/mcp/` directory structure
- [x] Create MCP server with stdio transport
- [x] Wire server to accept `GraphCore` instance

#### Response Types (implement in `src/mcp/types.ts`)
- [x] `LinkInfo` — `{ id: string, title: string }`
- [x] `NodeResponse` — `{ id, title, content, tags, links: LinkInfo[] }`
- [x] `NodeWithContextResponse` — extends `NodeResponse` with `incomingNeighbors`, `outgoingNeighbors`, `incomingCount`, `outgoingCount`
- [x] `SearchResultResponse` — extends `NodeResponse` with `score`
- [x] `HubResponse` — `{ id, title, score }`
- [x] `PathResponse` — `{ path: string[], length: number }`
- [x] `ErrorResponse` — `{ error: { code, message } }`

#### Content Truncation (implement in `src/mcp/truncate.ts`)
- [x] Primary node: 10,000 chars max
- [x] List results: 500 chars max
- [x] Neighbor context: 200 chars max
- [x] Append `... [truncated]` when truncated

#### Tool Implementations (TDD — tests first)

**Read Operations:**
- [x] `get_node` — depth=0 returns `NodeResponse`, depth=1 returns `NodeWithContextResponse`
- [x] `get_neighbors` — direction param (in/out/both), limit param
- [x] `find_path` — returns `PathResponse | null`
- [x] `get_hubs` — metric param (in_degree/out_degree), limit param
- [x] `search_by_tags` — tags array, mode param (any/all), limit param
- [x] `random_node` — optional tags filter

**Search (requires EmbeddingProvider):**
- [x] `search` — semantic similarity, returns `SearchResultResponse[]`
- [x] Dynamic exposure: only register tool if EmbeddingProvider configured

**Write Operations:**
- [x] `create_node` — title, content, tags, optional directory
- [x] `update_node` — id required, title/content/tags optional; reject title change if incoming links exist
- [x] `delete_node` — returns `{ deleted: boolean }`

#### Link Resolution
- [x] Call `StoreProvider.resolveTitles()` to populate `LinkInfo` with human-readable titles
- [x] Handle missing titles gracefully (use ID as fallback)

#### Error Handling
- [x] `INVALID_PARAMS` — schema validation failed
- [x] `NODE_EXISTS` — create_node on existing node
- [x] `NODE_NOT_FOUND` — update_node on missing node
- [x] `LINK_INTEGRITY` — update_node title change rejected (incoming links exist)
- [x] `PROVIDER_ERROR` — provider operation failed
- [x] Non-errors: `get_node` missing → `null`, `delete_node` missing → `{ deleted: false }`, `find_path` no path → `null`, empty results → `[]`

#### Phase 9 Decisions (from planning session)

| Decision | Resolution |
|----------|------------|
| `get_node` depth=1 neighbors | Split into `incomingNeighbors` and `outgoingNeighbors` arrays |
| `create_node` directory param | Already supported by DocStore (`mkdir -p` on write) |
| `update_node` title change | **Reject if incoming links exist** (MVP safe mode per [[roadmap/Link Integrity]]) |
| `_warnings` field | **Deferred to post-MVP** — no warning accumulation in Phase 9 |

#### Key Files
- `src/mcp/server.ts` — MCP server setup, tool registration
- `src/mcp/types.ts` — Response type definitions
- `src/mcp/truncate.ts` — Content truncation utilities
- `src/mcp/handlers.ts` — Individual tool handler functions
- `src/mcp/transforms.ts` — Node to response transformations
- `tests/unit/mcp/` — Unit tests (68 tests)

#### Test Strategy
- Unit tests: response type transforms, truncation logic, error mapping, all tool handlers
- 100% coverage achieved (506 total tests)
- MCP SDK callback integration deferred to Phase 11 (marked with v8 ignore)

**Dependencies:** Phases 3 (schemas), 7 (GraphCore), 8 (watcher for re-embedding coordination)

---

### Phase 10: CLI ✓
**Goal:** Four commands for user interaction + fix outstanding MCP layer issues

**Framework:** Commander.js

#### MCP Layer Fixes (from Phase 9 red-team)
Address issues from `docs/issues/MCP Layer Gaps.md` as part of this phase:

- [x] `sanitizeFilename` empty result → return `"untitled"` fallback
- [x] Type assertions without validation → add runtime checks for `direction`, `metric`, `mode`
- [x] String limit coercion → add explicit `Number()` coercion
- [x] Missing test coverage gaps (see issue doc for specifics)

#### Commands

**`roux init <directory>`**
- [x] Create `roux.yaml` with minimal defaults
- [x] Create `.roux/` directory
- [x] No-op if already initialized (print config location)
- [x] Validate directory exists

**`roux serve`**
- [x] Fail fast if not initialized (no `roux.yaml`)
- [x] Load config, instantiate providers via `GraphCore.fromConfig()`
- [x] Build/sync cache (parse files, store in SQLite)
- [x] Generate embeddings for nodes missing them
- [x] **Progress indicator** — required for embedding generation (can be hundreds of files)
- [x] Start MCP server (stdio transport)
- [x] Start file watcher, wire `onChange` to re-embed changed nodes
- [x] `--no-watch` flag disables file watching
- [x] Graceful shutdown on SIGINT/SIGTERM

**`roux status`**
- [x] Node count
- [x] Edge count
- [x] Cache freshness (last sync time)
- [x] Embedding coverage (nodes with/without embeddings)
- [x] Fail gracefully if not initialized

**`roux viz`**
- [x] Generate static HTML with D3 force-directed graph
- [x] Output to `.roux/graph.html` by default
- [x] `--output <path>` flag for custom location
- [x] `--open` flag to open in browser after generation
- [x] Node size by in-degree, color by tag (if tagged)

#### Key Files
- `src/cli/index.ts` — Commander setup, command registration
- `src/cli/commands/init.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/status.ts`
- `src/cli/commands/viz.ts`
- `src/cli/progress.ts` — Progress indicator utilities
- `tests/unit/cli/` — Unit tests for command logic (init, serve, status, viz)
- `tests/integration/cli/` — Integration tests (deferred to Phase 11)

#### Progress Indicator
`roux serve` on first run generates embeddings for all nodes. With 200+ files, this takes time. User must see progress.

Options:
- Simple: `[12/200] Generating embeddings...`
- Fancy: Progress bar with ETA

Decision: Start simple, upgrade if needed.

#### Visualization Notes
- D3 force-directed layout
- Static HTML (no server required to view)
- Nodes: circles sized by in-degree
- Edges: lines with arrows showing direction
- Hover: show node title
- Click: (future) open in Obsidian
- Future: live visualization in `roux serve` (see [[roadmap/Serve Visualization]])

**Dependencies:** Phases 7, 8, 9

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
| Graph sync | Debounced incremental (1 second). Longer debounce batches autosave spam; no perceptible delay since users aren't querying mid-edit. |
| Config loading | CLI loads `roux.yaml`, passes `RouxConfig` to `GraphCore.fromConfig()`. GraphCore never touches filesystem. |
| Score conversion | `searchByVector()` returns distance; GraphCore converts to similarity score (0-1, higher=better) |
| Phase 7 tests | Unit tests with mocked providers. Integration tests deferred to Phase 11. |
| CLI framework | Commander.js — familiar, minimal, boring, works |
| Visualization | D3 force-directed graph. Static HTML output. |
| Progress | Required for `roux serve` embedding generation. Simple counter format: `[12/200] Generating embeddings...` |

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

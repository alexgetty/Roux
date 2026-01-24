# Roux MVP Implementation Plan

## Goal
Working personal knowledge base: `roux init ~/docs && roux serve` → Claude queries your markdown files via MCP.

## Current State
- 50+ architecture docs in `/docs/`
- 15 major decisions made and documented
- All interfaces specified (Node, providers, GraphCore, MCP tools, CLI)
- Zero source code (intentional—TDD methodology)

## Success Criteria
1. `roux init` creates config and `.roux/` cache
2. Semantic search returns relevant nodes
3. Graph traversal (neighbors, paths, hubs) works correctly
4. CRUD operations create/modify/delete markdown files
5. File watcher syncs external changes <1 second
6. Works on Alex's Obsidian vault (target: <200 nodes)

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

### Phase 4: DocStore Implementation
**Goal:** File-based storage with SQLite cache

**Tasks:**
- [ ] Markdown parser (frontmatter + wiki-links)
- [ ] SQLite schema (nodes, embeddings, centrality)
- [ ] File → Node transformation
- [ ] Node → File transformation (for writes)
- [ ] CRUD operations
- [ ] Link resolution (case-insensitive, handle missing)
- [ ] ID normalization (relative path, lowercase)
- [ ] Title resolution (resolveTitles implementation)
- [ ] Unit tests for each operation

**Key files:**
- `src/providers/docstore/parser.ts`
- `src/providers/docstore/cache.ts`
- `src/providers/docstore/index.ts`
- `tests/unit/docstore/`

**Dependencies:** Phase 2

---

### Phase 5: Graphology Integration
**Goal:** Graph operations via graphology library

**Tasks:**
- [ ] Build graph from DocStore nodes
- [ ] get_neighbors (in/out/both directions)
- [ ] find_path (shortest path)
- [ ] get_hubs (in_degree metric for MVP)
- [ ] Centrality caching in SQLite
- [ ] Graph rebuild on file changes

**Key files:**
- `src/graph/builder.ts`
- `src/graph/operations.ts`
- `tests/unit/graph/`

**Dependencies:** Phase 4

---

### Phase 6: Embedding Provider
**Goal:** Local vector generation via transformers.js

**Tasks:**
- [ ] TransformersEmbeddingProvider implementation
- [ ] Batch embedding support
- [ ] Model ID tracking
- [ ] Dimension reporting
- [ ] Vector storage in DocStore (SQLite)
- [ ] Brute-force similarity search

**Key files:**
- `src/providers/embedding/transformers.ts`
- `src/providers/docstore/vectors.ts`
- `tests/unit/embedding/`

**Dependencies:** Phase 2 (interface), Phase 4 (storage)

---

### Phase 7: GraphCore Orchestration
**Goal:** Hub that routes requests to providers

**Tasks:**
- [ ] Provider registration and lifecycle
- [ ] Capability detection (what's available)
- [ ] Search orchestration (embed query → search vectors → return nodes)
- [ ] Request routing to appropriate providers
- [ ] Error handling and capability-based responses

**Key files:**
- `src/core/graphcore.ts`
- `src/core/capabilities.ts`
- `tests/unit/core/`
- `tests/integration/`

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
**Goal:** Three commands for user interaction

**Commands:**
- [ ] `roux init <directory>` - create config and cache
- [ ] `roux serve` - start MCP server with file watching
- [ ] `roux serve --no-watch` - start without watching
- [ ] `roux status` - show stats (nodes, edges, cache freshness)

**Key files:**
- `src/cli/index.ts`
- `src/cli/commands/init.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/status.ts`
- `tests/integration/cli/`

**Dependencies:** Phases 7, 8, 9

---

### Phase 11: Integration & Polish
**Goal:** End-to-end testing and real-world validation

**Tasks:**
- [ ] E2E test: full user journey
- [ ] Test on Alex's Obsidian vault
- [ ] README with quickstart
- [ ] npm publish prep

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
| Embeddings | transformers.js default, zero external deps |
| Transport | stdio for MCP (Claude Code spawns as subprocess) |
| Link titles | StoreProvider.resolveTitles() maps IDs to human-readable titles |

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

## Open Questions

None blocking. All 15 major decisions documented in `docs/Decisions.md`.

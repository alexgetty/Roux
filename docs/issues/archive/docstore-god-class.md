---
title: DocStore God Class
tags:
  - medium
  - modularity
  - refactor
  - resolved
---
# DocStore God Class — RESOLVED

**Status:** Closed (Commit: f4e7f7b)

## What Was Done

Extracted graph lifecycle management from DocStore into a dedicated `GraphManager` class. Split `operations.ts` into `traversal.ts` (queries) and `analysis.ts` (batch computations).

## Final Structure

```
src/graph/
  analysis.ts    — computeCentrality (batch computation)
  builder.ts     — buildGraph (unchanged)
  index.ts       — barrel exports
  manager.ts     — GraphManager class (lifecycle + coordination)
  traversal.ts   — getNeighborIds, findPath, getHubs (queries)
```

## Completed Extractions

- [x] `watcher.ts` — file watching, debouncing, extension filtering
- [x] `links.ts` — wiki-link resolution, filename index
- [x] `parser.ts` — markdown parsing, frontmatter
- [x] `cache/embeddings.ts` — embedding persistence
- [x] `cache/centrality.ts` — centrality metrics persistence
- [x] `cache/resolve.ts` — node resolution caching
- [x] `file-operations.ts` — file I/O utilities
- [x] `reader-registry.ts` — FormatReader plugin architecture
- [x] `readers/markdown.ts` — markdown format reader
- [x] `graph/manager.ts` — graph lifecycle management (NEW)
- [x] `graph/analysis.ts` — graph computations (NEW)
- [x] `graph/traversal.ts` — graph queries (NEW)

## Results

- **1021 tests passing** (was 990 before graph extraction)
- **100% code coverage maintained**
- **DocStore reduced** from 474 lines → 467 lines
- **Graph module decoupled** from storage concerns
- **GraphManager reusable** in other StoreProvider implementations

## API Changes

**Public (StoreProvider interface):** No changes. Method names unchanged.

**Internal (DocStore):**
- Replaced `private graph: DirectedGraph` with `private graphManager: GraphManager`
- Removed `ensureGraph()` (lazy init)
- Removed `rebuildGraph()` (delegated to manager)
- Updated query methods with graceful degradation

## Design Notes

**GraphManager pattern:**
```typescript
// Build returns centrality for caller to store
const centrality = graphManager.build(nodes);
storeCentrality(centrality);

// Queries with eager init
if (!graphManager.isReady()) return [];
return graphManager.getNeighborIds(id, options);
```

**Why this works:**
1. GraphManager owns graph instance lifecycle
2. Pure functions in traversal.ts remain stateless
3. DocStore coordinates cache + graph + vector operations
4. Graceful degradation on pre-sync queries
5. No callbacks or complex state management

## Test Coverage

- 22 GraphManager unit tests
- 7 index export tests
- 25 traversal (query) tests
- 2 analysis (computation) tests
- 8 builder tests
- Graceful degradation tests in docstore.test.ts
- All existing 1019 tests passing

## Follow-up

BaseStoreProvider architecture identified as next step — see [[BaseStoreProvider Architecture]].

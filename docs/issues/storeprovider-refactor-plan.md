---
title: StoreProvider Refactor Plan
tags:
  - architecture
  - refactor
  - store-provider
  - plan
---
# StoreProvider Refactor Plan

**Status:** Draft — working through open questions  
**Prerequisite:** [[Provider Interface Naming Convention]] (separate PR)

## Goal

Extract all shared store logic into an abstract `StoreProvider` class. DocStore extends it, implementing only storage-specific operations.

## Target Architecture

```
StoreInterface (contract — 15 methods)
       ↑ implements
StoreProvider (abstract class — owns GraphManager + VectorInterface)
  ├── 6 concrete methods (graph ops, vector ops, getRandomNode)
  ├── 5 default implementations, overridable (searchByTags, listNodes, etc.)
  ├── 2 abstract primitives (loadAllNodes, getNodesByIds)
  └── 5 abstract CRUD methods
       ↑ extends
DocStore (files + SQLite cache)
  ├── Implements 7 abstract methods
  ├── Overrides 5 defaults for SQLite performance
  └── Owns: Cache, FileWatcher, ReaderRegistry
```

## Method Classification

| Method | Base Class | DocStore |
|--------|-----------|----------|
| `getNeighbors` | **Concrete** (GraphManager) | Inherited |
| `findPath` | **Concrete** (GraphManager) | Inherited |
| `getHubs` | **Concrete** (GraphManager) | Inherited |
| `storeEmbedding` | **Concrete** (VectorInterface) | Inherited |
| `searchByVector` | **Concrete** (VectorInterface) | Inherited |
| `getRandomNode` | **Concrete** (generic algorithm) | Inherited |
| `searchByTags` | **Default** (in-memory filter) | **Override** (SQLite query) |
| `listNodes` | **Default** (in-memory filter) | **Override** (SQLite query) |
| `nodesExist` | **Default** (getNodesByIds check) | **Override** (SQLite IN clause) |
| `resolveTitles` | **Default** (getNodesByIds map) | **Override** (SQLite SELECT) |
| `resolveNodes` | **Default** (resolveNames pure fn) | **Override** (cache.resolveNodes) |
| `createNode` | **Abstract** | Implements (file write + cache) |
| `updateNode` | **Abstract** | Implements (file write + cache) |
| `deleteNode` | **Abstract** | Implements (file delete + cache) |
| `getNode` | **Abstract** | Implements (cache lookup) |
| `getNodes` | **Abstract** | Implements (cache lookup) |
| `loadAllNodes` | **Abstract** (protected) | Implements (cache.getAllNodes) |
| `getNodesByIds` | **Abstract** (protected) | Implements (cache.getNodes) |

## Implementation Phases

### Phase 1: Extract `resolveNames` to shared location

The base class needs the `resolveNames` pure function for its default `resolveNodes`. Currently lives in `src/providers/docstore/cache/resolve.ts`.

### Phase 2: Create StoreProvider abstract class

New file: `src/providers/store.ts` (~120 lines)

### Phase 3: Refactor DocStore to extend StoreProvider

DocStore shrinks ~50 lines. Removes graph/vector methods, inherits from base.

### Phase 4: Update exports

### Phase 5: Tests

New `tests/unit/providers/store.test.ts` + all existing tests pass unchanged.

## Open Questions

See discussion thread — working through these one at a time.

## Files Modified

| File | Action |
|------|--------|
| `src/providers/store.ts` | **CREATE** — abstract StoreProvider |
| `src/providers/resolve.ts` | **CREATE** — extracted pure function |
| `src/providers/index.ts` | **EDIT** — add exports |
| `src/providers/docstore/index.ts` | **EDIT** — extend base, remove inherited methods |
| `src/providers/docstore/cache/resolve.ts` | **EDIT** — import from shared location |
| `tests/unit/providers/store.test.ts` | **CREATE** — base class tests |

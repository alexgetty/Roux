---
title: StoreProvider Refactor Plan
tags:
  - architecture
  - refactor
  - store-provider
  - plan
---
# StoreProvider Refactor Plan

**Status:** Draft — open questions resolved, pending red team  
**Ships with:** [[Provider Interface Naming Convention]] (same PR — avoids intermediate state where `StoreProvider` doesn't exist)

## Naming Convention (prerequisite rename)

Three-tier pattern established by naming convention:

| Layer | Pattern | Examples |
|-------|---------|----------|
| Contract (interface) | `[Capability]` | `Store`, `Vector`, `Embedding` |
| Abstract class | `[Capability]Provider` | `StoreProvider`, `VectorProvider` |
| Concrete class | `[Qualifier][Capability]` | `DocStore`, `SqliteVector` |

## Goal

Extract all shared store logic into an abstract `StoreProvider` class. DocStore extends it, implementing only storage-specific operations.

## Target Architecture

```
Store (interface — 15 methods)
       ↑ implements
StoreProvider (abstract class — owns GraphManager + Vector)
  ├── 6 concrete methods (graph ops, vector ops, getRandomNode)
  ├── 5 default implementations, overridable (searchByTags, listNodes, etc.)
  ├── 2 abstract primitives (loadAllNodes, getNodesByIds)
  ├── 5 abstract CRUD methods
  └── 1 abstract lifecycle (close)
       ↑ extends
DocStore (files + SQLite cache)
  ├── Implements 8 abstract methods (7 data + close)
  ├── Overrides 5 defaults for SQLite performance
  └── Owns: Cache, FileWatcher, ReaderRegistry
```

## Directory Structure

```
src/providers/
├── store/
│   ├── index.ts        ← StoreProvider abstract class
│   └── resolve.ts      ← resolveNames (owned by StoreProvider)
├── docstore/
│   ├── index.ts        ← DocStore extends StoreProvider
│   └── ...
├── embedding/
│   └── ...
└── vector/
    └── ...
```

## Method Classification

| Method | Base Class | DocStore |
|--------|-----------|----------|
| `getNeighbors` | **Concrete** (GraphManager) | Inherited |
| `findPath` | **Concrete** (GraphManager) | Inherited |
| `getHubs` | **Concrete** (GraphManager) | Inherited |
| `storeEmbedding` | **Concrete** (Vector) | Inherited |
| `searchByVector` | **Concrete** (Vector) | Inherited |
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
| `close` | **Abstract** | Implements (stop watcher, close cache, close vector) |

## Implementation Phases

### Phase 1: Extract `resolveNames` to StoreProvider module

**Why:** Base class needs this pure function for its default `resolveNodes`. Currently in `src/providers/docstore/cache/resolve.ts` — a DocStore internal path.

**Move to:** `src/providers/store/resolve.ts`
- `resolveNames()` function + `Candidate` and `ResolveMatchOptions` types
- StoreProvider (`src/providers/store/index.ts`) imports it for its default `resolveNodes()`
- Update imports in `src/providers/docstore/cache/resolve.ts` to use shared location

### Phase 2: Create StoreProvider abstract class

**New file:** `src/providers/store/index.ts`

```typescript
export interface StoreProviderOptions {
  vector?: Vector;
}

export abstract class StoreProvider implements Store {
  protected readonly graphManager = new GraphManager();
  protected readonly vector: Vector | null;

  constructor(options?: StoreProviderOptions) {
    this.vector = options?.vector ?? null;
  }

  // --- Abstract: 8 methods subclasses MUST implement ---
  protected abstract loadAllNodes(): Promise<Node[]>;
  protected abstract getNodesByIds(ids: string[]): Promise<Node[]>;
  abstract createNode(node: Node): Promise<void>;
  abstract updateNode(id: string, updates: Partial<Node>): Promise<void>;
  abstract deleteNode(id: string): Promise<void>;
  abstract getNode(id: string): Promise<Node | null>;
  abstract getNodes(ids: string[]): Promise<Node[]>;
  abstract close(): void;

  // --- Concrete: 6 methods identical across all stores ---
  async getNeighbors(id, options)    // → graphManager
  async findPath(source, target)     // → graphManager
  async getHubs(metric, limit)       // → graphManager
  async storeEmbedding(id, vec, m)   // → vector
  async searchByVector(vec, limit)   // → vector
  async getRandomNode(tags?)         // → searchByTags + loadAllNodes

  // --- Default: 5 methods with naive implementations ---
  async searchByTags(tags, mode, limit?)  // in-memory filter
  async listNodes(filter, options?)       // in-memory filter + paginate
  async nodesExist(ids)                   // getNodesByIds → Set check
  async resolveTitles(ids)                // getNodesByIds → Map
  async resolveNodes(names, options?)     // resolveNames pure function

  // --- Protected: graph lifecycle ---
  protected async syncGraph(): Promise<void>
  protected onCentralityComputed(_centrality: Map<string, CentralityMetrics>): void  // hook, default no-op
}
```

### Phase 3: Refactor DocStore to extend StoreProvider

**Changes to `src/providers/docstore/index.ts`:**

1. `class DocStore extends StoreProvider` (not `implements Store`)
2. Remove `private graphManager` field (inherited)
3. Constructor calls `super({ vector })` before own init
4. Implement abstract methods:
   - `loadAllNodes()` → `this.cache.getAllNodes()`
   - `getNodesByIds()` → `this.cache.getNodes(ids)`
   - `close()` → stop watcher, close cache, conditionally close vector
5. Override `onCentralityComputed()` → persist to cache
6. Override 5 storage-optimizable methods → delegate to cache (same as current)
7. Delete inherited methods: `getNeighbors`, `findPath`, `getHubs`, `storeEmbedding`, `searchByVector`, `getRandomNode`
8. Delete `storeCentrality()` private method (replaced by `onCentralityComputed`)
9. Replace all `this.graphManager.build()` + `this.storeCentrality()` calls → `await this.syncGraph()`

### Phase 4: Update exports

**`src/providers/index.ts`:**
```typescript
export { StoreProvider, type StoreProviderOptions } from './store/index.js';
export { DocStore } from './docstore/index.js';
```

### Phase 5: Tests

**New:** `tests/unit/providers/store.test.ts`
- `TestStore extends StoreProvider` with in-memory Maps
- Graph ops with mock data (graceful degradation, neighbor hydration)
- Vector delegation (with and without provider)
- Default implementations (searchByTags, listNodes, etc.)
- `syncGraph()` → `onCentralityComputed` hook
- `close()` contract

**Existing:** All DocStore tests pass unchanged (API identical)

## Resolved Decisions

| Question | Decision |
|----------|----------|
| `resolveNames` location | `src/providers/store/resolve.ts` — owned by StoreProvider module |
| Vector access | `protected readonly` — subclasses get full access |
| `close()` lifecycle | Abstract on base class — universal contract |
| `sync()` / watching | DocStore only — filesystem-specific, not a store abstraction |
| `loadAllNodes` sync/async | Async — future-proofs for database-backed stores |

## Files Modified

| File | Action |
|------|--------|
| `src/providers/store/index.ts` | **CREATE** — abstract StoreProvider |
| `src/providers/store/resolve.ts` | **CREATE** — extracted from docstore |
| `src/providers/index.ts` | **EDIT** — add exports |
| `src/providers/docstore/index.ts` | **EDIT** — extend base, remove inherited methods |
| `src/providers/docstore/cache/resolve.ts` | **EDIT** — import from shared location |
| `tests/unit/providers/store.test.ts` | **CREATE** — base class tests |

**Unchanged:** `src/types/provider.ts`, `src/graph/manager.ts`, all existing tests

## Verification

```bash
npm run typecheck        # No type errors
npm test                 # All tests pass (1021+ existing + new base class tests)
```

Post-refactor checks:
- `grep "private graphManager" src/providers/docstore/index.ts` → 0 matches
- `grep "getNeighbors\|findPath\|getHubs" src/providers/docstore/index.ts` → 0 matches (removed)
- DocStore line count drops from ~467 to ~415

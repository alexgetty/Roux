---
title: Provider Interface Naming Convention
tags:
  - refactor
  - naming
  - architecture
  - breaking-change
---
# Provider Interface Naming Convention

**Status:** Open
**Type:** Breaking change (minor version bump)

## Problem

Current naming conflates interfaces (contracts) with implementations:
- `StoreProvider` is an interface, but the name suggests a usable class
- When we add abstract base classes, we get awkward names like `BaseStoreProvider`
- Concrete classes like `TransformersEmbeddingProvider` and `SqliteVectorProvider` carry `Provider` suffix, which will collide with abstract class names
- `Vector` as a bare interface name collides with mathematical vectors used throughout the codebase

## Naming Convention

### Capability Categories

| Category | Role | Examples |
|----------|------|----------|
| `Store` | Owns primary data. CRUD. Source of truth. | `Store`, `DocStore` |
| `Index` | Derived lookup structure. Search/query. Read-optimized. | `VectorIndex`, `GraphIndex` |
| `Embedding` | Transforms data into representations. | `Embedding`, `TransformersEmbedding` |

### Three-Tier Type Hierarchy

| Layer | Pattern | Store | VectorIndex | Embedding |
|-------|---------|-------|-------------|-----------|
| Contract | `[Capability]` | `Store` | `VectorIndex` | `Embedding` |
| Abstract | `[Capability]Provider` | `StoreProvider` | `VectorIndexProvider` | `EmbeddingProvider` |
| Concrete | `[Qualifier][Capability]` | `DocStore` | `SqliteVectorIndex` | `TransformersEmbedding` |
| Type Guard | `is[Capability]` | `isStore` | `isVectorIndex` | `isEmbedding` |

### Word Order Rule (types only)

- `Capability*` → abstract layer (bare interface, abstract class)
- `*Capability` → concrete implementations

This signals abstraction level at a glance. `Store` and `StoreProvider` are abstract. `DocStore` is concrete.

### Type Guards (functions)

Type guards follow `is[Capability]` — a simple predicate. They sit outside the word order rule since they're functions, not types.

### Why bare names for interfaces

TypeScript convention discourages `I` prefixes and `*Interface` suffixes. Interfaces are the most fundamental abstraction — they own the bare name. If a value type is ever needed (e.g., a raw embedding vector), it gets the qualified name (`EmbeddingValue`, `VectorEntry`) since it's the less common reference.

### Why Store, not GraphStore or DataStore

`Store` was challenged as too generic — collides with Redux stores, Zustand stores, variable names like `const store: Store`. The objection was evaluated and rejected:

- `const store: Store` is idiomatic TypeScript. `const user: User`, `const cache: Cache`, `const node: Node` — the variable/type pattern is the language convention, not a naming smell.
- `Store` has no data-type collision. Unlike `Vector` (which collides with mathematical vectors the codebase actively uses) or `Embedding` (which could mean a single embedding value), `Store` is purely operational. It describes what the thing *does*, not what it *contains*.
- `DocStore implements Store` reads correctly. `StoreConfig` configures a `Store`. The hierarchy *is* the clarity — qualifiers disambiguate, the bare name doesn't need to.
- `GraphStore` or `DataStore` would add a qualifier to the most fundamental abstraction. The interface defines storage capability in general — not graph storage specifically. Concrete implementations (`DocStore`, future `SqliteStore`) add the qualifier.

### Why Index, not bare Vector

`Vector` collides with the mathematical concept used throughout the codebase (embedding arrays, similarity math). The capability isn't "a vector" — it's indexing vectors for similarity retrieval. `Index` is also a reusable category: `VectorIndex` for similarity search, [[GraphIndex Extraction|GraphIndex]] for graph traversal and centrality queries.

## Prerequisites

Before executing this rename, reconcile dependent documents that use stale vocabulary:

| Document | Currently uses | Must update to |
|----------|---------------|----------------|
| `basestoreprovider-architecture.md` | `StoreInterface` | `Store` |
| `storeprovider-refactor-plan.md` | `StoreInterface` | `Store` |

These docs were written before this convention was finalized. Executing the rename while they reference `StoreInterface` will cause confusion during the StoreProvider extraction phase.

## Changes Required

### 1. Rename interfaces in `src/types/provider.ts`

| Current | New |
|---------|-----|
| `StoreProvider` | `Store` |
| `EmbeddingProvider` | `Embedding` |
| `VectorProvider` | `VectorIndex` |

### 2. Rename concrete classes

| Current | New |
|---------|-----|
| `TransformersEmbeddingProvider` | `TransformersEmbedding` |
| `SqliteVectorProvider` | `SqliteVectorIndex` |

### 3. Update public API exports

`src/index.ts` is the breaking change surface. These exports rename:

```typescript
// Before
export { TransformersEmbeddingProvider } from './providers/embedding/index.js';
export { SqliteVectorProvider } from './providers/vector/index.js';

// After
export { TransformersEmbedding } from './providers/embedding/index.js';
export { SqliteVectorIndex } from './providers/vector/index.js';
```

### 4. Rename type guard

| Current | New |
|---------|-----|
| `isVectorProvider` | `isVectorIndex` |

Update return type to `value is VectorIndex`.

### 5. Update all imports and type annotations

Search for and replace in all `.ts` files:
- `StoreProvider` → `Store`
- `EmbeddingProvider` → `Embedding`
- `VectorProvider` → `VectorIndex`
- `TransformersEmbeddingProvider` → `TransformersEmbedding`
- `SqliteVectorProvider` → `SqliteVectorIndex`
- `isVectorProvider` → `isVectorIndex`

Key files:
- `src/types/provider.ts` — interface definitions
- `src/types/index.ts` — re-exports
- `src/types/graphcore.ts` — GraphCore interface imports
- `src/core.ts` — GraphCore uses these types
- `src/core/graphcore.ts` — error messages, type references
- `src/providers/docstore/index.ts` — implements Store
- `src/providers/vector/sqlite.ts` — implements VectorIndex, class rename
- `src/providers/embedding/*.ts` — implement Embedding, class rename
- `src/index.ts` — public API exports
- `src/cli/commands/serve.ts` — references provider types
- `src/cli/commands/status.ts` — references provider types
- `src/mcp/handlers.ts` — error messages, type references
- `src/mcp/server.ts` — tool schemas
- `src/mcp/transforms.ts` — type references
- `tests/**/*.ts` — test files reference these types

### 6. Update error messages

Error strings hardcode old names. Update to match the type name exactly:
- `'StoreProvider not registered'` → `'Store not registered'`
- `'Semantic resolution requires EmbeddingProvider'` → `'Semantic resolution requires Embedding'`
- `'StoreProvider configuration is required'` → `'Store configuration is required'`
- Any other string references in `src/core/graphcore.ts` and `src/mcp/handlers.ts`

### 7. Update JSDoc comments

Any documentation referencing the old names.

### 8. Update docs (via Roux MCP)

Per CLAUDE.md, all `.md` operations go through Roux MCP, not raw file edits.

- Rename `docs/storeprovider.md` → `docs/store.md`
- Rename `docs/VectorProvider.md` → `docs/vectorindex.md`
- Update all architecture docs referencing old type names

Known affected docs (grep for old names):
- `docs/Transformers.md`
- `docs/decisions/Default Embeddings.md`
- `docs/decisions/Vector Storage.md`
- `docs/MVP Implementation Plan.md`
- Issue docs in `docs/issues/` referencing old names
- `basestoreprovider-architecture.md` (see Prerequisites)
- `storeprovider-refactor-plan.md` (see Prerequisites)

Note: `docs/storeprovider.md` has a stale interface signature (pre-existing, separate issue tracked in [[Automated Documentation]]) — name swap only for this change.

## Not Renamed

These types are data shapes, not capability contracts. The three-tier convention applies to interfaces that define pluggable capabilities, not to result/config types:

| Type | Reason |
|------|--------|
| `ListNodesResult` | Return shape — data, not capability |
| `NodeSummary` | Return shape |
| `ResolveResult` | Return shape |
| `VectorSearchResult` | Return shape |
| `CentralityMetrics` | Return shape |
| `StoreConfig` | Configuration — describes a Store, isn't one |

## Sequencing

This rename frees `StoreProvider` and `VectorIndexProvider` as names. The [[StoreProvider Architecture]] plan will reclaim `StoreProvider` for the abstract base class.

If shipped separately: no consumer should treat the absence of `StoreProvider` as permanent — it will return as an abstract class in the next change. Prefer shipping both together if possible to avoid the intermediate state.

[[GraphIndex Extraction]] is a post-naming-change refactor — not part of this rename.

## Constraints

- **No logic changes** — this is purely mechanical renaming
- **No API changes** — external consumers see the same method signatures (names change, shapes don't)
- **All tests must pass** after rename

## Verification

```bash
# After changes:
npm run typecheck   # No type errors
npm test            # All tests pass

# Verify old interface names gone from type definitions:
grep -rn "StoreProvider" src/types/   # 0 matches
grep -rn "EmbeddingProvider" src/types/   # 0 matches
grep -rn "VectorProvider" src/types/   # 0 matches

# Verify old concrete class names gone:
grep -rn "TransformersEmbeddingProvider" src/   # 0 matches
grep -rn "SqliteVectorProvider" src/   # 0 matches

# Verify old type guard gone:
grep -rn "isVectorProvider" src/   # 0 matches

# Verify no stale error messages or string references:
grep -rn "StoreProvider\|EmbeddingProvider\|VectorProvider" src/   # 0 matches outside comments

# Verify test string assertions updated:
grep -rn "'.*StoreProvider\|\".*StoreProvider" tests/   # 0 matches
grep -rn "'.*EmbeddingProvider\|\".*EmbeddingProvider" tests/   # 0 matches
```

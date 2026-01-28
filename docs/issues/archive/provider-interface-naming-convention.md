---
title: provider-interface-naming-convention
tags:
  - refactor
  - naming
  - architecture
  - breaking-change
  - resolved
---
# Provider Interface Naming Convention

**Status:** Resolved (commit `245899f`)
**Type:** Breaking change (minor version bump)

## Resolution

All renames executed across 31 files. 970 unit tests pass. Zero type errors.

### Renames Applied

| Before | After |
|--------|-------|
| `StoreProvider` (interface) | `Store` |
| `EmbeddingProvider` (interface) | `Embedding` |
| `VectorProvider` (interface) | `VectorIndex` |
| `TransformersEmbeddingProvider` (class) | `TransformersEmbedding` |
| `SqliteVectorProvider` (class) | `SqliteVectorIndex` |
| `isVectorProvider` (type guard) | `isVectorIndex` |

Internal DocStore fields: `vectorProvider` → `vectorIndex`, `ownsVectorProvider` → `ownsVectorIndex`.

Error messages updated to match new names.

Contract tests added in `tests/unit/index.test.ts` verifying new names are exported and old names are absent.

## Remaining Work

- Doc renames (`docs/storeprovider.md` → `docs/store.md`, etc.) deferred to StoreProvider refactor phase
- [[StoreProvider Refactor Plan]] will reclaim `StoreProvider` as abstract base class name
- [[GraphIndex Extraction]] is a post-naming-change refactor

## Original Problem

Current naming conflated interfaces (contracts) with implementations:
- `StoreProvider` is an interface, but the name suggests a usable class
- When we add abstract base classes, we get awkward names like `BaseStoreProvider`
- Concrete classes like `TransformersEmbeddingProvider` and `SqliteVectorProvider` carry `Provider` suffix, which will collide with abstract class names
- `Vector` as a bare interface name collides with mathematical vectors used throughout the codebase

## Naming Convention Established

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

### Not Renamed

Data shapes are not capability contracts:

| Type | Reason |
|------|--------|
| `ListNodesResult` | Return shape — data, not capability |
| `NodeSummary` | Return shape |
| `ResolveResult` | Return shape |
| `VectorSearchResult` | Return shape |
| `CentralityMetrics` | Return shape |
| `StoreConfig` | Configuration — describes a Store, isn't one |

---
title: graph-index-extraction
tags:
  - roadmap
  - refactor
  - architecture
---
# GraphIndex Extraction

**Status:** Planned
**Depends on:** [[Provider Interface Naming Convention]]

## Summary

Extract graph traversal and centrality analysis into a `GraphIndex` capability following the `Index` naming category established in the naming convention.

`Index` = derived lookup structure, search/query, read-optimized. `GraphIndex` indexes the graph for traversal queries, centrality metrics, and path finding — the same relationship `VectorIndex` has to embedding similarity search.

## Scope

- Define `GraphIndex` interface (contract)
- Extract graph analysis logic from current location into a `GraphIndexProvider` abstract class
- Concrete implementation follows `[Qualifier]GraphIndex` pattern

## Open Questions

- What methods belong on `GraphIndex` vs staying on `Store`?
- Does `GraphIndex` depend on `Store` or operate independently?

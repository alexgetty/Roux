---
title: StoreProvider Refactor Plan
tags:
  - architecture
  - refactor
  - store-provider
  - plan
  - resolved
---
# StoreProvider Refactor Plan

**Status:** COMPLETED (2026-01-28)
**Prerequisite:** [[Provider Interface Naming Convention]] — COMPLETED

All 5 phases landed in commit `cddff89`. 1096 tests green, typecheck clean.

## What Shipped

- `src/providers/store/index.ts` — Abstract StoreProvider class (6 concrete, 5 default, 8 abstract methods)
- `src/providers/store/resolve.ts` — Extracted resolveNames pure function
- DocStore extends StoreProvider, dropped from 467→416 lines
- 67 new StoreProvider tests via TDD
- Bug fix: createNode/updateNode now resolve wikilinks before graph rebuild
- Case-insensitive path filters in default listNodes/resolveNodes

## Architecture

```
Store (interface)
       ↑ implements
StoreProvider (abstract class — owns GraphManager + VectorIndex)
       ↑ extends
DocStore (files + SQLite cache)
```

## Resolved Decisions

| Question | Decision |
|----------|----------|
| `resolveNames` location | `src/providers/store/resolve.ts` — owned by StoreProvider module |
| Vector access | `protected readonly` — subclasses get full access |
| `close()` lifecycle | Abstract on base class — universal contract |
| `sync()` / watching | DocStore only — filesystem-specific |
| `loadAllNodes` sync/async | Async — future-proofs for database-backed stores |

---
title: docstore-god-class
tags:
  - critical
  - modularity
  - refactor
---
# DocStore God Class

**Severity:** Critical  
**Location:** `src/providers/docstore/index.ts`

## Problem

`DocStore` is a god class implementing `StoreProvider` with 25+ methods spanning multiple concerns:
- File system operations (reading, writing, watching)
- Cache coordination
- Graph rebuilding
- Wiki-link resolution
- Vector embedding delegation

## Recommended Split

1. `docstore/index.ts` — Core CRUD, the actual provider contract
2. `docstore/watcher.ts` — File watching and event debouncing
3. `docstore/links.ts` — Wiki-link resolution logic
4. `docstore/parser.ts` — Markdown parsing and frontmatter extraction
5. `docstore/cache.ts` — SQLite cache coordination
6. `docstore/cache/` — Extracted cache concerns (embeddings, centrality, resolve)

## Progress

- [x] `watcher.ts` extracted
- [x] `links.ts` extracted
- [x] `parser.ts` exists
- [x] `cache/embeddings.ts` extracted
- [x] `cache/centrality.ts` extracted
- [x] `cache/resolve.ts` extracted
- [ ] `index.ts` — still needs review

## Verification

After refactor:
- Each module has a single responsibility
- All existing tests still pass
- New modules have dedicated unit tests

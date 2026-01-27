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
**Lines:** 617

## Problem

`DocStore` is a god class implementing `StoreProvider` with 25+ methods spanning multiple concerns:
- File system operations (reading, writing, watching)
- Cache coordination
- Graph rebuilding
- Wiki-link resolution
- Vector embedding delegation

## Specific Violations

- Lines 300-345: File watcher management belongs in separate module
- Lines 351-437: Event queue/debounce logic is infrastructure, not store logic
- Lines 439-487: Link resolution is a distinct concern
- Private methods like `collectMarkdownFiles`, `fileToNode`, `normalizeWikiLink` should be extracted

## Recommended Split

1. `docstore/store.ts` — Core CRUD, the actual provider contract
2. `docstore/watcher.ts` — File watching and event debouncing
3. `docstore/links.ts` — Wiki-link resolution logic

## Verification

After refactor:
- No single file exceeds 300 lines
- Each module has a single responsibility
- All existing tests still pass

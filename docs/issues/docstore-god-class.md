---
title: docstore-god-class
tags:
  - medium
  - modularity
  - refactor
---
# DocStore God Class

**Severity:** Medium (was Critical)  
**Location:** `src/providers/docstore/index.ts`

## Problem

`DocStore` was a god class implementing `StoreProvider` with 25+ methods spanning multiple concerns:
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
7. `docstore/file-operations.ts` — Generic file I/O utilities
8. `docstore/reader-registry.ts` — FormatReader plugin architecture
9. `docstore/readers/` — Format-specific readers (markdown.ts)

## Progress

- [x] `watcher.ts` extracted (file watching, debouncing, extension filtering)
- [x] `links.ts` extracted (wiki-link resolution, filename index)
- [x] `parser.ts` exists (markdown parsing, frontmatter)
- [x] `cache/embeddings.ts` extracted
- [x] `cache/centrality.ts` extracted
- [x] `cache/resolve.ts` extracted
- [x] `file-operations.ts` extracted (getFileMtime, collectFiles, validatePath, readFileContent)
- [x] `reader-registry.ts` created (FormatReader interface, ReaderRegistry, createDefaultRegistry)
- [x] `readers/markdown.ts` created (MarkdownReader implementing FormatReader)
- [x] Graceful degradation: sync() logs and skips parse errors instead of crashing
- [x] Removed fileWatcher constructor param (internal implementation detail)

## Remaining

- `index.ts` still coordinates cache, graph, and vector operations
- Consider: Extract graph rebuilding to dedicated module?
- Consider: Extract vector delegation to separate concern?

## Verification

After refactor:
- 969 tests pass
- 100% code coverage maintained
- Each module has single responsibility
- FormatReader enables future multi-format support without touching DocStore

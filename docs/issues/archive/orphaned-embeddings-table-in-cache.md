---
title: Orphaned Embeddings Table in Cache
tags:
  - issue
  - cleanup
  - archived
---
# Orphaned Embeddings Table in Cache — ARCHIVED

> **Status:** Resolved. Dead code removed.

## What Was Removed

- `src/providers/docstore/cache/embeddings.ts` — unused module
- `tests/unit/docstore/cache/embeddings.test.ts` — tests for dead code
- `embeddings` table from cache schema
- `storeEmbedding()`, `getEmbedding()` wrapper methods
- Related type exports

## Why It Was Orphaned

All embedding operations go through `SqliteVectorIndex` with its own `vectors` table in `vectors.db`. The cache embeddings table was vestigial from an earlier architecture.

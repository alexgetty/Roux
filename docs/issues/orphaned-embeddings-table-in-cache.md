---
title: Orphaned Embeddings Table in Cache
tags:
  - dry
  - high-priority
  - cleanup
---
## Priority: HIGH

## Problem

Cache and SqliteVectorProvider independently create their own SQLite databases with separate schemas. The `embeddings` table exists in Cache but appears unused—DocStore delegates to SqliteVectorProvider which has its own `vectors` table. This creates confusion about where embeddings actually live.

## Locations

- `src/providers/docstore/cache.ts:78-84` - embeddings table in cache.db
- `src/providers/docstore/cache.ts:367-398` - storeEmbedding/getEmbedding methods
- `src/providers/vector/sqlite.ts:22-28` - vectors table in vectors.db

## Evidence

```typescript
// cache.ts:78-84 - embeddings table in cache.db (UNUSED)
CREATE TABLE IF NOT EXISTS embeddings (
  node_id TEXT PRIMARY KEY,
  model TEXT,
  vector BLOB,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

// sqlite.ts:22-28 - vectors table in vectors.db (ACTUALLY USED)
CREATE TABLE IF NOT EXISTS vectors (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  vector BLOB NOT NULL
)
```

DocStore delegates to `vectorProvider` for all embedding operations, bypassing Cache's embedding methods entirely.

## Fix

1. Grep for `cache.storeEmbedding` and `cache.getEmbedding` usage outside tests
2. If unused, remove the `embeddings` table from Cache schema
3. Remove `storeEmbedding` and `getEmbedding` methods from Cache
4. Document clearly that vectors live in SqliteVectorProvider

## Verification

After removal, all tests pass and no runtime errors occur.

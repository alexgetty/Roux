---
id: cQUuzfWj1kBi
title: cache-schema-operation-split
tags:
  - medium
  - architecture
  - docstore
---
# Cache Schema Ownership Split from Operations

**Severity:** Medium  
**Location:** `src/providers/docstore/cache.ts:49-83`

## Problem

`Cache` creates all three tables (nodes, embeddings, centrality) in `initSchema()`, but embedding/centrality operations are delegated to functions in `cache/embeddings.ts` and `cache/centrality.ts`. Schema ownership is split from operation ownership.

This means:
- Adding a column to embeddings requires editing `cache.ts` (schema) AND `cache/embeddings.ts` (operations)
- The extracted modules receive `db: Database.Database` as a param but don't own their schema

## Options

1. Move schema definition into the extracted modules (each module creates its own table if not exists)
2. Keep current approach but document the coupling explicitly

Option 1 is cleaner for swappability. Option 2 is fine if embeddings/centrality never become pluggable.

## Verification

If pursuing option 1:
- Each `cache/*.ts` module should have an `initSchema(db)` function
- `cache.ts` calls each module's init during construction

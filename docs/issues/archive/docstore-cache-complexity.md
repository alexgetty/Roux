---
id: Rm9EmGSw9JvJ
title: docstore-cache-complexity
tags:
  - high
  - modularity
  - refactor
---
# DocStore Cache Complexity

**Severity:** High  
**Location:** `src/providers/docstore/cache.ts`  
**Lines:** ~486

## Problem

SQLite data access layer doing too much. Approaching critical threshold but not there yet.

## Specific Patterns

- Lines 181-213: `searchByTags` has complex SQL generation
- Lines 272-304: `listNodes` has similar dynamic query building
- ~~Lines 306-358: `resolveNodes` contains business logic (string similarity) that doesn't belong in a cache layer~~ **RESOLVED** — `resolveNames` extracted to `src/providers/store/resolve.ts` as part of StoreProvider refactor (2026-01-28)

## Remaining Work

1. ~~Extract `resolveNodes` fuzzy matching to a utility module~~ DONE
2. Consider query builder abstraction if SQL generation patterns multiply
3. Keep under 400 lines

## Verification

After refactor:
- Cache layer only handles data access
- ~~Business logic extracted to appropriate modules~~ DONE (resolveNames)
- File under 400 lines

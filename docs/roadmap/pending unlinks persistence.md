---
title: Pending Unlinks Persistence
tags:
  - roadmap
  - docstore
  - reliability
---
# Pending Unlinks Persistence

**Status:** Deferred
**Priority:** Low
**Source:** Red team review of stable frontmatter IDs

## Problem

`pendingUnlinks` is an in-memory Map. If the process crashes/restarts during the 5-second TTL window:
- Vector index cleanup is lost
- Orphaned embeddings accumulate over time

## Current Behavior

```typescript
private pendingUnlinks = new Map<string, { path: string; timestamp: number }>();
```

No persistence across restarts.

## Why It's Acceptable

- Roux is single-user, local-first
- Process restarts during the exact 5s window are rare
- Orphaned embeddings don't affect correctness, just waste space
- Full resync cleans up any orphans

## Potential Future Fixes

1. Persist pending unlinks to SQLite cache
2. Add startup cleanup for orphaned embeddings
3. Periodic vector index vacuum

## Decision

Document as known limitation. Acceptable for current use cases.

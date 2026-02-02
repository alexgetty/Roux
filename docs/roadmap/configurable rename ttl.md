---
id: ow7TVVpKOGtl
title: Configurable Rename Ttl
tags:
  - roadmap
  - docstore
  - configuration
---
# Configurable Rename TTL

**Status:** Deferred
**Priority:** Low
**Source:** Red team review of stable frontmatter IDs

## Problem

The 5-second TTL for rename detection (`UNLINK_TTL_MS = 5000`) is hardcoded. On slow network filesystems or under heavy load, the `add` event may arrive after TTL expires, causing:
- Vector index deleted prematurely
- Node recreated without embeddings

## Current Behavior

```typescript
private readonly UNLINK_TTL_MS = 5000;
```

Tests mock via `store.UNLINK_TTL_MS = 100` but production has no configuration path.

## Proposed Fix

1. Add `renameTtlMs` to `DocStoreOptions`
2. Default to 5000ms
3. Document for network filesystem users

## Workaround

For now, users on slow filesystems should run a full resync after bulk renames.

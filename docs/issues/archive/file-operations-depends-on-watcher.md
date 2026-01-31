---
title: file-operations-depends-on-watcher
tags:
  - medium
  - architecture
  - docstore
---
# File Operations Depends on Watcher for EXCLUDED_DIRS

**Severity:** Medium  
**Location:** `src/providers/docstore/file-operations.ts:10`

## Problem

File operations (a low-level utility) imports from watcher (a higher-level component) to get `EXCLUDED_DIRS`. This inverts the natural dependency direction. Both modules need the same constant but the watcher should depend on file-ops, not vice versa.

## Fix

Extract `EXCLUDED_DIRS` to a shared constants file:

```
docstore/
  constants.ts        # EXCLUDED_DIRS lives here
  file-operations.ts  # imports from constants
  watcher.ts          # imports from constants
```

## Verification

- `file-operations.ts` should not import from `watcher.ts`
- Both modules import from `constants.ts`

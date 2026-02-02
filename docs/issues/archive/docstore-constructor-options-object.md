---
id: ECj_Q0NFXFsD
title: docstore-constructor-options-object
tags:
  - issue
  - api
  - docstore
---
# DocStore Constructor Should Use Options Object

**Severity:** Medium  
**Location:** `src/providers/docstore/index.ts:46-57`

## Problem

DocStore constructor has growing positional parameters:

```typescript
constructor(
  sourceRoot: string,
  cacheDir: string,
  vectorProvider?: VectorProvider,
  fileWatcher?: FileWatcher
)
```

Adding `fileTypeProviders` as a 5th parameter makes the signature unwieldy and order-dependent.

## Recommendation

Migrate to options object pattern:

```typescript
interface DocStoreOptions {
  sourceRoot: string;
  cacheDir: string;
  vectorProvider?: VectorProvider;
  fileWatcher?: FileWatcher;
  fileTypeProviders?: FileTypeProvider[];
}

constructor(options: DocStoreOptions)
```

## Migration

This is a breaking change. Consider:
1. Deprecation period with overloaded signatures, or
2. Major version bump, or  
3. Do it now while user base is small

## When

Address during the FileTypeProvider extraction refactor, not after.

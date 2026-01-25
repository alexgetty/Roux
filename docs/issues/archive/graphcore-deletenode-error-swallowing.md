---
title: GraphCore DeleteNode Error Swallowing
tags:
  - issue
  - graphcore
  - error-handling
---
# GraphCore DeleteNode Error Swallowing

## Problem

**Location:** `src/core/graphcore.ts:124-131`

```typescript
try {
  await store.deleteNode(id);
  return true;
} catch {
  return false;
}
```

Catches any error and returns `false`. If `store.deleteNode()` throws for filesystem permission error, caller just sees `deleted: false` with no indication why.

## Impact

- "Not found" indistinguishable from permission errors
- Silent failures mask real problems
- No way to debug deletion failures

## Suggested Fix

Distinguish "not found" from other errors:

```typescript
try {
  await store.deleteNode(id);
  return true;
} catch (error) {
  if (error instanceof NotFoundError) {
    return false;
  }
  throw error; // Re-throw unexpected errors
}
```

Or at minimum, log the error before returning false.

## References

- Red team round 2 #8

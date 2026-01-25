---
type: Issue
severity: Medium
component: Testing
---

# GraphCore Integration Test DocStore Leak

## Problem

The `fromConfig factory` integration test creates a DocStore that is never associated with the configured GraphCore, potentially leaking resources.

**Location:** `tests/integration/core/graphcore.integration.test.ts:335-367`

```typescript
it('creates working GraphCore from minimal config', async () => {
  const configuredCore = GraphCoreImpl.fromConfig({
    // ...
  });

  // ...

  // Access the store directly for sync (normally CLI does this)
  const configStore = new DocStore(sourceDir, cacheDir);  // NEW STORE
  await configStore.sync();

  const node = await configuredCore.getNode('config-test.md');
  // ...

  configStore.close();  // This closes configStore, but not the one inside configuredCore
});
```

## Issue

1. `GraphCoreImpl.fromConfig()` creates its own internal DocStore
2. Test creates a SECOND DocStore (`configStore`) for syncing
3. Only `configStore` is closed
4. The DocStore inside `configuredCore` is never closed

## Impact

- SQLite connections may not be released
- File handles may leak
- Could cause flaky tests under resource pressure

## Suggested Fix

Either:

1. Expose a `close()` method on GraphCoreImpl that closes registered providers
2. Or access the internal store for syncing instead of creating a new one
3. Or use a shared store instance

## References

- `tests/integration/core/graphcore.integration.test.ts:335-367`
- `src/core/graphcore.ts:265-293` (fromConfig)

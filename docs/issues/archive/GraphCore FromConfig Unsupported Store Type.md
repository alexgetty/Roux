---
type: Issue
severity: Medium
component: GraphCore
status: Fixed
---

# GraphCore FromConfig Unsupported Store Type

## Problem

`GraphCoreImpl.fromConfig()` silently skipped unsupported store types instead of throwing an error.

**Location:** `src/core/graphcore.ts:273-278`

## Resolution

Fixed in commit acabf0d. Now throws:

```typescript
if (config.providers.store.type === 'docstore') {
  // ... create store
} else {
  throw new Error(
    `Unsupported store provider type: ${config.providers.store.type}. Supported: docstore`
  );
}
```

Test added at `tests/unit/core/graphcore.test.ts`.

## References

- `src/core/graphcore.ts:265-293`

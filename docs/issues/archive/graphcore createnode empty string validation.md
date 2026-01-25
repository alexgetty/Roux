---
type: Issue
severity: Medium
component: GraphCore
---

# GraphCore CreateNode Empty String Validation

## Problem

`GraphCoreImpl.createNode()` validates that `id` is present but doesn't validate against empty strings.

**Location:** `src/core/graphcore.ts:95-117`

```typescript
async createNode(partial: Partial<Node>): Promise<Node> {
  const store = this.requireStore();

  if (!partial.id) {
    throw new Error('Node id is required');
  }
  // ...
}
```

## Current Behavior

- `createNode({ id: '' })` passes the `!partial.id` check (empty string is truthy in this context... wait, no - empty string is falsy)
- Actually need to verify: does `!''` evaluate to `true`? Yes it does.

## Test Gap

No explicit test for:
- `createNode({ id: '' })` — should throw
- `createNode({ id: '   ' })` — whitespace-only, should probably throw
- `createNode({ id: undefined })` — covered by existing test

## Suggested Fix

Add explicit empty string validation:

```typescript
if (!partial.id || partial.id.trim() === '') {
  throw new Error('Node id is required and cannot be empty');
}
```

## References

- `src/core/graphcore.ts:95-117`
- `tests/unit/core/graphcore.test.ts`

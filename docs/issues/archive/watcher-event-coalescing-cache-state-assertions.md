---
id: ONTYhZ1Ii6UN
title: Watcher Event Coalescing Cache State Assertions
tags:
  - issue
  - watcher
  - testing
type: '[[Test Gap]]'
priority: Low
component: '[[Watcher]]'
status: open
---
# Watcher Event Coalescing Cache State Assertions

## Problem

**Location:** `tests/unit/docstore/watcher.test.ts:361-428`

Event coalescing tests verify `onChange` callback arguments but don't assert final cache state.

Example: `add + change = add` test (lines 361-378) only checks callback count, not that the node is actually in cache with correct content.

## Why It Matters

Callback could fire with correct IDs but cache could be in wrong state. The callback is just notification—cache state is what matters.

## Specific Gaps

| Coalescing Pattern | Callback Tested | Cache Tested |
|--------------------|-----------------|--------------|
| add + change = add | ✓ | ✗ |
| change + change = change | ✓ | ✗ |
| change + unlink = unlink | ✓ | ✓ (line 403-427) |
| add + unlink = nothing | ✓ | ✗ |

## Suggested Fix

Add cache assertions to all coalescing tests:

```typescript
// For add + change
expect(await store.getNode('test.md')).toMatchObject({
  content: 'final content'
});

// For add + unlink
expect(await store.getNode('transient.md')).toBeNull();
```

## References

- Red team round 5 #8
- Red team round 6 #6
- Red team round 7 #2

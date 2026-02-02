---
id: LGOgXIk__mgv
title: EXCLUDED_DIRS Immutability Test Is Weak
tags:
  - issue
  - watcher
  - testing
---
# EXCLUDED_DIRS Immutability Test Is Weak

**Type:** Test Gap
**Priority:** Medium
**Component:** FileWatcher

## Problem

Test at `file-watcher.test.ts:662-666`:
```typescript
it('is immutable (ReadonlySet)', () => {
  // TypeScript enforces this at compile time
  // We just verify the type exists and has expected values
  expect(EXCLUDED_DIRS).toBeDefined();
});
```

This doesn't test immutability at all. TypeScript types don't exist at runtime. Someone could cast and mutate.

## Options

1. Delete the test (it tests nothing)
2. Actually test runtime immutability:

```typescript
it('cannot be mutated at runtime', () => {
  const originalSize = EXCLUDED_DIRS.size;
  
  // Type assertion to bypass TS protection
  const mutable = EXCLUDED_DIRS as Set<string>;
  
  // These should fail silently or throw depending on implementation
  expect(() => mutable.add('evil')).not.toThrow();
  expect(EXCLUDED_DIRS.size).toBe(originalSize); // Unchanged
});
```

Or use `Object.freeze()` on the Set if runtime immutability matters.

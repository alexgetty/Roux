---
title: docstore-id-default-test-gap
tags:
  - issue
  - test-gap
  - docstore
---
# DocStore `id` Default Test Gap

**Priority:** Medium  
**Type:** test-gap

## Problem

No test verifies that DocStore defaults `id` to `'docstore'` when not provided in options.

## Evidence

```typescript
// docstore/index.ts:74
const { id = 'docstore', ... } = options;
```

But in `tests/unit/docstore/docstore.test.ts`, no assertion like:
```typescript
expect(store.id).toBe('docstore');
```

## Fix

Add test in `docstore.test.ts`:

```typescript
it('defaults id to "docstore" when not provided', () => {
  const store = new DocStore({ sourceRoot: tempDir, cacheDir: cacheDir });
  expect(store.id).toBe('docstore');
  store.close();
});

it('uses provided id when specified', () => {
  const store = new DocStore({ sourceRoot: tempDir, cacheDir, id: 'custom-store' });
  expect(store.id).toBe('custom-store');
  store.close();
});
```

## Verification

Tests pass.

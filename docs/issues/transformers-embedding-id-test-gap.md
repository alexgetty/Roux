---
title: transformers-embedding-id-test-gap
tags:
  - issue
  - test-gap
  - embedding
---
# TransformersEmbedding `id` Default Test Gap

**Priority:** Medium  
**Type:** test-gap

## Problem

No test verifies that TransformersEmbedding defaults `id` to `'transformers-embedding'` when not provided in options.

## Evidence

```typescript
// transformers.ts:24
const { id = 'transformers-embedding', ... } = options;
```

But in `tests/unit/embedding/transformers.test.ts`, no assertion like:
```typescript
expect(provider.id).toBe('transformers-embedding');
```

## Fix

Add test in `transformers.test.ts`:

```typescript
describe('id field', () => {
  it('defaults to "transformers-embedding" when not provided', () => {
    const provider = new TransformersEmbedding();
    expect(provider.id).toBe('transformers-embedding');
  });

  it('uses provided id when specified', () => {
    const provider = new TransformersEmbedding({ id: 'custom-embedding' });
    expect(provider.id).toBe('custom-embedding');
  });
});
```

## Verification

Tests pass.

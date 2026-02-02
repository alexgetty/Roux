---
id: BN6dytRrW3A-
title: embeddings-empty-vector-untested
tags:
  - medium
  - test-gap
  - cache
---
# Embeddings Empty Vector Untested

**Severity:** Medium  
**Location:** `src/providers/docstore/cache/embeddings.ts:14-51`

## Problem

No test exists for storing/retrieving an empty vector `[]`. The code handles it correctly (produces 0-byte buffer, reconstructs to empty array), but this edge case is untested.

```typescript
const buffer = Buffer.from(new Float32Array([]).buffer);  // 0 bytes
```

## Why Medium

- Embedding providers never generate empty vectors
- Not reachable in normal usage
- Code works correctly by inspection

## Recommended Fix

Add edge case test for empty vector to document behavior:

```typescript
it('handles empty vector', () => {
  storeEmbedding(db, 'test.md', [], 'model');
  const result = getEmbedding(db, 'test.md');
  expect(result?.vector).toEqual([]);
});
```

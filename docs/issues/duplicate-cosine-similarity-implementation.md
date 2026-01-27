---
title: Duplicate Cosine Similarity Implementation
tags:
  - dry
  - high-priority
  - refactor
---
## Priority: HIGH

## Problem

Two nearly identical cosine similarity/distance implementations exist in the codebase. Both compute the same mathematical operation with minor signature differences.

## Locations

- `src/core/graphcore.ts:258-269` - `cosineSimilarity()` method
- `src/providers/vector/sqlite.ts:155-175` - `cosineDistance()` function

## Evidence

```typescript
// graphcore.ts:258-269
private cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// sqlite.ts:155-175
function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    magnitudeA += a[i]! * a[i]!;
    magnitudeB += b[i]! * b[i]!;
  }
  // ... returns 1 - similarity
}
```

## Fix

1. Create shared utility (e.g., `src/utils/math.ts`)
2. Export both `cosineSimilarity` and `cosineDistance` (latter as `1 - similarity`)
3. Update both call sites to use shared implementation

## Verification

Both files import from the same module; `npm run test` passes.

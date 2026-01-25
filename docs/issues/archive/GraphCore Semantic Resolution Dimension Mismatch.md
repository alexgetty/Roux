---
type: Issue
severity: Medium
component: GraphCore
status: Handled
---

# GraphCore Semantic Resolution Dimension Mismatch

## Problem

What happens if embedding dimensions don't match during semantic resolution?

## Resolution

This is already handled in `src/core/graphcore.ts:217-223`:

```typescript
// Validate dimensions match
if (queryVectors.length > 0 && candidateVectors.length > 0) {
  const queryDim = queryVectors[0]!.length;
  const candidateDim = candidateVectors[0]!.length;
  if (queryDim !== candidateDim) {
    throw new Error(
      `Embedding dimension mismatch: query=${queryDim}, candidate=${candidateDim}`
    );
  }
}
```

Throws a descriptive error when dimensions don't match.

## References

- `src/core/graphcore.ts:217-223`

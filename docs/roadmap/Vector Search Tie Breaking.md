---
title: Vector Search Tie Breaking
tags:
  - roadmap
type: Enhancement
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Search & Query
---
# Vector Search Tie-Breaking

When vectors have identical distances, which results survive depends on SQLite row order (insertion order). Deterministic but arbitrary.

## Current Behavior

No secondary sort key. First-inserted wins ties.

## When This Matters

- Duplicate documents (same content = same embedding = same distance)
- Tests asserting exact order
- User expectations like "prefer newer" or "prefer shorter ID"

## Why It's Deferred

Exact ties are extremely rare in semantic search — cosine distances are continuous floats. This only matters with duplicate content, and "which duplicate wins" is arbitrary anyway.

## Potential Fix

Add secondary sort key when ties occur:
- **ID** — deterministic, stable across runs
- **Timestamp** — "prefer newer" semantics
- **Path length** — "prefer shallower" in hierarchy

```typescript
if (heap.size() < limit) {
  heap.push({ id: row.id, distance });
} else if (distance < heap.peek()!.distance || 
           (distance === heap.peek()!.distance && id < heap.peek()!.id)) {
  // Secondary sort by ID for stability
}
```

## Trigger

Implement if duplicate content becomes a real use case or tests need deterministic ordering.

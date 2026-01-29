---
type: Feature
status: Proposed
priority: P2
effort: S
phase: Post-MVP
category: Search & Query
---

# Feature - Neighbor Direction

Differentiate incoming vs outgoing neighbors in `get_node` response.

## Summary

When `get_node` returns neighbors (depth=1), distinguish which direction each neighbor comes from.

## Problem

Current `NodeWithContextResponse`:
```typescript
{
  neighbors: NodeResponse[];  // Mixed bag
  incomingCount: number;
  outgoingCount: number;
}
```

We know the counts, but the `neighbors` array doesn't indicate direction.

## Options

### 1. Split Arrays
```typescript
{
  incomingNeighbors: NodeResponse[];
  outgoingNeighbors: NodeResponse[];
}
```
**Pros:** Clear separation
**Cons:** Breaking change to response shape

### 2. Direction Field
```typescript
{
  neighbors: Array<NodeResponse & { direction: 'in' | 'out' }>;
}
```
**Pros:** Single array, explicit direction
**Cons:** Extends NodeResponse shape

### 3. Ordered with Counts as Boundaries
```typescript
{
  neighbors: NodeResponse[];  // [outgoing..., incoming...]
  outgoingCount: number;      // First N are outgoing
  incomingCount: number;      // Remaining are incoming
}
```
**Pros:** No schema change
**Cons:** Implicit, error-prone

## Recommendation

Option 2 — explicit is better than implicit, minimal schema change.

## Complexity

Medium — affects response shape, may need MCP schema version bump.

## References

- [[MCP Tools Schema#NodeWithContextResponse]] — Current spec
- [[MCP Tools Schema#get_node]] — Tool definition

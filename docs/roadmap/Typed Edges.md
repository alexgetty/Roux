---
id: xukQnhwhIkv9
title: Typed Edges
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: L
phase: Future
category: Graph & Links
---
# Feature - Typed Edges

First-class edge model with type and weight properties.

## Summary

Promote edges from implicit string arrays to explicit entities with metadata.

## Current State

Edges are implicit — stored as string IDs in `Node.outgoingLinks`:
```typescript
outgoingLinks: ["note-a.md", "note-b.md"]
```

No edge properties (type, weight, metadata).

## Proposed

Explicit Edge model:
```typescript
interface Edge {
  source: string;
  target: string;
  type?: string;      // "parent", "related", "cites"
  weight?: number;    // For weighted traversals
  properties?: Record<string, unknown>;
}
```

## Use Cases

- **Typed traversal:** "Find all nodes this CITES"
- **Weighted paths:** Shortest path by weight, not hop count
- **Relationship modeling:** Parent/child, prerequisite, etc.

## Edge Type Detection

For markdown, infer types from context:
- `#parent [[X]]` → edge type "parent"
- `> Quote from [[X]]` → edge type "cites"
- Bare `[[X]]` → edge type "related" (default)

## Storage

- Separate `edges` table in SQLite
- Or denormalized JSON in nodes table
- StoreProvider interface already has `NeighborOptions.type`

## Complexity

Medium-High — affects data model, parsing, storage, queries.

## References

- [[Edge]] — Current model
- [[decisions/Edge Futureproofing]] — Interface stability
- [[StoreProvider]] — NeighborOptions.type already defined

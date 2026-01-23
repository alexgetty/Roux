# Edge

Relationships between [[Node|Nodes]]. Currently implicit, with a path toward explicit typing.

## Overview

Edges connect nodes in the graph. In the current model, edges are implicit—stored as string IDs in a node's `outgoingLinks` array. Future versions may promote edges to first-class entities with properties.

## Current Model (MVP)

```typescript
interface Node {
  // ...
  outgoingLinks: string[];  // Edge targets, no metadata
}
```

Edges are directional by storage:
- The node containing `[[target]]` has the outgoing edge
- The target node has the incoming edge (computed at query time)

No edge properties, types, or weights.

## Direction in DocStore

[[DocStore]] infers direction from link placement:

```markdown
# Note A
This links to [[Note B]].
```

- **Outgoing from A**: A → B (A contains the link)
- **Incoming to B**: A → B (B is the target)

Bidirectional queries (`direction: 'both'`) return both.

## Edge Types via Frontmatter

Frontmatter property names could infer edge types:

```yaml
---
parent: "[[Parent Note]]"
related:
  - "[[Related A]]"
  - "[[Related B]]"
implements: "[[Interface Note]]"
---
```

This could produce typed edges:
- `parent` → edge type "parent"
- `related` → edge type "related"
- `implements` → edge type "implements"

Inline `[[wiki-links]]` in content would default to type "links" or "references".

## Future Model

If edges become first-class:

```typescript
interface Edge {
  source: string;           // Source node ID
  target: string;           // Target node ID
  type?: string;            // Edge type (parent, related, etc.)
  weight?: number;          // For weighted traversals
  properties?: Record<string, any>;  // Extensible metadata
}
```

This enables:
- Typed traversals: "find all `parent` edges"
- Weighted paths: shortest path by edge weight
- Edge metadata: timestamps, confidence scores, etc.

## Open Questions (Deferred)

See [[Decision - Edge Futureproofing]] for the interface stability decision.

- **When to promote edges?** Phase 3+ alongside [[IngestionProvider]]. MVP works without explicit edges.
- **Type inference**: Deferred. Revisit when typed edges ship.
- **Bidirectional edges**: Deferred. Query-time computation for now.
- **Edge storage**: Deferred. Denormalized on nodes for MVP.

## Roadmap

- **MVP**: Implicit edges via `outgoingLinks`
- **Future**: Explicit Edge model with types, likely Phase 3+ alongside [[IngestionProvider]]

## Related

- [[Node]] — Contains edges as `outgoingLinks`
- [[GraphCore]] — Defines edge operations
- [[StoreProvider]] — Handles edge storage and traversal
- [[Wiki-links]] — Primary edge syntax in [[DocStore]]
- [[Graph Projection]] — Extracts edges from documents

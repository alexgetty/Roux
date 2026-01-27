---
title: Graph Builder Narrower Interface
tags:
  - refactor
  - api-design
---
## Category: Roadmap

## Observation

`buildGraph()` in `src/graph/builder.ts` takes `Node[]` but only uses two properties:
- `id`
- `outgoingLinks`

## Consideration

Could accept a narrower interface for better reusability:

```typescript
interface GraphNode {
  id: string;
  outgoingLinks: string[];
}

export function buildGraph(nodes: GraphNode[]): DirectedGraph
```

This would allow building graphs from any source that provides IDs and links, not just full Node objects.

Low priority—current implementation works fine.

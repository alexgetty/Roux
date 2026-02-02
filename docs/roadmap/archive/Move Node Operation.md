---
id: zmY-9-Sx6rrB
type: Roadmap
priority: Medium
component: GraphCore
---
# Move Node Operation

## Overview

Add ability to move/rename nodes while preserving incoming links.

## Current State

`updateNode` can change node ID but incoming links break:

```typescript
// src/mcp/handlers.ts:335
`Cannot rename node with ${incomingNeighbors.length} incoming links`
```

The MCP handler explicitly prevents renaming nodes that have incoming links.

## Proposal

Add a `moveNode` operation that:

1. Creates node at new location
2. Updates all incoming links to point to new location
3. Deletes old node
4. Preserves outgoing links

```typescript
async moveNode(oldId: string, newId: string): Promise<Node> {
  const node = await this.getNode(oldId);

  // Find all nodes that link to oldId
  const incoming = await this.getNeighbors(oldId, { direction: 'in' });

  // Update each linking node's outgoingLinks
  for (const neighbor of incoming) {
    const updatedLinks = neighbor.outgoingLinks.map(
      link => link === oldId ? newId : link
    );
    await this.updateNode(neighbor.id, { outgoingLinks: updatedLinks });
  }

  // Create at new location, delete old
  await this.createNode({ ...node, id: newId });
  await this.deleteNode(oldId);

  return this.getNode(newId);
}
```

## Considerations

- **Atomicity** — Operation should be atomic (all or nothing)
- **File rename** — For DocStore, this means renaming the underlying file
- **Graph rebuild** — May need to rebuild graph after move
- **Embedding** — Move embedding to new ID

## MCP Tool

```typescript
{
  name: 'move_node',
  description: 'Move/rename a node, updating all incoming links',
  inputSchema: {
    type: 'object',
    properties: {
      old_id: { type: 'string', description: 'Current node ID' },
      new_id: { type: 'string', description: 'New node ID' }
    },
    required: ['old_id', 'new_id']
  }
}
```

## References

- `src/mcp/handlers.ts:335` (current rename restriction)
- `src/core/graphcore.ts` (updateNode, deleteNode)

---
title: node rename with link updates
tags:
  - roadmap
  - feature
  - deferred
---
# Feature - Node Rename with Link Updates

Enable renaming a node's file (changing its ID) while maintaining graph integrity.

## Summary

Currently `update_node` can change a node's title in frontmatter, but:
- The file stays at its original path
- The incoming-link check guards a rename that never actually happens
- Title and filename can drift out of sync

## Current Behavior

```typescript
// src/mcp/handlers/update_node.ts:54-61
if (title !== undefined && title !== existing.title) {
  const incomingNeighbors = await ctx.core.getNeighbors(id, { direction: 'in' });
  if (incomingNeighbors.length > 0) {
    throw new McpError('LINK_INTEGRITY', `Cannot rename node with ${incomingNeighbors.length} incoming links`);
  }
}
```

The check exists, but the actual file rename doesn't happen.

## Desired Behavior

When `title` changes via `update_node`:
1. Derive new filename/path from the new title (reuse `normalizeCreateId`)
2. Rename the file on disk
3. Update the node's ID in cache
4. Update all incoming wikilink references in other nodes
5. Rebuild graph

The incoming-link check becomes meaningful — either:
- Auto-update the references (preferred)
- Reject if links can't be updated

## Why Deferred

- Incoming link rewriting is the hard part — must update content of linking files
- Atomicity concerns: file + cache + graph aren't transactional together
- MVP use case (single-user Obsidian) can manually rename via filesystem

## Scope

- `src/mcp/handlers/update_node.ts` — trigger rename logic
- `src/providers/docstore/index.ts` — implement file rename + reference updates
- `src/providers/docstore/cache.ts` — ID update support

## References

- [[Link Integrity]] — Current protection mechanism

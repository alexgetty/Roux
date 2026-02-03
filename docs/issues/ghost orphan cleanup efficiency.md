---
id: u3I5wpELDFe3
title: Ghost Orphan Cleanup Efficiency
tags:
  - issue
  - performance
  - docstore
---
# Ghost Orphan Cleanup Efficiency

## Summary

After creating and deleting ghosts in `resolveAllLinks()`, the orphan cleanup phase fetches ALL nodes from the database again to check for unreferenced ghosts. This is redundant — we already have the data needed to determine which ghosts are orphaned.

## Location

`src/providers/docstore/index.ts` — `resolveAllLinks()`, the orphan cleanup section at the end.

## Problem

```typescript
// Delete orphaned ghosts (ghosts with no incoming links)
const updatedNodes = this.cache.getAllNodes(); // ← redundant full scan
const updatedGhosts = updatedNodes.filter(n => isGhostId(n.id));

const referencedGhostIds = new Set<string>();
for (const node of updatedNodes) {
  if (isGhostId(node.id)) continue;
  for (const linkId of node.outgoingLinks) {
    if (isGhostId(linkId)) {
      referencedGhostIds.add(linkId);
    }
  }
}
```

This is O(n) for the DB query + O(n × links) to scan all outgoing links, when we could instead track referenced ghost IDs during the main resolution loop.

## Suggested Fix

Accumulate `referencedGhostIds` during the main link resolution loop (where we already iterate all real nodes and their links) instead of doing a separate pass. Combine with the `ghostsToCreate` map to identify orphans without the second `getAllNodes()` call.

## Impact

Performance degradation at scale. Not a correctness bug.

## Found By

Red team review, round 12.

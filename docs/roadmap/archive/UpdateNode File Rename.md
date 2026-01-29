---
title: update_node File Rename
tags:
  - roadmap
  - mcp
  - docstore
  - enhancement
---
# update_node File Rename

Implement actual file rename when `update_node` changes a node's title.

## Current Behavior

Title updates only modify frontmatter metadata. The file stays at its original path. The incoming-link check in the MCP handler (`handlers.ts:419-427`) guards a rename that never happens.

## Desired Behavior

When `title` changes via `update_node`:
1. Derive new filename/path from the new title
2. Rename the file on disk
3. Update the node's ID in cache
4. Update all incoming wikilink references in other nodes
5. Rebuild graph

The existing incoming-link check becomes meaningful — warn or reject if rename would break links that can't be auto-updated.

## Interim Fix

Update schema description from `'New title (renames file for DocStore)'` to `'New title (updates frontmatter only, file path unchanged)'`. Remove or document the incoming-link check as forward-looking.

## Scope

- `src/mcp/handlers.ts` — handleUpdateNode
- `src/mcp/server.ts` — schema description
- `src/providers/docstore/index.ts` — updateNode implementation
- `src/providers/docstore/cache.ts` — ID update support
- All files with incoming links — reference updates

## References

- [[MCP update_node Title Rename Mismatch]] — original issue
- `src/mcp/server.ts:223` — misleading schema description
- `src/providers/docstore/index.ts:177` — ID preservation line

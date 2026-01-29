---
title: Rename Node Support
tags:
  - roadmap
  - feature
---
# Rename Node Support

## Summary

Add the ability to rename a node's file (change its ID) while maintaining graph integrity. Currently `updateNode` can change the title in frontmatter but cannot change the filename/ID.

## Motivation

- Users commonly rename files in local markdown collections
- Title changes via `update_node` don't propagate to the filename, causing drift
- LLMs updating titles may create inconsistency between filename and display name

## Requirements

1. **rename_node** MCP tool or extend `update_node` to support ID changes
2. File moves on disk (old path → new path)
3. All incoming links rewritten to point to the new ID
4. Graph edges updated atomically
5. Cache updated to reflect the new ID
6. Naming conventions applied to the new filename (reuse `normalizeCreateId`)

## Design Considerations

- Incoming link rewriting is the hard part — must update content of linking files
- Should this be a separate `rename_node` tool or a parameter on `update_node`?
- Atomic operation: if any step fails, roll back
- What happens to embeddings keyed by old ID?

## Prior Art

- `update_node` already rejects title changes when incoming links exist (integrity guard)
- Obsidian handles renames by rewriting all backlinks automatically

## Status

Deferred — naming conventions on creation landed first. This is the natural follow-up.

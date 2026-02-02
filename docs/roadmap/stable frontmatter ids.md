---
id: qwMr7L0zGIA8
title: Stable Frontmatter Ids
tags:
  - plan
  - implementation
  - docstore
  - identity
  - complete
---
# Implementation Plan: Stable Frontmatter IDs for DocStore

**Decision:** [[decisions/Node Identity]]  
**Status:** ✅ Complete — Implemented 2026-01-31

## Summary

Decoupled node identity from file path. Node ID is now a stable 12-char nanoid stored in frontmatter. File path is mutable storage location. Wikilinks resolve via title → ID → path.

## What Shipped

| Phase | Scope |
|-------|-------|
| 1 | Parser: `id.ts`, `ParsedMarkdown.id`, `RESERVED_FRONTMATTER_KEYS` |
| 2 | Reader: `ParseResult { node, needsIdWrite }` |
| 3 | DocStore: `pause()/resume()`, `updateSourcePath()`, writeback |
| 4 | Links: Title-based resolution, fixture rewrite |
| 5 | Rename: `pendingUnlinks` stash, 5s TTL, cross-batch detection |
| 6 | MCP: `id`→`path` param rename, dual lookup |

## Red Team Fixes Applied

- Title collision warning at resolution time
- writeIdBack TOCTOU race fixed (re-read after mtime check)
- updateSourcePath now updates mtime
- MCP schema notes nanoid preference
- Fragment links stripped (`[[Note#Section]]` → `Note`)
- Space-dash edge cases documented

## Deferred to Roadmap

- [[Configurable Rename TTL]]
- [[Pending Unlinks Persistence]]

## Breaking Changes

1. **MCP API:** `create_node` parameter renamed from `id` to `path`
2. **Node IDs:** All node IDs are now 12-char nanoids in frontmatter
3. **Frontmatter Reordering:** First sync reorders keys (id, title, tags, properties)
4. **External Tooling:** Tools reading node IDs must expect nanoid format

## Test Coverage

1516 tests passing. Full coverage of all phases.

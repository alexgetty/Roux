---
id: owIeQAC_pIIC
title: Ghost Nodes For Dangling Wikilinks
tags:
  - issue
  - 0.2.x
  - graph
  - wikilinks
---
# Ghost Nodes for Dangling Wikilinks

## Status: Implemented

Ghost nodes are now fully implemented. This document serves as the design reference.

## Problem

When a note contains a wikilink to a page that doesn't exist (e.g., `[[context errors]]`), Roux currently:

1. Parses the link and includes it in the source node's `links` array
2. Uses the raw filename as the ID (e.g., `"context errors.md"`)
3. Does NOT create a node in the graph index

This creates dangling edges—links that point to nothing. Consumers can't distinguish valid links from broken ones without calling `nodes_exist` on every target.

## Intended Behavior

Ghost nodes should be first-class citizens in the graph. When Roux encounters a wikilink to a non-existent page, it should:

1. Create a real node with a deterministic ID
2. Set content to `null`
3. Derive title from the wikilink text
4. Index the node normally (including embedding the title)

## Design Decisions

### Ghost Identification
Use `content === null`. No separate `ghost` flag needed.
- Real node with empty file → `content: ""`
- Ghost node → `content: null`

Requires type change: `content: string` → `content: string | null`

### Ghost ID Generation
Deterministic hash of normalized title. Content-addressed identity.

```typescript
function ghostId(title: string): string {
  return 'ghost_' + hash(title.toLowerCase().trim());
}
```

Why deterministic:
- Cache rebuild produces same IDs (no persistence needed)
- Same wikilink text always resolves to same ghost
- Different casing (`[[API]]` vs `[[api]]`) → same ghost

### Embedding Strategy
Embed the title. Ghosts are meaningful graph citizens — a ghost with 20 incoming links is an important concept even without body content. Excluding from vector index creates artificial holes in semantic search.

Note: Short title embeddings are lower quality, but presence > absence. See [[Ghost Embedding Quality Monitoring]] for future improvements.

### Ghost Filtering
New param across relevant methods:
```typescript
ghosts: 'include' | 'only' | 'exclude'
```

| Value | Meaning |
|-------|---------|
| `'include'` | All nodes, ghosts included |
| `'only'` | Ghosts only |
| `'exclude'` | Real nodes only |

### sourceRef
Ghosts have `sourceRef: undefined`. No file exists, nothing to reference.

Cache schema changes:
```sql
source_path TEXT,           -- NULL for ghosts
source_modified INTEGER,    -- NULL for ghosts
```

### Orphan Deletion
**Implementation note:** Orphan deletion is **synchronous** (immediate), not TTL-based. When all incoming links to a ghost are removed, the ghost is deleted in the same `resolveAllLinks()` call. This simplifies implementation and avoids edge cases with stale ghosts.

Future: configurable retention policy (see [[ghost retention configuration]]).

## Expected Operation Behavior

| Operation | Ghost Behavior | Default |
|-----------|---------------|---------|
| `get_node` | Returns node with `content: null` | — |
| `nodes_exist` | `true` | — |
| `list_nodes` | Included | `ghosts: 'include'` |
| `get_neighbors(in)` | Returns nodes linking TO ghost | — |
| `get_neighbors(out)` | Empty (no content = no links) | — |
| `get_hubs` | Included in calculations | — |
| `search` | Included (title embedded) | — |
| `search_by_tags` | Excluded (no tags) | — |
| `resolve_nodes` | Resolvable by title | — |
| `find_path` | Traversable as destination | — |
| `random_node` | Excluded by default | `ghosts: 'exclude'` |

## Data Model

```typescript
interface Node {
  id: string;                          // nanoid for real, hash for ghosts
  title: string;                       // derived from wikilink text
  content: string | null;              // null for ghosts
  tags: string[];                      // empty for ghosts
  outgoingLinks: string[];             // empty for ghosts
  properties: Record<string, unknown>; // empty for ghosts
  sourceRef?: SourceRef;               // undefined for ghosts
}
```

Update `isNode` type guard to accept `content === null`.

## Ghost Lifecycle

### Creation
Triggered during `sync()` when indexing a note containing `[[Nonexistent Page]]`:
- `id`: deterministic hash of normalized title
- `title`: "Nonexistent Page"
- `content`: null
- `sourceRef`: undefined

### Promotion
When user creates a file whose title matches (case-insensitive, trimmed):

```typescript
ghost.title.toLowerCase().trim() === file.title.toLowerCase().trim()
```

Resolution:
1. Real node created with nanoid (from file)
2. Ghost deleted
3. Incoming links rewritten to point to real node's ID during `resolveAllLinks()`

**Real nodes always win resolution.** If a wikilink matches both a ghost and a real node, resolve to real node. Ghost becomes orphaned.

### Deletion
Auto-delete when all incoming links are removed (synchronous, during `resolveAllLinks()`).

## Edge Cases

### Multiple references to same ghost
All resolve to same deterministic ID (hash of normalized title).

### Case sensitivity
`[[Context Errors]]` and `[[context errors]]` produce same normalized title → same ghost ID.

### Wikilink aliases
`[[context errors|the problem with context]]` — ghost title is "context errors", not the display text.

### Ghost linking to ghost
Not possible. Ghosts have no content, therefore no outgoing links.

### Title collision with real node
Real nodes always win. Ghost becomes orphaned and auto-deletes.

### Empty wikilinks
`[[]]` (empty brackets) are ignored by the parser and do not create ghosts.

### Duplicate titles (real nodes)
Separate problem, not ghost-specific. First match wins in resolution.

## Migration

Handled automatically during `sync()`:
1. Detect dangling edges (links pointing to raw filenames)
2. Create ghost nodes for each unique target
3. Rewrite source node links to reference ghost IDs

No explicit migration command needed — sync reconciles graph state.

## Implementation Checklist

- [x] Update `Node.content` type: `string` → `string | null`
- [x] Update `isNode` type guard to accept `content === null`
- [x] Update cache schema: nullable `source_path`, `source_modified`
- [x] Update `rowToNode` to handle null sourceRef
- [x] Update `upsertNode` signature to accept null source fields
- [x] Add `ghostId()` function for deterministic ID generation
- [x] Add ghost creation in `resolveAllLinks()`
- [x] Add `ghosts` param to `list_nodes`, `random_node`
- [x] Update MCP tool schemas for new param
- [x] Add orphan detection and deletion
- [x] Embed ghost titles in vector index

## Related

- [[ghost retention configuration]] — future configurable retention policies
- [[Ghost Embedding Quality Monitoring]] — future search quality improvements

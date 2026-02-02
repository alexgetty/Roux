---
id: Cgy7Gx4NqVpZ
title: Link Integrity
tags:
  - roadmap
type: Feature
status: Proposed
priority: P0
effort: L
phase: Post-MVP
category: Graph & Links
---
# Feature - Link Integrity

Handle broken links when node title/ID changes.

## Status

**Superseded by [[decisions/Node Identity]]**

The original problem (renames break links) is solved at the architecture level by decoupling ID from file path. See the decision doc for full rationale.

## Original Problem

```
notes/algorithms.md contains: [[sorting-basics]]
User renames "sorting-basics.md" to "sorting-fundamentals.md"
Link now broken: [[sorting-basics]] → nowhere
```

## Solution

The Node Identity decision introduces:

1. **Stable IDs** — auto-generated, stored in frontmatter, never change
2. **Title-based resolution** — wikilinks use titles, not paths
3. **Three-way decoupling** — ID, title, and path are independent concerns

When a file is renamed:
- Path changes (filesystem)
- ID unchanged (frontmatter)
- Title unchanged (unless user edits it)
- Links still resolve (title → ID → new path)

## Implementation

See [[decisions/Node Identity]] for implementation details:

- `id` field in frontmatter (nanoid, 12 chars)
- Title → ID → Path resolution
- Lazy generation for existing files
- Duplicate detection on index

## Original Options (Historical)

These were considered before the identity refactor:

### 1. Scan and Update
Find all nodes linking to old ID, rewrite their content with new ID.

### 2. Reject Breaking Changes  
Check for incoming links before rename, reject if any exist.

### 3. Alias Tracking
Maintain old→new ID mapping, resolve links through alias table.

All rejected in favor of stable IDs. See decision doc for rationale.

## References

- [[decisions/Node Identity]] — the solution
- [[1.0 Vision - Node Schema]] — core node fields
- [[Wiki-links]] — link resolution logic

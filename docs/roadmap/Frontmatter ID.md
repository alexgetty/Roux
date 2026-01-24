---
type: Roadmap Feature
status: Proposed
priority: Low
phase: Future
parent: "[[DocStore]]"
---

# Feature - Frontmatter ID

Explicit ID override via frontmatter.

## Summary

Allow frontmatter `id` field to take precedence over filename-derived ID.

## Current State

MVP: ID derived from file path. `notes/ideas.md` → `notes/ideas.md`

## Use Cases

- **Stable IDs:** Rename files without breaking external references
- **Multi-format:** Same ID for `note.md` and `note.html`
- **Migration:** Preserve IDs when moving between systems

## Proposed

```yaml
---
id: my-stable-id
title: My Note
---
```

This note's ID is `my-stable-id`, not the file path.

## Resolution Order

1. Frontmatter `id` (if present)
2. File path (fallback)

## Challenges

- **Uniqueness:** Must enforce unique IDs across vault
- **Link resolution:** `[[my-stable-id]]` must find the file
- **Rename handling:** ID doesn't change when file moves

## Implementation

- Parse `id` from frontmatter during indexing
- Build ID→path lookup table
- Query by ID, resolve to path for file ops

## Complexity

Low-Medium — parsing simple, uniqueness enforcement needed.

## References

- [[decisions/Node Identity]] — ID precedence decision
- [[decisions/ID Format]] — Format specification
- [[DocStore]] — Current path-based ID

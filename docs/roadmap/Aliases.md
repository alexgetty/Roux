---
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: Graph & Links
---

# Feature - Aliases

Resolve wikilinks via frontmatter aliases.

## Summary

Allow `[[ML]]` to resolve to a note with `aliases: [ML]` in frontmatter.

## Current State

Links resolve by filename/ID only. `[[ML]]` only matches `ml.md`.

## Proposed

Parse frontmatter `aliases` field:
```yaml
---
aliases: [ML, machine-learning, AI/ML]
---
# Machine Learning Fundamentals
```

Then `[[ML]]`, `[[machine-learning]]`, and `[[AI/ML]]` all resolve to this note.

## Resolution Order

1. Exact filename match
2. Alias match (first wins if multiple notes claim same alias)

## Conflict Handling

If multiple notes claim the same alias, options:
- First indexed wins (deterministic but arbitrary)
- Error on ambiguity
- Prefer shorter filename

## Implementation

- Parse `aliases` from frontmatter during indexing
- Build alias→ID lookup table in SQLite
- Query alias table during link resolution

## Complexity

Medium — straightforward parsing, conflict handling needs decision.

## References

- [[Wiki-links]] — Link resolution
- [[decisions/MVP Scope Clarifications]] — Deferred decision
- [[decisions/Node Identity]] — ID precedence

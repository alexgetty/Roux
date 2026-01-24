---
type: Roadmap Feature
status: Proposed
priority: Critical
phase: Post-MVP
parent: "[[MCP Tools Schema]]"
---

# Feature - Link Integrity

Handle broken links when node title/ID changes.

## Summary

Renaming a node via `update_node` changes its file path (ID), silently breaking all incoming `[[wikilinks]]` from other nodes.

## Problem

```
notes/algorithms.md contains: [[sorting-basics]]
User renames "sorting-basics.md" to "sorting-fundamentals.md"
Link now broken: [[sorting-basics]] → nowhere
```

## Options

### 1. Scan and Update (Expensive but Correct)
- Find all nodes linking to old ID
- Rewrite their content with new ID
- Atomic operation (all or nothing)

**Pros:** Links never break
**Cons:** Expensive for large graphs, modifies files user didn't touch

### 2. Reject Breaking Changes (Safe but Limiting)
- Check for incoming links before rename
- Reject if any exist (return error)
- User must manually update links first

**Pros:** Never breaks links, no hidden file modifications
**Cons:** Frustrating UX, blocks legitimate renames

### 3. Alias Tracking (Complex)
- Maintain old→new ID mapping
- Resolve links through alias table
- Eventually consistent

**Pros:** Links work during transition
**Cons:** Complexity, stale aliases accumulate

## Recommendation

Option 2 for MVP safety, Option 1 as opt-in behavior later.

## Complexity

High — touches file watcher, link resolution, write operations.

## References

- [[MCP Tools Schema#update_node]] — CRITICAL warning documented
- [[Wiki-links]] — Link resolution logic
- [[DocStore]] — File write operations

---
title: Frontmatter Id
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Future
category: Storage & Providers
---
# Feature - Frontmatter ID

**Status:** Superseded by [[decisions/Node Identity]]

## Summary

This roadmap item proposed allowing explicit `id` fields in frontmatter to override filename-derived IDs.

## Superseded

The Node Identity decision (2026-01-31) implements a more comprehensive solution:

- IDs are **always** in frontmatter (not optional)
- IDs are **auto-generated** (not user-specified)
- IDs are **immutable** (never change after creation)

The original proposal was opt-in explicit IDs. The implemented solution is mandatory system-managed IDs.

See [[decisions/Node Identity]] for full details.

## Original Proposal (Historical)

Allow frontmatter `id` field to take precedence over filename-derived ID.

```yaml
---
id: my-stable-id
title: My Note
---
```

Resolution order:
1. Frontmatter `id` (if present)
2. File path (fallback)

## Why the Change

The original proposal didn't fully solve link integrity:
- Users had to manually add IDs
- Existing files without IDs still had the rename problem
- No enforcement of uniqueness

The implemented solution (auto-generated, mandatory IDs) solves these issues systematically.

## References

- [[decisions/Node Identity]] — the implemented solution
- [[roadmap/Link Integrity]] — the problem being solved

---
title: Schema Composition
tags:
  - architecture
  - plugin-system
  - deferred
---
# Schema Composition

Future enhancement for the [[Plugin System]]. Deferred from Phase 1.

## Context

Red-team audit surfaced versioning complexity when multiple plugins compose fields onto a single node type. If `issue` nodes have fields from both `plugin-pm` and `plugin-analytics`, a single `schemaVersion` is ambiguous.

## Current Decision

**Single owner per type.** Each node type is owned by one plugin with one schema and one version. Plugins don't layer onto each other's types — they define distinct types that *relate* via edges.

This keeps versioning simple: `type: 'issue', schemaVersion: 2` means plugin-pm's issue schema v2.

## Future Options

### Option 1: Version per plugin contribution

```typescript
// Node metadata
{
  schemaVersions: {
    "plugin-pm": 2,
    "plugin-analytics": 1
  }
}
```

Each plugin tracks its own version for fields it owns. Migration is plugin-scoped.

**Pros:** True composition, granular migration
**Cons:** Complex conflict resolution, migration ordering

### Option 2: Field-level versioning

Every field tracks its own version independently.

**Pros:** Maximum granularity
**Cons:** Maximum complexity, probably overkill

### Option 3: Composite schema registry

System generates a composite schema ID from the combination of contributing plugins + versions. Stored centrally, referenced by nodes.

**Pros:** Single version identifier
**Cons:** Any plugin update creates new composite, migration graph explodes

## Why Deferred

Single-owner model is sufficient for MVP and early plugin ecosystem. Composition adds versioning complexity that isn't justified until we have multiple third-party plugins wanting to extend each other's types.

## References

- [[Plugin System]]
- Red-team audit (2026-01-25)

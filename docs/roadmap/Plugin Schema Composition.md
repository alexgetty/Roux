---
title: Plugin Schema Composition
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Future
category: Plugin System
parent: '[[Plugin System]]'
---
# Plugin Schema Composition

Cross-plugin schema extension, inheritance, and versioning when plugins share nodes.

## Context

[[Plugin System]] MVP uses explicit plugin namespacing — each plugin's data lives in `node[pluginId]`. This prevents field conflicts but limits composition.

## Problem 1: Cross-Plugin Extension

Plugin A defines a robust schema. Plugin B wants to extend it with additional fields rather than duplicate it. Currently impossible — `extends` is limited to same-plugin schemas.

### Proposal: Cross-Plugin Extends

```typescript
// Plugin B schema
schema: {
  version: 1,
  extends: 'plugin-pm',  // extend another plugin's schema
  fields: [
    // Additional fields only
    { name: 'estimate', type: 'string' },
  ]
}
```

### Dependency Declaration

If extending another plugin's schema, declare the dependency:

```typescript
dependencies: {
  store: true,
  plugins: ['plugin-pm'],  // requires plugin-pm to be installed
}
```

### Composition Semantics

- Extended schema inherits all fields from parent
- Child can add fields, not remove or modify parent fields
- Validation runs parent schema first, then child additions
- Parent schema updates propagate to children (additive only)

### Risk: Tight Coupling

Cross-plugin extension creates dependencies:
- Parent plugin update could break child
- Parent removal orphans child schema
- Version compatibility matrix gets complex

Mitigation: Only allow extending from "stable" schemas explicitly marked for extension.

## Problem 2: Multi-Plugin Versioning

When multiple plugins annotate the same node, each has its own schema version. What does "schema version" mean for the node as a whole?

### Current State (MVP)

With namespacing, this is partially resolved:

```typescript
{
  id: 'issue-123.md',
  'plugin-pm': { status: 'open' },      // pm schema v2
  'plugin-analytics': { views: 42 },    // analytics schema v1
}
```

Each plugin validates only its namespace. No global "node schema version" needed.

### Future Option: Version per Plugin Contribution

If we need to track versions explicitly:

```typescript
{
  schemaVersions: {
    'plugin-pm': 2,
    'plugin-analytics': 1
  }
}
```

Each plugin tracks its own version. Migration is plugin-scoped.

**Pros:** True composition, granular migration
**Cons:** Complex conflict resolution, migration ordering

### Future Option: Composite Schema Registry

System generates a composite schema ID from contributing plugins + versions. Stored centrally, referenced by nodes.

**Pros:** Single version identifier
**Cons:** Any plugin update creates new composite, migration graph explodes

## Why Deferred

- MVP uses explicit namespacing — no shared schemas, no versioning conflicts
- Cross-plugin dependencies add complexity
- Need to see real composition patterns first
- Can add without breaking existing plugins

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]

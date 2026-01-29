---
type: Feature
status: Proposed
priority: P2
effort: L
phase: Future
category: Plugin System
parent: "[[Plugin System]]"
---
# Plugin Schema Migration

Breaking schema changes with automated data migration.

## Context

[[Plugin System]] MVP enforces additive-only schema changes. This works while Alex is the only plugin author, but becomes limiting as plugins mature and need to evolve.

## Problem

Without migrations, plugins cannot:
- Rename fields
- Change field types
- Remove deprecated fields
- Restructure data

Existing nodes become "invalid" against new schemas, requiring manual cleanup or data loss.

## Proposal

Add migration functions to schema versions:

```typescript
interface PluginSchema {
  version: number;
  fields: FieldDefinition[];
  
  // Migration from previous version
  migrate?: {
    from: number;  // e.g., 1
    transform: (data: Record<string, unknown>) => Record<string, unknown>;
  };
}
```

On plugin update:
1. Detect schema version change
2. Query all nodes with plugin namespace
3. Run migration transform on each
4. Update nodes in place
5. Log migration results

### Migration Chain

For multi-version jumps (v1 → v3), run migrations sequentially:
- v1 → v2 transform
- v2 → v3 transform

### Rollback Consideration

Migrations are one-way. Downgrading a plugin could orphan data. Options:
- Block plugin downgrade if migration ran
- Store pre-migration snapshots (expensive)
- Accept data loss on downgrade (document clearly)

## Why Deferred

- MVP scope is tight
- Alex is only plugin author — can manually migrate if needed
- Additive-only is sufficient for initial plugins
- Migration complexity is high (chains, rollback, partial failures)

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]

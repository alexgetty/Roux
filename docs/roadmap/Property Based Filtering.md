---
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: Search & Query
---

# Property-Based Filtering

## Problem

MCP search tools only filter by `tags` array and `path` prefix. There's no way to query by arbitrary frontmatter properties like `priority`, `status`, `type`, or `component`.

To find all `priority: High` issues, consumers must list all nodes and filter client-side, or bypass the MCP entirely with Grep.

## Proposal

Add `search_by_properties` or extend `list_nodes` with property filters:

```typescript
// Option A: New tool
mcp__roux__search_by_properties({
  filters: { priority: "High", status: "open" },
  mode: "all"  // all = AND, any = OR
})

// Option B: Extend list_nodes
mcp__roux__list_nodes({
  path: "docs/issues/",
  properties: { priority: "High" }
})
```

## Considerations

- Properties are schemaless — need to handle missing/undefined gracefully
- Type coercion (string "High" vs enum)
- Index strategy for performance at scale
- Interaction with existing tag filtering
- Only support equality matching initially (not ranges, arrays, nested)
- Multiple properties should AND together

## Implementation

Extend `ListFilter` type:

```typescript
interface ListFilter {
  tag?: string;
  path?: string;
  property?: Record<string, unknown>;  // NEW
}
```

SQLite query pattern:

```sql
EXISTS (
  SELECT 1 FROM json_each(properties)
  WHERE json_each.key = ? AND json_each.value = ?
)
```

## Origin

Field testing revealed users with non-standard frontmatter conventions (e.g., `type: recipe` instead of `tags: [recipe]`) cannot effectively use `list_nodes`. This enhancement addresses that gap.

## Consolidated From

- `archive/Property Filter.md`

---
type: Roadmap
priority: Medium
component: MCP, Cache
---

# Property Filter for list_nodes

## Context

Field testing revealed users with non-standard frontmatter conventions cannot use `list_nodes` tag filter. User's vault uses `type: recipe` instead of `tags: [recipe]`.

Current `tag` filter only queries the `tags` array. Other frontmatter fields stored in `properties` column are not queryable.

## Proposal

Add `property` filter to `list_nodes`:

```json
{
  "property": {"type": "recipe"},
  "limit": 10
}
```

### Implementation

1. Add `property` to `ListFilter` type:
```typescript
interface ListFilter {
  tag?: string;
  path?: string;
  property?: Record<string, unknown>;  // NEW
}
```

2. Update `cache.ts:listNodes()` to query properties JSON:
```sql
EXISTS (
  SELECT 1 FROM json_each(properties)
  WHERE json_each.key = ? AND json_each.value = ?
)
```

3. Update MCP schema and handler.

### Considerations

- Only support equality matching initially (not ranges, arrays, nested)
- Properties are stored as JSON — need to handle type coercion
- Multiple properties should AND together

## Why Deferred

MVP shipped with `tags` filter which covers standard Obsidian usage. Property filter is enhancement for non-standard vaults.

## References

- `docs/issues/List Nodes Tag Filter Limitation.md`
- Field report from Eldhrímnir vault testing (2026-01-24)

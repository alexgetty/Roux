---
id: c3KVuBdHY-cS
title: List Nodes Tag Filter Limitation
tags:
  - issue
  - mcp
  - enhancement
type: Issue
priority: Low
component: 'MCP, DocStore'
status: open
severity: Medium
phase: Resolution
---
# List Nodes Tag Filter Limitation

## Problem

`list_nodes` tag filter only searches the `tags` frontmatter array. Users with vaults using different conventions (e.g., `type: recipe` instead of `tags: [recipe]`) get empty results.

**Reproduction:**
```json
{"tag": "recipe", "limit": 5}
```

**User's frontmatter:**
```yaml
---
type: recipe
servings: 4
---
```

**Result:** `{"nodes": [], "total": 0}`

**Expected:** User expected filter to match `type: recipe`

## Root Cause

`cache.ts:261-264` queries the `tags` JSON column specifically:
```sql
EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = LOWER(?))
```

Other frontmatter fields are stored in `properties`, not queryable via tag filter.

## Impact

Users with non-standard frontmatter conventions cannot use tag filtering. Common alternative conventions:
- `type: X` (categorical typing)
- `category: X`
- `kind: X`

## Current Workaround

Users must use the `tags` frontmatter field:
```yaml
---
tags: [recipe]
type: recipe  # for their own conventions
---
```

## Suggested Fix

**Option A (Documentation):** Clearly document that `tag` filter operates on `tags` array only.

**Option B (Feature):** Add `property` filter to query arbitrary frontmatter fields:
```json
{"property": {"type": "recipe"}, "limit": 5}
```

See: `docs/roadmap/Property Filter.md`

## References

- Field report from Eldhrímnir vault testing (2026-01-24)
- `src/providers/docstore/cache.ts:261-264`

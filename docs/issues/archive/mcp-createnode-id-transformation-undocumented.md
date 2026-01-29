---
type: Issue
severity: Medium
component: MCP
phase: MVP
title: MCP create_node ID Transformation Undocumented
tags:
  - Issue
  - mcp
  - medium
---

# create_node ID Transformation Undocumented

## Problem

`sanitizeFilename` in `handlers.ts:461-470` transforms titles:
```typescript
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'untitled';
}
```

Schema only says: "Node title (becomes filename for DocStore). Returned ID will be normalized to lowercase."

Example transformation:
- Input: `"My Recipe: Curry & Rice!"`
- Output: `my-recipe-curry-rice.md`

## Impact

LLM cannot predict resulting ID without reading create response. Makes chaining operations (create then update) require extra round-trip.

## Suggested Fix

Update schema description:
```
'Node title. Filename derived by: lowercase, remove special chars, spaces to hyphens. Example: "My Recipe!" becomes "my-recipe.md"'
```

## References

- Red-team audit (2026-01-25)

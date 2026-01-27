---
type: Roadmap
status: Proposed
priority: Medium
component: MCP
title: Property-Based Filtering
tags:
  - roadmap
  - mcp
  - search
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

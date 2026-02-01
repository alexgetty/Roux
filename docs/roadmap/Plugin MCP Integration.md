---
title: Plugin Mcp Integration
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Future
category: Plugin System
parent: '[[Plugin System]]'
---
# Plugin MCP Integration

Deep MCP integration for plugin-provided tools.

## Context

[[Plugin System]] MVP allows plugins to define `mcpTools`, but integration is basic. This roadmap item covers advanced MCP features.

## Proposal

### Tool Merging

Plugin tools merge into the main MCP server seamlessly:

```typescript
// Plugin defines tools
mcpTools: [
  {
    name: 'create_issue',
    description: 'Create a new issue',
    schema: { ... },
    handler: async (params) => { ... }
  }
]

// MCP server exposes as: plugin-pm__create_issue
// Or with aliasing: create_issue (if no conflict)
```

### Tool Discovery

MCP clients can discover which tools come from which plugins:

```typescript
// New MCP method
list_plugins() → [
  { id: 'plugin-pm', tools: ['create_issue', 'list_issues', ...] },
  { id: 'plugin-time', tools: ['log_time', 'get_estimate', ...] }
]
```

### Type-Based Routing

When MCP receives operations on typed nodes, route to owning plugin's handlers if defined:

```typescript
// Plugin can intercept operations on nodes it cares about
hooks: {
  beforeCreate: async (node) => { /* validate, enrich */ },
  afterDelete: async (id) => { /* cleanup related data */ }
}
```

## Why Deferred

- Basic `mcpTools` array is sufficient for MVP
- Tool merging requires namespace collision handling
- Routing adds complexity to MCP layer
- Can add incrementally as plugin ecosystem grows

## References

- [[Plugin System]]

---
title: multi-store architecture
tags:
  - roadmap
  - architecture
  - future
---
# Multi-Store Architecture

**Status:** Future (post-MVP)

## Summary

Enable a single GraphCore instance to connect to multiple store backends, each handling different scopes of the graph.

## Use Case

A project like Eldhrimnir needs:
- **Markdown store** for human-editable content: docs, todos, roadmap, issues
- **Production database** (Neo4j, Postgres) for structured knowledge graph data

Currently this requires running separate Roux instances with no integration. Multi-store would unify them under one GraphCore with cross-store queries and links.

## Proposed Model

```typescript
graphCore.registerPlugin({
  id: 'markdown-docs',
  store: {
    scope: ['docs/**', 'todos/**', 'roadmap/**'],
    priority: 10,
    // ... StoreProvider implementation
  }
});

graphCore.registerPlugin({
  id: 'neo4j-kg',
  store: {
    scope: ['knowledge/**'],
    priority: 10,
    // ... StoreProvider implementation
  }
});
```

## Design Questions

### Routing Strategy
How does GraphCore know which store handles a given node?
- Path prefix matching (likely default)
- Explicit scope declaration per store
- Tag-based routing?

### Cross-Store Operations
When calling `search()`:
- Query all stores and merge results?
- Filter by store scope?
- Explicit store selection in query options?

### Cross-Store Links
Can `docs/todo.md` link to `knowledge/entity-123`?
- Link resolution must work across store boundaries
- Graphology layer remains unified—stores are just persistence

### Overlap Behavior
If two stores' scopes overlap:
- Priority order determines winner
- Equal priority = error at registration

## Cardinality Change

| Interface | Current | Multi-Store |
|-----------|---------|-------------|
| `store` | Required, exactly 1 | Required, 1 to many |

## Dependencies

- Unified plugin architecture (must be implemented first)
- Clear scope/routing pattern definition

## Related

- [[Library vs Application Boundaries]]
- [[GraphCore]]
- [[StoreProvider]]

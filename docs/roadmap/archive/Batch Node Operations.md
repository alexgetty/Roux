---
type: Roadmap Feature
status: Implemented
priority: High
phase: MVP
parent: "[[MCP Tools Schema]]"
---

# Feature - Batch Node Operations

Add batch primitives for efficient entity resolution and existence checks.

## Summary

Current MCP tools force N individual searches to match N names to existing nodes. Recipe import with 15 ingredients triggers 20+ searches. Need batch operations to reduce this to 1-3 calls.

## New Tools

### list_nodes
List nodes matching filter criteria with pagination.
- Filter by tag (case-insensitive)
- Filter by path prefix
- Pagination: limit (default 100, max 1000), offset

### resolve_nodes
Batch resolve names to existing nodes.
- Strategies: exact, fuzzy (default), semantic
- Threshold for fuzzy/semantic (default 0.7)
- Returns: query, match (id or null), score (0-1)

### nodes_exist
Batch existence check.
- Input: array of node IDs
- Output: map of id → boolean

## Implementation

### Types Added
- `ListFilter` - tag and path filter options
- `ListOptions` - limit and offset for pagination
- `NodeSummary` - lightweight node reference (id + title)
- `ResolveStrategy` - 'exact' | 'fuzzy' | 'semantic'
- `ResolveOptions` - strategy, threshold, filters
- `ResolveResult` - query, match, score

### Files Changed
- `src/types/provider.ts` - types and StoreProvider interface
- `src/types/graphcore.ts` - GraphCore interface
- `src/providers/docstore/cache.ts` - Cache methods
- `src/providers/docstore/index.ts` - DocStore methods
- `src/core/graphcore.ts` - GraphCore implementation
- `src/mcp/handlers.ts` - MCP handlers
- `src/mcp/server.ts` - Tool schemas

### Dependencies
- `string-similarity` - Dice coefficient for fuzzy matching

## References

- [[MCP Tools Schema]]
- [[Pagination]] — list_nodes uses offset pagination

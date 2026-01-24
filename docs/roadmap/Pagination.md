---
type: Roadmap Feature
status: Proposed
priority: Medium
phase: Post-MVP
parent: "[[MCP Tools Schema]]"
---

# Feature - Pagination

Add offset/cursor pagination to list endpoints.

## Summary

All list endpoints have `limit` but no way to page through large result sets.

## Affected Tools

- `search`
- `get_neighbors`
- `get_hubs`
- `search_by_tags`
- `list_tags` (if implemented)

## Options

### Offset-based
```json
{ "query": "...", "limit": 10, "offset": 20 }
```
Simple but fragile if data changes between pages.

### Cursor-based
```json
{ "query": "...", "limit": 10, "after": "cursor_token" }
```
Stable pagination but more complex.

## Recommendation

Offset-based for MVP simplicity. Graph data changes infrequently during a session.

## Complexity

Medium — affects multiple tools, response shape needs `hasMore` indicator.

## References

- [[MCP Tools Schema]] — Current limits

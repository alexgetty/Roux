---
title: neighbor direction
tags:
  - complete
  - archived
---
# Feature - Neighbor Direction (COMPLETE)

Differentiate incoming vs outgoing neighbors in `get_neighbors` response.

## Summary

When querying neighbors, allow filtering by link direction.

## Implementation

Added `direction` parameter to `get_neighbors` MCP tool:
- `'in'` - nodes linking TO this node
- `'out'` - nodes this node links TO  
- `'both'` - all neighbors (default)

**Location:** `src/mcp/handlers/get_neighbors.ts:16-21`

```typescript
direction: {
  type: 'string',
  enum: ['in', 'out', 'both'],
  default: 'both',
  description: 'in = nodes linking here, out = nodes linked to, both = all',
}
```

## Completed

2026-01 — Implemented as part of MCP handler modularization.

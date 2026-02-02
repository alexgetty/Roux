---
id: IisqhQ3Ev4wG
title: mcp-architecture
tags:
  - issue
  - mcp
  - refactor
  - critical
---
# MCP Architecture

Consolidated from: mcp-handlers-flat-structure, mcp-server-inline-schemas, validation-arrays-repeated-per-handler, MCP Layer Gaps (unfixed items)

## Problem

The MCP layer is a monolith split across two large files with no logical grouping.

- `handlers.ts` (559 lines): 19 flat handler functions, validation utilities, string utilities, and 4 scattered validation arrays — all in one file
- `server.ts` (522 lines): 290 lines of JSON Schema definitions inline with ~80 lines of server logic
- Schemas and handlers are divorced — changes to tool behavior require editing two distant files
- Validation arrays (`VALID_DIRECTIONS`, `VALID_METRICS`, `VALID_TAG_MODES`, `VALID_STRATEGIES`) duplicate type definitions from `types/provider.ts` and `types/edge.ts`

## Unfixed Items from MCP Layer Gaps

### MCP Server Error Handling Untested (HIGH)
`src/mcp/server.ts:308-344` — entire `setupHandlers` block (~40 lines) is `v8 ignore`. Error wrapping logic and non-Error rejection handling (`'Unknown error'` with no context) are untested.

### pathToResponse Dead Code (MEDIUM)
`src/mcp/transforms.ts:138-142` — `pathToResponse([])` returns `{ path: [], length: -1 }`. Unreachable (handlers return `null` for no path), but test validates it as expected behavior.

### Neighbor Truncation Indicator (MEDIUM)
`src/mcp/transforms.ts:84-85` — `slice(0, MAX_NEIGHBORS)` truncates to 20 neighbors with no indication truncation occurred.

## Recommended Refactor

### Split handlers by concern:
1. `mcp/handlers/read.ts` — search, get_node, get_neighbors, find_path, get_hubs
2. `mcp/handlers/write.ts` — create_node, update_node, delete_node
3. `mcp/handlers/query.ts` — list_nodes, resolve_nodes, nodes_exist, search_by_tags
4. `mcp/validation.ts` — coercion functions, validation constants

### Co-locate schemas with handlers:
Each handler module exports its schema. `server.ts` imports and assembles.

### Derive validation arrays from types:
```typescript
// types/edge.ts
export type Direction = 'in' | 'out' | 'both';
export const VALID_DIRECTIONS: readonly Direction[] = ['in', 'out', 'both'];
```

## Verification

- No handler file exceeds 200 lines
- `server.ts` under 150 lines
- Adding a new tool only touches one location
- All handler and server tests pass

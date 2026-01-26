---
type: Issue
severity: Critical
component: MCP
status: resolved
resolved: 2026-01-25T00:00:00.000Z
title: Pagerank Silent Fallback
tags:
  - issue
  - resolved
  - mcp
---

# Pagerank Silent Fallback

## Problem

Schema/handler mismatch in MCP layer:

- **MCP schema** (`server.ts:128`): `enum: ['in_degree', 'out_degree']`
- **Handler validation** (`handlers.ts:208`): `['pagerank', 'in_degree', 'out_degree']`
- **Implementation** (`operations.ts:93-96`): Pagerank silently falls back to in_degree

If a caller bypassed MCP schema validation and requested `metric: 'pagerank'`, they'd receive in_degree data without any indication. Silent wrong data.

## Impact

Contract violation. User requests X, receives Y without warning.

## Resolution

Removed `pagerank` from handler's `VALID_METRICS`. Now rejects with `INVALID_PARAMS` like the schema intends.

```typescript
// Before
const VALID_METRICS = ['pagerank', 'in_degree', 'out_degree'] as const;

// After  
const VALID_METRICS = ['in_degree', 'out_degree'] as const;
```

When pagerank is actually implemented, add it to BOTH the schema AND the handler.

## References

- Red-team audit (2026-01-25)
- Fix: handlers.ts:208
